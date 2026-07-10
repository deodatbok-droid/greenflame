import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * lib/chat/core.ts
 *
 * Logique partagée du chatbot GreenFlame — utilisée par les DEUX surfaces :
 *   - in-app   : app/api/chat/route.ts (client RLS lié à la session de l'utilisateur connecté)
 *   - WhatsApp : app/api/chat/whatsapp/route.ts (client service, utilisateur résolu par téléphone,
 *                scopé manuellement via userId puisqu'il n'y a pas de session Supabase côté webhook)
 *
 * Un seul backend Claude, pas de routage en dur par "rôle de bot" — voir le system
 * prompt adaptatif dans buildSystemPrompt(). Garde-fou non négociable : cette
 * logique ne déclenche jamais d'action irréversible (retrait, reset PIN, validation
 * KYC) — uniquement de la lecture, toujours scopée à userId.
 */

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export type ChatRole = 'user' | 'assistant'
export type ChatMessage = { role: ChatRole; content: string }
export type ChatLocale = 'fr' | 'en'

export const MODEL = 'claude-sonnet-4-5'
export const MAX_HISTORY = 10
const MAX_TOOL_LOOPS = 4

// ── Outils exposés au modèle — lecture seule, scoped à l'utilisateur connecté ──
const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_wallet_balance',
    description: "Renvoie le solde actuel du portefeuille de l'utilisateur connecté (FCFA et GFP) et le total gagné en cashback. Utilise cet outil avant de répondre à toute question sur le solde — ne devine jamais un montant.",
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recent_transactions',
    description: "Renvoie les dernières transactions (achats) de l'utilisateur connecté : montant, statut, marchand, date.",
    input_schema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Nombre de transactions à renvoyer (1 à 10, défaut 5)' },
      },
    },
  },
]

