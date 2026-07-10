/**
 * voiceParser.ts — Parsing vocal français pour GreenFlame
 * Convertit du texte parlé en actions typées.
 */

// ── Dictionnaire français → chiffres ──────────────────────────────────────

const WORD_MAP: Record<string, number> = {
  'zéro': 0, 'zero': 0,
  'un': 1, 'une': 1,
  'deux': 2, 'trois': 3, 'quatre': 4, 'cinq': 5,
  'six': 6, 'sept': 7, 'huit': 8, 'neuf': 9,
  'dix': 10, 'onze': 11, 'douze': 12, 'treize': 13,
  'quatorze': 14, 'quinze': 15, 'seize': 16,
  'vingt': 20, 'trente': 30, 'quarante': 40,
  'cinquante': 50, 'soixante': 60,
}

const COMPOUND_TENS: [RegExp, number][] = [
  [/quatre[- ]vingt[- ]dix/g,  90],
  [/quatre[- ]vingts?/g,        80],
  [/soixante[- ]dix/g,          70],
]

export function parseFrenchNumber(text: string): number | null {
  let t = text.toLowerCase().trim()

  // Chiffres purs (avec espaces : "5 000")
  const digitOnly = t.replace(/\s/g, '').replace(/[^\d]/g, '')
  if (digitOnly.length > 0 && /^\d+$/.test(digitOnly)) {
    const n = parseInt(digitOnly)
    return n > 0 ? n : null
  }

  for (const [re, val] of COMPOUND_TENS) {
    t = t.replace(re, `__${val}__`)
  }

  t = t
    .replace(/\b(francs?|fcfa|cfa|et|de|environ|à|a)\b/g, ' ')
    .replace(/[-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = t.split(' ')
  let result = 0
  let current = 0

  for (const token of tokens) {
    if (!token) continue
    const pre = token.match(/^__(\d+)__$/)
    if (pre) { current += parseInt(pre[1]); continue }
    const plain = parseInt(token)
    if (!isNaN(plain)) { current += plain; continue }
    if (WORD_MAP[token] !== undefined) { current += WORD_MAP[token]; continue }
    if (token === 'cent' || token === 'cents') {
      current = current === 0 ? 100 : current * 100; continue
    }
    if (token === 'mille') {
      current = current === 0 ? 1000 : current * 1000
      result += current; current = 0; continue
    }
    if (token === 'million' || token === 'millions') {
      current = current === 0 ? 1_000_000 : current * 1_000_000
      result += current; current = 0; continue
    }
  }

  result += current
  return result > 0 ? result : null
}

export function extractAmount(text: string): number | null {
  const cleaned = text
    .toLowerCase()
    .replace(/\b(payer|encaisser|recevoir|montant|de|pour|chez|à|a|soit|c'est|faire|créer|devis|facture|nouveau|nouvelle)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return parseFrenchNumber(cleaned)
}

// ── Types d'actions ────────────────────────────────────────────────────────

export type VoiceAction =
  | { type: 'navigate';    path: string; label: string }
  | { type: 'pay';         amount: number }
  | { type: 'receive';     amount?: number }
  | { type: 'search';      query: string }
  | { type: 'add_product' }
  | { type: 'new_quote';   amount?: number }
  | { type: 'new_invoice'; amount?: number }
  | { type: 'back' }
  | { type: 'amount';      value: number }
  | { type: 'help' }
  | { type: 'unknown';     transcript: string }

// ── Routes consommateur ────────────────────────────────────────────────────

const CONSUMER_ROUTES: { keywords: string[]; path: string; label: string }[] = [
  {
    keywords: ['accueil', 'dashboard', 'tableau de bord', 'home', 'mon tableau', 'page principale'],
    path: '/dashboard', label: 'Accueil',
  },
  {
    keywords: ['marketplace', 'marché', 'boutiques', 'magasin', 'achats', 'faire des courses', 'courses', 'shopping', 'acheter', 'produits'],
    path: '/marketplace', label: 'Marketplace',
  },
  {
    keywords: ['réseau', 'network', 'affiliés', 'communauté', 'parrainage', 'filleuls', 'mon réseau', 'ma communauté', 'parrains'],
    path: '/network', label: 'Communauté',
  },
  {
    keywords: ['wallet', 'portefeuille', 'solde', 'argent', 'balance', 'mon wallet', 'mon portefeuille', 'mes points', 'gfp'],
    path: '/wallet', label: 'Wallet',
  },
  {
    keywords: ['historique', 'transactions', 'achats passés', 'mes achats', 'mes transactions', 'mes commandes'],
    path: '/history', label: 'Historique',
  },
  {
    keywords: ['démo', 'demo', 'simulation', 'simuler', 'tester'],
    path: '/demo', label: 'Démo',
  },
  {
    keywords: ['profil', 'profile', 'compte', 'paramètres', 'mon compte', 'mon profil', 'mes infos'],
    path: '/profile', label: 'Profil',
  },
  {
    keywords: ['payer', 'paiement', 'page de paiement', 'payer chez'],
    path: '/pay', label: 'Payer',
  },
]

export function parseConsumerCommand(text: string): VoiceAction {
  const t = text.toLowerCase().trim()

  // Aide
  if (/\b(aide|help|commandes?|quoi dire|que puis-je|comment)\b/.test(t)) return { type: 'help' }

  // Retour / annuler
  if (/\b(retour|précédent|revenir|annuler|fermer|quitter|arrière)\b/.test(t)) return { type: 'back' }

  // Chercher dans le marketplace
  if (/\b(chercher|rechercher|trouver|search|je veux trouver|je cherche)\b/.test(t)) {
    const query = t
      .replace(/\b(chercher|rechercher|trouver|search|je veux trouver|je cherche|dans le marché|sur le marché|sur marketplace|dans marketplace|sur greenflame)\b/g, '')
      .trim()
    if (query.length > 1) return { type: 'search', query }
    return { type: 'navigate', path: '/marketplace', label: 'Marketplace' }
  }

  // "payer X francs"
  if (/\b(payer|paiement|régler|je veux payer|je dois payer)\b/.test(t)) {
    const amount = extractAmount(t)
    if (amount && amount >= 100) return { type: 'pay', amount }
    return { type: 'navigate', path: '/pay', label: 'Payer' }
  }

  // Navigation
  for (const route of CONSUMER_ROUTES) {
    if (route.keywords.some(k => t.includes(k))) {
      return { type: 'navigate', path: route.path, label: route.label }
    }
  }

  // Montant seul
  const amount = extractAmount(t)
  if (amount && amount >= 50) return { type: 'amount', value: amount }

  return { type: 'unknown', transcript: text }
}

// ── Routes marchand ────────────────────────────────────────────────────────

const MERCHANT_ROUTES: { keywords: string[]; path: string; label: string }[] = [
  {
    keywords: ['dashboard', 'tableau de bord', 'accueil', 'mon dashboard', 'page principale'],
    path: '/merchant/dashboard', label: 'Dashboard',
  },
  {
    keywords: ['produits', 'catalogue', 'articles', 'mes produits', 'mon catalogue', 'mes articles', 'stock', 'inventaire'],
    path: '/merchant/products', label: 'Produits',
  },
  {
    keywords: ['outils', 'tools', 'fonctionnalités', 'mes outils'],
    path: '/merchant/tools', label: 'Outils',
  },
  {
    keywords: ['analytiques', 'analytics', 'statistiques', 'stats', 'performances', 'chiffres', 'résultats'],
    path: '/merchant/analytics', label: 'Analytics',
  },
  {
    keywords: ['historique', 'transactions', 'ventes', 'mes ventes', 'mes transactions', 'mes encaissements'],
    path: '/merchant/history', label: 'Historique',
  },
  {
    keywords: ['bons', 'vouchers', 'tickets', 'réductions', 'codes promo', 'codes'],
    path: '/merchant/vouchers', label: 'Bons',
  },
  {
    keywords: ['abonnement', 'upgrade', 'passer pro', 'passer vip', 'offres'],
    path: '/merchant/upgrade', label: 'Abonnement',
  },
  {
    keywords: ['caissiers', 'multi-caissier', 'équipe', 'mes caissiers'],
    path: '/merchant/cashiers', label: 'Caissiers',
  },
  {
    keywords: ['agent', 'dépôt', 'retrait cash', 'service agent'],
    path: '/merchant/agent', label: 'Agent',
  },
  {
    keywords: ['salon', 'beauté', 'coiffure', 'prestations', 'marges', 'salon beauté', 'outil salon'],
    path: '/merchant/tools/salon', label: 'Salon & Beauté',
  },
  {
    keywords: ['couture', 'mode', 'atelier', 'tissu', 'commandes couture', 'clients couture', 'tailleur', 'outil couture'],
    path: '/merchant/tools/couture', label: 'Couture & Mode',
  },
  {
    keywords: ['restauration', 'recettes', 'traiteur', 'cuisine', 'resto', 'plats', 'ingrédients', 'outil resto'],
    path: '/merchant/tools/resto', label: 'Restauration',
  },
  {
    keywords: ['btp', 'chantier', 'chantiers', 'travaux', 'artisan', 'matériaux', 'construction', 'estimateur', 'devis travaux', 'outil btp'],
    path: '/merchant/tools/btp', label: 'BTP & Artisans',
  },
]

export function parseMerchantCommand(text: string): VoiceAction {
  const t = text.toLowerCase().trim()

  // Aide
  if (/\b(aide|help|commandes?)\b/.test(t)) return { type: 'help' }

  // Retour / annuler
  if (/\b(retour|précédent|revenir|annuler|fermer|quitter|arrière)\b/.test(t)) return { type: 'back' }

  // Nouveau produit (avant navigation générique)
  if (/\b(nouveau produit|ajouter produit|créer produit|enregistrer produit|ajouter article|créer article|nouveau article|mettre en vente)\b/.test(t)) {
    return { type: 'add_product' }
  }

  // Devis avec ou sans montant
  if (/\b(devis|faire un devis|nouveau devis|créer devis|faire devis)\b/.test(t)) {
    const amount = extractAmount(t)
    return { type: 'new_quote', amount: amount ?? undefined }
  }

  // Facture avec ou sans montant
  if (/\b(facture|faire une facture|nouvelle facture|créer facture|émettre facture|faire facture)\b/.test(t)) {
    const amount = extractAmount(t)
    return { type: 'new_invoice', amount: amount ?? undefined }
  }

  // Encaisser avec ou sans montant → receive
  if (/\b(encaisser|recevoir paiement|recette|ouvrir la caisse|ouvre la caisse|caisse client)\b/.test(t)) {
    const amount = extractAmount(t)
    return { type: 'receive', amount: amount ?? undefined }
  }

  // Navigation générique
  for (const route of MERCHANT_ROUTES) {
    if (route.keywords.some(k => t.includes(k))) {
      return { type: 'navigate', path: route.path, label: route.label }
    }
  }

  // Montant seul
  const amount = extractAmount(t)
  if (amount && amount >= 50) return { type: 'amount', value: amount }

  return { type: 'unknown', transcript: text }
}

// ── Routes admin ───────────────────────────────────────────────────────────

const ADMIN_ROUTES: { keywords: string[]; path: string; label: string }[] = [
  { keywords: ['dashboard', 'tableau de bord', 'accueil'],              path: '/admin/dashboard',      label: 'Dashboard' },
  { keywords: ['marchands', 'boutiques', 'commerçants'],                path: '/admin/merchants',      label: 'Marchands' },
  { keywords: ['membres', 'utilisateurs', 'users', 'clients'],          path: '/admin/users',          label: 'Membres' },
  { keywords: ['transactions'],                                           path: '/admin/transactions',   label: 'Transactions' },
  { keywords: ['retraits', 'retrait', 'withdrawals'],                    path: '/admin/withdrawals',    label: 'Retraits' },
  { keywords: ['kyc', 'vérification', 'identité'],                       path: '/admin/kyc',            label: 'KYC' },
  { keywords: ['float', 'réconciliation', 'reconciliation', 'solde'],   path: '/admin/reconciliation', label: 'Float' },
  { keywords: ['revenus', 'revenue', 'chiffre'],                         path: '/admin/revenue',        label: 'Revenus' },
  { keywords: ['marketplace', 'marché', 'catalogue global'],             path: '/admin/marketplace',    label: 'Marketplace' },
]

export function parseAdminCommand(text: string): VoiceAction {
  const t = text.toLowerCase().trim()

  if (/\b(aide|help|commandes?)\b/.test(t)) return { type: 'help' }
  if (/\b(retour|précédent|revenir|annuler|fermer)\b/.test(t)) return { type: 'back' }

  for (const route of ADMIN_ROUTES) {
    if (route.keywords.some(k => t.includes(k))) {
      return { type: 'navigate', path: route.path, label: route.label }
    }
  }

  return { type: 'unknown', transcript: text }
}

// ── Parser universel ───────────────────────────────────────────────────────

export function parseVoiceCommand(text: string, context: 'consumer' | 'merchant' | 'admin'): VoiceAction {
  const parsers =
    context === 'merchant' ? [parseMerchantCommand, parseConsumerCommand, parseAdminCommand]
    : context === 'admin'  ? [parseAdminCommand, parseConsumerCommand, parseMerchantCommand]
    :                        [parseConsumerCommand, parseMerchantCommand, parseAdminCommand]

  for (const parse of parsers) {
    const action = parse(text)
    if (action.type !== 'unknown') return action
  }
  return { type: 'unknown', transcript: text }
}

// ── Listes d'aide ──────────────────────────────────────────────────────────

export const CONSUMER_VOICE_HINTS = [
  { label: 'Accueil',          example: '"Dashboard"' },
  { label: 'Payer 5000',       example: '"Payer cinq mille francs"' },
  { label: 'Chercher…',        example: '"Chercher du riz"' },
  { label: 'Wallet',           example: '"Mon portefeuille"' },
  { label: 'Communauté',       example: '"Mon réseau"' },
  { label: 'Marketplace',      example: '"Boutiques"' },
  { label: 'Historique',       example: '"Mes transactions"' },
  { label: 'Profil',           example: '"Mon compte"' },
  { label: 'Retour',           example: '"Retour" ou "Annuler"' },
]

export const MERCHANT_VOICE_HINTS = [
  { label: 'Encaisser',        example: '"Encaisser cinq mille"' },
  { label: 'Nouveau produit',  example: '"Nouveau produit"' },
  { label: 'Devis',            example: '"Devis deux mille cinq cents"' },
  { label: 'Facture',          example: '"Facture dix mille"' },
  { label: 'Salon',            example: '"Salon beauté" ou "Coiffure"' },
  { label: 'Couture',          example: '"Couture" ou "Mon atelier"' },
  { label: 'Restauration',     example: '"Recettes" ou "Traiteur"' },
  { label: 'BTP',              example: '"Chantier" ou "Estimateur BTP"' },
  { label: 'Produits',         example: '"Mon catalogue"' },
  { label: 'Analytics',        example: '"Mes statistiques"' },
  { label: 'Abonnement',       example: '"Passer Pro"' },
  { label: 'Retour',           example: '"Retour" ou "Annuler"' },
]

export const ADMIN_VOICE_HINTS = [
  { label: 'Dashboard',    example: '"Tableau de bord"' },
  { label: 'Marchands',    example: '"Mes marchands"' },
  { label: 'Membres',      example: '"Les utilisateurs"' },
  { label: 'KYC',          example: '"Vérification identité"' },
  { label: 'Float',        example: '"Réconciliation"' },
  { label: 'Retraits',     example: '"Les retraits"' },
  { label: 'Revenus',      example: '"Chiffre d\'affaires"' },
  { label: 'Retour',       example: '"Retour"' },
]
