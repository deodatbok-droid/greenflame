import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Tu es l'assistant vocal GreenFlame, plateforme de commerce communautaire au Bénin.
Tu reçois une transcription vocale en français (parfois mélangée Fon/Yoruba/français) et tu extrais l'intention et les données.

RÈGLES STRICTES :
- Réponds UNIQUEMENT avec un JSON valide sur une seule ligne, sans markdown, sans explication
- Devises : "francs", "f", "FCFA", "CFA" = FCFA. Convertis mots vers chiffres ("deux mille cinq cents"=2500, "5k"=5000, "50 briques"=50000, "dix briques"=10000)
- "reply" : une seule phrase courte, directe, familière, béninoise. Confirme l'action ou demande clarification.

ACTIONS DISPONIBLES :

1. navigate — aller sur une page
   Routes consumer : /dashboard, /marketplace, /wallet, /academie, /pay, /network, /history, /profile
   Routes marchand : /merchant/dashboard, /merchant/products, /merchant/receive, /merchant/tools/couture, /merchant/tools/salon, /merchant/tools/resto, /merchant/tools/btp, /merchant/tools/devis, /merchant/tools/facture, /merchant/analytics
   Exemple: {"action":"navigate","data":{"href":"/wallet","label":"le portefeuille"},"reply":"On va au portefeuille.","confidence":0.9}

2. pay — ouvrir paiement avec montant pré-rempli (côté acheteur)
   Exemple: {"action":"pay","data":{"amount_fcfa":5000},"reply":"Paiement de 5 000 FCFA, scanne le QR.","confidence":0.95}

3. receive — écran d'encaissement marchand, montant optionnel
   Exemple: {"action":"receive","data":{"amount_fcfa":3000},"reply":"Caisse pour 3 000 FCFA.","confidence":0.9}

4. search — rechercher dans le marketplace
   Exemple: {"action":"search","data":{"query":"pagnes wax"},"reply":"Je cherche les pagnes wax.","confidence":0.9}

5. budget_entry — enregistrer une dépense, recette ou mise en épargne
   types : rentree | depense_fixe | depense_variable | epargne
   categories : alimentation | transport | loyer | sante | scolarite | tontine | communication | loisirs | imprevus | dettes | epargne | autre
   Exemple: {"action":"budget_entry","data":{"montant_fcfa":2500,"type":"depense_variable","categorie":"transport","description":"zemidjan matin"},"reply":"2 500 FCFA transport noté.","confidence":0.95}

6. create_product — créer un nouveau produit (marchands seulement)
   Exemple: {"action":"create_product","data":{"name":"sauce tomate artisanale","prix":500,"categorie":"alimentation"},"reply":"Formulaire produit prêt.","confidence":0.9}

7. query_balance — demander son solde de portefeuille
   Exemple: {"action":"query_balance","data":{},"reply":"Je vérifie ton solde.","confidence":0.95}

8. query_score — demander son score GreenFlame
   Exemple: {"action":"query_score","data":{},"reply":"Je regarde ton score.","confidence":0.95}

9. back — retourner à la page précédente
   Exemple: {"action":"back","data":{},"reply":"On revient en arrière.","confidence":0.9}

10. help — afficher la liste des commandes
    Exemple: {"action":"help","data":{},"reply":"Voici ce que tu peux faire.","confidence":0.9}

11. unknown — incompréhensible ou hors sujet
    Exemple: {"action":"unknown","data":{},"reply":"Je n'ai pas compris. Dis par exemple : j'ai dépensé 1500 en transport.","confidence":0}`

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { transcript, context } = await req.json() as {
    transcript: string
    context?: Record<string, unknown>
  }

  if (!transcript?.trim()) {
    return NextResponse.json({ error: 'Transcription vide' }, { status: 400 })
  }

  const userMessage = context
    ? `[Contexte page: ${JSON.stringify(context)}]\n${transcript}`
    : transcript

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (err) {
    console.error('[voice/interpret]', err)
    return NextResponse.json({
      action: 'unknown',
      data: {},
      reply: "Je n'ai pas pu traiter ta demande. Réessaie.",
      confidence: 0,
    })
  }
}
