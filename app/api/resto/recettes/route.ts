/**
 * /api/resto/recettes — Gestion des recettes restauration
 * GET  — liste les recettes avec leurs ingrédients imbriqués
 * POST — crée une recette avec sa liste d'ingrédients
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getMerchantId(userId: string): Promise<string | null> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('merchants')
    .select('id')
    .eq('user_id', userId)
    .single()
  return data?.id ?? null
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('resto_recettes')
    .select('*, resto_recette_ingredients(quantity_used, resto_ingredients(id, name, unit, price_per_unit_fcfa))')
    .eq('merchant_id', merchantId)
    .order('category')
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

type RecetteItem = { ingredient_id: string; quantity_used: number }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const body = await req.json() as {
    name?: string
    portions?: number
    selling_price_per_portion_fcfa?: number
    category?: string
    notes?: string
    items?: RecetteItem[]
  }

  const { name, portions, selling_price_per_portion_fcfa, category, notes, items } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Nom de la recette requis' }, { status: 400 })

  const svc = createServiceClient()

  // Insérer la recette
  const { data: recette, error: recetteErr } = await svc
    .from('resto_recettes')
    .insert({
      merchant_id: merchantId,
      name: name.trim(),
      portions: portions ?? 1,
      selling_price_per_portion_fcfa: selling_price_per_portion_fcfa ?? 0,
      category: category ?? 'plat',
      notes: notes ?? null,
    })
    .select('id')
    .single()

  if (recetteErr || !recette) {
    return NextResponse.json({ error: recetteErr?.message ?? 'Erreur création' }, { status: 500 })
  }

  // Insérer les ingrédients de la recette
  if (items && items.length > 0) {
    const rows = items.map((item) => ({
      recette_id: recette.id,
      ingredient_id: item.ingredient_id,
      quantity_used: item.quantity_used,
    }))
    const { error: itemsErr } = await svc.from('resto_recette_ingredients').insert(rows)
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  // Retourner la recette complète
  const { data: full, error: fullErr } = await svc
    .from('resto_recettes')
    .select('*, resto_recette_ingredients(quantity_used, resto_ingredients(id, name, unit, price_per_unit_fcfa))')
    .eq('id', recette.id)
    .single()

  if (fullErr) return NextResponse.json({ error: fullErr.message }, { status: 500 })
  return NextResponse.json(full, { status: 201 })
}