// ── Connaissance produit GreenFlame — injectée dans chaque prompt ──────────────
const PRODUCT_KNOWLEDGE_FR = `
## GreenFlame — ce que tu sais sur la plateforme

### Pour les acheteurs (compte personnel)
- **Dashboard** (/dashboard) : solde wallet, cashback du mois, rang Flamme, accès rapide aux fonctions
- **Payer** (/pay) : scanner le QR code d'un marchand pour payer (Mobile Money MTN/Moov ou wallet GreenFlame)
- **Marketplace** (/marketplace) : acheter des produits en ligne auprès de marchands locaux
- **Wallet** (/wallet) : voir son solde FCFA + Points GreenFlame (GFP), faire un retrait Mobile Money (plafond 50 000 FCFA/mois, 500 000 FCFA/mois une fois l'identité vérifiée) ou en espèces chez un marchand Service Agent (1 % de frais), voir l'historique des mouvements
- **Historique** (/history) : toutes les transactions passées avec statut et détail
- **Communauté** (/network) : voir les personnes de sa communauté sur 5 Cercles, ses dividendes et revenus partagés
- **Messages** (/messages) : discuter avec les marchands après un achat, participer au cercle communautaire
- **Tontine** (/tontine) : créer ou rejoindre une tontine (épargne rotative entre proches), gérer les tours et cotisations — fonctionnalité distincte des Cercles (qui décrivent la profondeur de la communauté, pas un groupe d'épargne)
- **Bons de retrait** : envoyer de l'argent à quelqu'un qui le retire en espèces chez un marchand, sans connaître son numéro de wallet (1 % de frais de service, prélevé à l'encaissement)
- **Cagnotte communautaire** : chaque mois, les 50 premiers FCFA de cashback déjà gagné sont mis de côté dans un pot collectif ; des tirages réguliers mais imprévisibles désignent des gagnants, et les autres contributeurs reçoivent une compensation équivalente
- **Académie** (/academie) : modules de formation financière (budget, épargne, objectifs de vie) qui génèrent des Flammes Autonomie (FAU)
- **Profil** (/profile) : rang Flamme, code d'invitation, stats personnelles, KYC, paramètres PIN

### Mécanique financière
- **Cashback** : 12 % de la commission marchande (10 % standard) crédité instantanément en FCFA (si ≥ 50 FCFA) ou en GFP (si < 50 FCFA). 3 % supplémentaires alimentent le Fonds Récompenses/Événements communautaire.
- **Points GreenFlame (GFP)** : 1 FCFA = 10 GFP (donc 1 GFP = 0,1 FCFA). Retrait possible dès 50 000 GFP accumulés (= 5 000 FCFA)
- **Revenus partagés (dividendes communautaires)** : 40 % de chaque transaction répartis sur 5 Cercles de la communauté (Cercle 1=12 %, Cercle 2=10 %, Cercle 3=8 %, Cercle 4=6 %, Cercle 5=4 %)
- **Plafond de retrait mensuel** : 50 000 FCFA/mois par défaut, 500 000 FCFA/mois une fois l'identité vérifiée (KYC niveau 1+)
- **Vérification d'identité (KYC)** : optionnelle mais avantageuse — augmente le plafond de retrait, l'éligibilité au crédit (avances/BNPL), et débloque la recherche + invitation directe d'autres membres dans la messagerie
- **Rang Flamme** : Étincelle → Flamme → Brasier → Étoile → Soleil. Monte avec les achats (FA) et les objectifs de vie (FAU). Redescend après 60 jours d'inactivité.

### Pour les marchands (compte professionnel)
**Outils universels (accessibles à tous les marchands) :**
- 📄 **Devis** (/merchant/tools/devis) : créer et envoyer des devis clients (5/mois gratuit, illimité en Pro)
- 🧾 **Facture** (/merchant/tools/facture) : créer et envoyer des factures (5/mois gratuit, illimité en Pro)
- 💳 **Encaisser** (/merchant/receive) : afficher son QR code pour recevoir des paiements GreenFlame
- 🎤 **Navigation vocale** (/merchant/tools/voice) : commander l'app à la voix
- 📦 **Produits** : 10 produits actifs maximum en compte gratuit, illimité en Pro/VIP

**Outils Pro/VIP :**
- 📊 **Analytics** (/merchant/analytics) : courbes de ventes, top clients, CA par période (Pro requis)
- 🏪 **Vitrine publique** (/boutique/[slug]) : page de vente en ligne à partager (VIP requis)
- 👥 **Multi-caissier** (/merchant/cashiers) : créer des sous-comptes caissiers, jusqu'à 5 (VIP requis)
- 🏦 **Service Agent** (/merchant/agent) : recharger le wallet GreenFlame de clients contre espèces, abonnement 10 000 FCFA/mois — gagne 0,5 % de commission sur chaque retrait client encaissé, les dépôts sont gratuits pour le marchand

**Outils sectoriels spécialisés — abonnement mensuel séparé :**

🪡 **Couture & Mode** (/merchant/tools/couture) — 10 000 FCFA/mois
  Conçu pour les couturières, tailleurs, stylistes. Fonctionnalités :
  - Fiches clients avec mensurations complètes (poitrine, taille, hanches, bras, etc.)
  - Gestion des commandes de confection avec statuts (en attente, en cours, livré)
  - Calcul automatique du tissu nécessaire par commande
  - Suivi des retouches (retouche simple, ourlet, transformation…)
  - Catalogue des accessoires (fils, boutons, fermetures…) avec stock
  - Bons de livraison imprimables
  → Idéal si tu fais de la couture, de la mode ou du prêt-à-porter sur mesure.

✂️ **Salon & Beauté** (/merchant/tools/salon) — 10 000 FCFA/mois
  Pour les coiffeurs, instituts de beauté, esthéticiennes. Fonctionnalités :
  - Fiches clients avec historique des prestations
  - Catalogue de prestations avec prix
  - Suivi des produits (stock, prix d'achat, marge)
  - Gestion des commandes de produits

🍲 **Restauration** (/merchant/tools/resto) — 25 000 FCFA/mois
  Pour les restaurants, traiteurs, fast-food. Fonctionnalités :
  - Menus et cartes avec prix
  - Prise de commandes (table, emporter, livraison)
  - Gestion des ingrédients et stocks avec prix d'achat
  - Recettes avec calcul de coût de revient
  - Suivi des clients fidèles

🏗️ **BTP & Artisans** (/merchant/tools/btp) — 10 000 FCFA/mois
  Pour les maçons, menuisiers, électriciens, plombiers, artisans. Fonctionnalités :
  - Gestion des chantiers (suivi d'avancement, client associé)
  - Catalogue de matériaux avec prix au détail
  - Estimateur de coût de chantier
  - Suivi des dépenses par chantier

**Outils sectoriels génériques (Pro requis, configurable selon secteur) :**
Consultant, Avocat/Juriste, Photographe/Vidéaste, Transporteur, Médecin/Clinique, Coach/Formateur, Événementiel, Imprimerie.
Ces secteurs bénéficient d'un outil personnalisé activable depuis /merchant/tools/activer.

### Abonnements marchands
- **Free** : encaisser, 10 produits actifs, 5 devis/mois, 5 factures/mois
- **Pro** : devis + factures illimités, analytics, outil sectoriel personnalisé — à partir de 5 000 FCFA/mois
- **VIP** : tout Pro + vitrine publique + multi-caissier
- **Agent** : service de recharge wallet (10 000 FCFA/mois, activable séparément)
- **Outils sectoriels** Couture/Salon/BTP : 10 000 FCFA/mois chacun | Restauration : 25 000 FCFA/mois
`

