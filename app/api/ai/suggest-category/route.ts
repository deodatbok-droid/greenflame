import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// POST /api/ai/suggest-category
// Body : { name: string, description?: string }
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { name, description } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const { data: cats } = await supabase
    .from('marketplace_categories')
    .select('id, slug, name, parent_id')
    .eq('is_active', true)
    .order('sort_order')

  const allCats = cats ?? []
  const roots = allCats.filter((c: any) => !c.parent_id)
  const children = allCats.filter((c: any) => c.parent_id)

  const catList = roots.map((r: any) => {
    const subs = children.filter((c: any) => c.parent_id === r.id)
    return `- ${r.name} (slug: ${r.slug})\n  Sous-catégories: ${subs.map((s: any) => s.name).join(', ')}`
  }).join('\n')

  const prompt = `Tu es un assistant qui classe des produits dans les bonnes catégories d'une marketplace africaine (Bénin/Togo).

Voici les catégories disponibles :
${catList}

Produit à classer :
- Nom : "${name}"
${description ? `- Description : "${description}"` : ''}

Réponds UNIQUEMENT avec un JSON valide (pas de markdown, pas d'explication) :
{
  "category_slug": "slug-de-la-categorie-racine",
  "subcategory_slug": "slug-de-la-sous-categorie",
  "confidence": 0.95,
  "reason": "Raison courte en français"
}`

  try {
    const msg = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    })

    const raw = (msg.content[0] as { type: string; text: string }).text.trim()
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('Pas de JSON dans la réponse')

    const parsed = JSON.parse(jsonMatch[0]) as {
      category_slug: string
      subcategory_slug: string
      confidence: number
      reason: string
    }

    const categoryRow = allCats.find((c: any) => c.slug === parsed.category_slug && !c.parent_id)
    const subcategoryRow = allCats.find((c: any) => c.slug === parsed.subcategory_slug && c.parent_id)

    return NextResponse.json({
      category_id:      categoryRow?.id ?? null,
      category_slug:    parsed.category_slug,
      category_name:    categoryRow?.name ?? parsed.category_slug,
      subcategory_id:   subcategoryRow?.id ?? null,
      subcategory_slug: parsed.subcategory_slug,
      subcategory_name: subcategoryRow?.name ?? parsed.subcategory_slug,
      confidence:       parsed.confidence,
      reason:           parsed.reason,
    })
  } catch (err) {
    console.error('[suggest-category] error:', err)
    return NextResponse.json({ error: 'Suggestion IA indisponible' }, { status: 500 })
  }
}
