/**
 * /api/btp/estimate — Estimation IA de matériaux pour un chantier
 * POST — génère une liste de matériaux à partir d'une description en français
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type EstimateBody = {
  description?: string
  surface?: number
  pieces?: number
}

type AiResponseItem = {
  name: string
  unit: string
  quantity: number
  category: string
  note?: string
}

type AiResponse = {
  items: AiResponseItem[]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json() as EstimateBody
  const { description, surface, pieces } = body

  if (!description?.trim()) {
    return NextResponse.json({ error: 'Description des travaux requise' }, { status: 400 })
  }

  const prompt = `Tu es un expert en construction et rénovation au Bénin (Afrique de l'Ouest).
Un artisan te décrit des travaux à réaliser. Tu dois estimer la liste de matériaux nécessaires avec des quantités réalistes.

Travaux décrits : "${description}"
${surface ? `Surface concernée : ${surface} m²` : ''}
${pieces ? `Nombre de pièces : ${pieces}` : ''}

Réponds UNIQUEMENT en JSON valide, sans texte avant ou après, avec ce format exact :
{
  "items": [
    { "name": "Ciment CPA 42.5", "unit": "sac", "quantity": 15, "category": "gros_oeuvre", "note": "Pour 20m² de chape" },
    ...
  ]
}

Catégories possibles : gros_oeuvre, finition, electricite, plomberie, menuiserie, autre.
Unités possibles : sac, tonne, kg, m³, m², m, pièce, L, rouleau, barre.
Sois précis et réaliste pour le contexte béninois. Inclus tous les matériaux principaux et consommables (colle, joints, visserie...).
Maximum 20 items.`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Pas de JSON dans la réponse')

    const parsed = JSON.parse(jsonMatch[0]) as AiResponse

    if (!Array.isArray(parsed.items)) {
      throw new Error('Format de réponse invalide')
    }

    return NextResponse.json({ items: parsed.items })
  } catch (err) {
    console.error('[btp/estimate] error:', err)
    return NextResponse.json({ error: 'Impossible de générer une estimation' }, { status: 500 })
  }
}