const PRODUCT_KNOWLEDGE_EN = `
## GreenFlame — what you know about the platform

### For buyers (personal account)
- **Dashboard** (/dashboard): wallet balance, monthly cashback, Flamme rank, quick access to all features
- **Pay** (/pay): scan a merchant's QR code to pay (MTN/Moov Mobile Money or GreenFlame wallet)
- **Marketplace** (/marketplace): buy products online from local merchants
- **Wallet** (/wallet): view FCFA balance + GreenFlame Points (GFP), withdraw via Mobile Money (50,000 FCFA/month cap, 500,000 FCFA/month once identity is verified) or as cash via a Service Agent merchant (1% fee), view transaction history
- **History** (/history): all past transactions with status and details
- **Community** (/network): view your community members across 5 Circles, your dividends and shared revenue
- **Messages** (/messages): chat with merchants after a purchase, participate in your community circle
- **Tontine** (/tontine): create or join a tontine (rotating savings group), manage rounds and contributions — a separate feature from Circles (which describe community depth, not a savings group)
- **Withdrawal vouchers**: send money to someone who can cash it out at a merchant without knowing their wallet number (1% service fee, charged on cash-out)
- **Community Pool**: each month, the first 50 FCFA of already-earned cashback is set aside in a shared pool; irregular but recurring draws pick winners, and other contributors receive an equivalent compensation
- **Academy** (/academie): financial training modules (budget, savings, life goals) that generate Autonomy Flames (FAU)
- **Profile** (/profile): Flamme rank, invitation code, personal stats, KYC, PIN settings

### Financial mechanics
- **Cashback**: 12% of the merchant commission (10% standard) credited instantly in FCFA (if ≥ 50 FCFA) or GFP (if < 50 FCFA). An additional 3% feeds the community Rewards/Events Fund.
- **GreenFlame Points (GFP)**: 1 FCFA = 10 GFP (so 1 GFP = 0.1 FCFA). Withdrawal available from 50,000 GFP accumulated (= 5,000 FCFA)
- **Shared revenue (community dividends)**: 40% of each transaction shared across 5 community Circles (Circle 1=12%, Circle 2=10%, Circle 3=8%, Circle 4=6%, Circle 5=4%)
- **Monthly withdrawal cap**: 50,000 FCFA/month by default, 500,000 FCFA/month once identity is verified (KYC level 1+)
- **Identity verification (KYC)**: optional but beneficial — raises the withdrawal cap, increases credit eligibility (advances/BNPL), and unlocks search + direct invitation of other members in messaging
- **Flamme rank**: Étincelle → Flamme → Brasier → Étoile → Soleil. Rises with purchases (FA) and life goals (FAU). Drops after 60 days of inactivity.

### For merchants (professional account)
**Universal tools (available to all merchants):**
- 📄 **Quotes** (/merchant/tools/devis): create and send quotes (5/month free, unlimited on Pro)
- 🧾 **Invoices** (/merchant/tools/facture): create and send invoices (5/month free, unlimited on Pro)
- 💳 **Receive payment** (/merchant/receive): display your QR code to receive GreenFlame payments
- 🎤 **Voice navigation** (/merchant/tools/voice): control the app by voice
- 📦 **Products**: 10 active products max on the free tier, unlimited on Pro/VIP

**Pro/VIP tools:**
- 📊 **Analytics** (/merchant/analytics): sales charts, top clients, revenue by period (Pro required)
- 🏪 **Public storefront** (/boutique/[slug]): shareable online sales page (VIP required)
- 👥 **Multi-cashier** (/merchant/cashiers): create sub-accounts for cashiers, up to 5 (VIP required)
- 🏦 **Agent service** (/merchant/agent): top up clients' GreenFlame wallets for cash, 10,000 FCFA/month subscription — earns 0.5% commission on each client withdrawal processed, deposits are free for the merchant

**Specialized sectoral tools — separate monthly subscription:**

🪡 **Couture & Fashion** (/merchant/tools/couture) — 10,000 FCFA/month
  Built for seamstresses, tailors, fashion designers. Features:
  - Client profiles with full measurements (chest, waist, hips, arms, etc.)
  - Order management with status tracking (pending, in progress, delivered)
  - Automatic fabric calculator per order
  - Alterations tracking (simple alteration, hem, transformation…)
  - Accessories catalog (threads, buttons, zippers…) with stock
  - Printable delivery notes
  → Perfect if you do tailoring, fashion or made-to-measure clothing.

✂️ **Salon & Beauty** (/merchant/tools/salon) — 10,000 FCFA/month
  For hairdressers, beauty salons, estheticians. Features:
  - Client profiles with service history
  - Service catalog with pricing
  - Product tracking (stock, purchase price, margin)
  - Product order management

🍲 **Restaurant** (/merchant/tools/resto) — 25,000 FCFA/month
  For restaurants, caterers, fast food. Features:
  - Menu management with pricing
  - Order taking (table, takeaway, delivery)
  - Ingredient & stock management with purchase prices
  - Recipes with cost calculation
  - Loyal customer tracking

🏗️ **Construction & Craftsmen** (/merchant/tools/btp) — 10,000 FCFA/month
  For masons, carpenters, electricians, plumbers, craftsmen. Features:
  - Project management (progress tracking, associated client)
  - Materials catalog with retail prices
  - Project cost estimator
  - Expense tracking per project

**Generic sectoral tools (Pro required, configurable by sector):**
Consultant, Lawyer, Photographer/Videographer, Transporter, Doctor/Clinic, Coach/Trainer, Events, Printing.
These sectors get a custom tool activatable from /merchant/tools/activer.

### Merchant subscriptions
- **Free**: receive payments, 10 active products, 5 quotes/month, 5 invoices/month
- **Pro**: unlimited quotes + invoices, analytics, custom sectoral tool — from 5,000 FCFA/month
- **VIP**: everything Pro + public storefront + multi-cashier
- **Agent**: wallet top-up service (10,000 FCFA/month, activatable separately)
- **Sectoral tools** Couture/Salon/BTP: 10,000 FCFA/month each | Restaurant: 25,000 FCFA/month
`

// Mapping secteur → outil couture
const SECTOR_TOOL_MAP: Record<string, { nameFr: string; nameEn: string; path: string; priceFr: string; priceEn: string }> = {
  couture:      { nameFr: 'Couture & Mode 🪡',       nameEn: 'Couture & Fashion 🪡',    path: '/merchant/tools/couture', priceFr: '10 000 FCFA/mois',   priceEn: '10,000 FCFA/month' },
  salon:        { nameFr: 'Salon & Beauté ✂️',        nameEn: 'Salon & Beauty ✂️',       path: '/merchant/tools/salon',   priceFr: '10 000 FCFA/mois',   priceEn: '10,000 FCFA/month' },
  resto:        { nameFr: 'Restauration 🍲',          nameEn: 'Restaurant 🍲',           path: '/merchant/tools/resto',   priceFr: '25 000 FCFA/mois',   priceEn: '25,000 FCFA/month' },
  btp:          { nameFr: 'BTP & Artisans 🏗️',        nameEn: 'Construction 🏗️',         path: '/merchant/tools/btp',     priceFr: '10 000 FCFA/mois',   priceEn: '10,000 FCFA/month' },
  consultant:   { nameFr: 'Outil Consultant 💼',      nameEn: 'Consultant tool 💼',      path: '/merchant/tools/activer', priceFr: 'Pro requis',          priceEn: 'Pro required' },
  avocat:       { nameFr: 'Outil Avocat ⚖️',          nameEn: 'Lawyer tool ⚖️',          path: '/merchant/tools/activer', priceFr: 'Pro requis',          priceEn: 'Pro required' },
  photographe:  { nameFr: 'Outil Photographe 📸',     nameEn: 'Photographer tool 📸',    path: '/merchant/tools/activer', priceFr: 'Pro requis',          priceEn: 'Pro required' },
  transporteur: { nameFr: 'Outil Transporteur 🚛',    nameEn: 'Transporter tool 🚛',     path: '/merchant/tools/activer', priceFr: 'Pro requis',          priceEn: 'Pro required' },
  medecin:      { nameFr: 'Outil Médecin 🏥',         nameEn: 'Medical tool 🏥',         path: '/merchant/tools/activer', priceEn: 'Pro required',        priceFr: 'Pro requis' },
  coach:        { nameFr: 'Outil Coach 🎯',           nameEn: 'Coach tool 🎯',           path: '/merchant/tools/activer', priceFr: 'Pro requis',          priceEn: 'Pro required' },
  evenement:    { nameFr: 'Outil Événementiel 🎉',    nameEn: 'Events tool 🎉',          path: '/merchant/tools/activer', priceFr: 'Pro requis',          priceEn: 'Pro required' },
  imprimerie:   { nameFr: 'Outil Imprimerie 🖨️',      nameEn: 'Printing tool 🖨️',        path: '/merchant/tools/activer', priceFr: 'Pro requis',          priceEn: 'Pro required' },
}

// ── System prompt — adapté au contexte réel, pas de routage en dur par "rôle de bot" ──
function buildSystemPrompt(opts: {
  fullName: string
  roles: string[]
  onboardingDone: boolean
  merchantCategory: string | null
  channel: 'app' | 'whatsapp'
  locale: ChatLocale
}): string {
  const { fullName, roles, onboardingDone, merchantCategory, channel, locale } = opts
  const en = locale === 'en'
  const name = fullName || (en ? 'a user' : 'un utilisateur')

  const sections: string[] = [
    en
      ? `You are the GreenFlame assistant, a community fintech operating in Benin and West Africa. You are speaking with ${name}. Always respond in English, warmly, concisely and concretely — no technical jargon.`
      : `Tu es l'assistant GreenFlame, une fintech communautaire opérant au Bénin et en Afrique de l'Ouest. Tu parles à ${name}. Réponds toujours en français, de façon chaleureuse, concise et concrète — pas de jargon technique.`,

    en ? PRODUCT_KNOWLEDGE_EN : PRODUCT_KNOWLEDGE_FR,

    en
      ? `Non-negotiable rules:
- You NEVER execute irreversible actions (withdrawal, PIN change, KYC validation, money transfer). If the user asks, explain how to do it themselves in the app — never on their behalf.
- If the question involves a dispute, suspected fraud, or a sensitive case you cannot resolve, say so clearly and offer to escalate to human support.
- Use available tools to verify real data (balance, transactions) before responding — never guess an amount or status.
- Terminology: always say "Circles" (never "levels"), "community leader" (never "sponsor" or "active sponsor"), "shared revenue" (never "network commissions" or "MLM"), and "GFP" (never "PGF"). Never use the word "pyramid".`
      : `Règles non négociables :
- Tu n'exécutes JAMAIS d'action irréversible (retrait, changement de PIN, validation KYC, transfert d'argent). Si l'utilisateur le demande, explique-lui comment le faire lui-même dans l'app et invite-le à confirmer l'action de son côté — jamais à ta place.
- Si la question concerne un litige, une fraude suspectée, ou un cas sensible que tu ne peux pas trancher, dis-le clairement et propose d'escalader vers le support humain plutôt que d'improviser.
- Utilise les outils à ta disposition pour vérifier les données réelles (solde, transactions) avant de répondre — ne devine jamais un montant ou un statut.
- Terminologie : dis toujours "Cercles" (jamais "niveaux"), "Leader communautaire" (jamais "sponsor" ou "parrain actif"), "revenus partagés" (jamais "commissions de réseau" ou "MLM"), et "GFP" (jamais "PGF"). N'utilise jamais le mot "pyramide".`,
  ]

  if (channel === 'whatsapp') {
    sections.push(en
      ? `This message comes via WhatsApp: keep it brief (a few sentences), avoid formatting that doesn't display well in WhatsApp (no tables), and use WhatsApp bold (*text*) sparingly if needed.`
      : `Ce message arrive par WhatsApp : reste bref (quelques phrases), évite les mises en forme qui ne s'affichent pas bien dans WhatsApp (pas de tableaux), et utilise au besoin le gras WhatsApp (*texte*) avec parcimonie.`)
  }

  if (!onboardingDone) {
    sections.push(en
      ? `This user has not completed their profile yet. Focus on onboarding: explain simply what GreenFlame is (cashback on purchases, community dividends, merchant tools), guide them toward completing their profile, make them want to continue — without being pushy.`
      : `Cet utilisateur n'a pas terminé son profil. Privilégie un rôle d'accueil : explique simplement ce qu'est GreenFlame (cashback sur les achats, dividendes communautaires, outils pour marchands), guide-le vers la complétion de son profil, donne envie de continuer sans être insistant.`)
  }

  if (roles.includes('merchant')) {
    const tool = merchantCategory ? SECTOR_TOOL_MAP[merchantCategory] : null
    if (tool) {
      sections.push(en
        ? `This user is a merchant in the "${tool.nameEn}" sector. GreenFlame has a dedicated tool built exactly for them: **${tool.nameEn}** available at ${tool.path} (${tool.priceEn}). Always mention this tool first when they ask about professional features or tools for their activity.`
        : `Cet utilisateur est marchand dans le secteur "${tool.nameFr}". GreenFlame a un outil dédié fait exactement pour eux : **${tool.nameFr}** disponible à ${tool.path} (${tool.priceFr}). Mentionne toujours cet outil en priorité quand ils posent une question sur les fonctionnalités pro ou les outils pour leur activité.`)
    } else {
      sections.push(en
        ? `This user is a merchant (no specific sector configured yet). Guide them toward the tools page (/merchant/tools) to explore universal tools (quotes, invoices, payments) and subscribe to the sectoral tool matching their activity.`
        : `Cet utilisateur est marchand (pas de secteur spécifique configuré). Guide-le vers la page des outils (/merchant/tools) pour découvrir les outils universels (devis, factures, encaissement) et s'abonner à l'outil sectoriel correspondant à son activité.`)
    }
  }

  return sections.join('\n\n')
}

// ── Exécution des outils — toujours scoped à l'utilisateur connecté ──
// `supabase` peut être un client RLS (surface in-app) ou un client service
// (surface WhatsApp, où il n'y a pas de session) — dans les deux cas chaque
// requête est explicitement filtrée par userId, donc aucune fuite croisée
// n'est possible même avec un client service qui contourne RLS.
async function runTool(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  input: Record<string, unknown>,
): Promise<unknown> {
  if (name === 'get_wallet_balance') {
    const { data, error } = await supabase
      .from('wallets')
      .select('balance_fcfa, balance_gfp, total_earned_fcfa')
      .eq('user_id', userId)
      .single()
    if (error) return { error: 'Solde indisponible pour le moment' }
    return data
  }

  if (name === 'get_recent_transactions') {
    const limit = Math.min(Math.max(Number(input.limit) || 5, 1), 10)
    const { data, error } = await supabase
      .from('transactions')
      .select('amount_fcfa, status, payment_method, created_at, merchants(business_name)')
      .eq('buyer_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)
    if (error) return { error: 'Transactions indisponibles pour le moment' }
    return data
  }

  return { error: `Outil inconnu: ${name}` }
}

/**
 * Point d'entrée unique du chatbot. Charge le profil, construit le system
 * prompt adapté, exécute la boucle tool-use Claude, et renvoie le texte final.
 */
export async function getChatReply(opts: {
  supabase: SupabaseClient
  userId: string
  message: string
  history: ChatMessage[]
  channel: 'app' | 'whatsapp'
  locale?: ChatLocale
}): Promise<string> {
  const { supabase, userId, message, history, channel, locale = 'fr' } = opts

  const { data: profile } = await supabase
    .from('users')
    .select('full_name, role, onboarding_done')
    .eq('id', userId)
    .single()

  let merchantCategory: string | null = null
  if (profile?.role?.includes('merchant')) {
    const { data: merchant } = await supabase
      .from('merchants')
      .select('business_category')
      .eq('user_id', userId)
      .maybeSingle()
    merchantCategory = merchant?.business_category ?? null
  }

  const systemPrompt = buildSystemPrompt({
    fullName: profile?.full_name ?? '',
    roles: profile?.role ?? [],
    onboardingDone: profile?.onboarding_done ?? true,
    merchantCategory,
    channel,
    locale,
  })

  const messages: Anthropic.MessageParam[] = [
    ...history.slice(-MAX_HISTORY).map(h => ({ role: h.role, content: h.content })),
    { role: 'user' as const, content: message },
  ]

  let finalText = ''

  for (let i = 0; i < MAX_TOOL_LOOPS; i++) {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools: TOOLS,
      messages,
    })

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )

    if (toolUses.length === 0) {
      finalText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim()
      break
    }

    // Le modèle veut utiliser un ou plusieurs outils — on les exécute et on
    // renvoie le résultat pour qu'il poursuive son raisonnement.
    //
    // On reconstruit explicitement les blocs en ContentBlockParam plutôt que
    // de repousser response.content (type ContentBlock[], le type de *réponse*
    // de l'API) directement dans messages (qui attend ContentBlockParam[], le
    // type de *requête*) — les deux unions ne sont pas structurellement
    // identiques (ex. TextBlock.citations est requis et typé TextCitation,
    // alors que TextBlockParam.citations est optionnel et typé
    // TextCitationParam). On ne gère ici que 'text' et 'tool_use', les seuls
    // types de blocs que ce tool-use loop produit réellement.
    const assistantContent: Anthropic.ContentBlockParam[] = response.content.flatMap(
      (block): Anthropic.ContentBlockParam[] => {
        if (block.type === 'text') {
          return [{ type: 'text', text: block.text }]
        }
        if (block.type === 'tool_use') {
          return [{ type: 'tool_use', id: block.id, name: block.name, input: block.input }]
        }
        return []
      },
    )
    messages.push({ role: 'assistant', content: assistantContent })

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const toolUse of toolUses) {
      const result = await runTool(supabase, userId, toolUse.name, toolUse.input as Record<string, unknown>)
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      })
    }
    messages.push({ role: 'user', content: toolResults })
  }

  return finalText || (locale === 'en'
    ? "Sorry, I couldn't formulate a clear response. Please try again or contact GreenFlame support."
    : "Désolé, je n'ai pas pu formuler de réponse claire. Réessaie ou contacte le support GreenFlame.")
}
