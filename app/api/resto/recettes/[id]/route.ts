/**
 * /api/resto/recettes/[id] — Modification / suppression d'une recette
 * PATCH  — mise à jour (champs + ingrédients)
 * DELETE — suppression (cascade via FK)
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

async function verifyOwnership(merchantId: string, recetteId: string): Promise<boolean> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('resto_recettes')
    .select('id')
    .eq('id', recetteId)
    .eq('merchant_id', merchantId)
    .single()
  return !!data
}

type RecetteItem = { ingredient_id: string; quantity_used: number }

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const owns = await verifyOwnership(merchantId, id)
  if (!owns) return NextResponse.json({ error: 'Recette introuvable' }, { status: 404 })

  const body = await req.json() as Partial<{
    name: string
    portions: number
    selling_price_per_portion_fcfa: number
    category: string
    notes: string
    items: RecetteItem[]
  }>

  const svc = createServiceClient()

  // Mettre à jour les champs scalaires
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.portions !== undefined) updates.portions = body.portions
  if (body.selling_price_per_portion_fcfa !== undefined) {
    updates.selling_price_per_portion_fcfa = body.selling_price_per_portion_fcfa
  }
  if (body.category !== undefined) updates.category = body.category
  if (body.notes !== undefined) updates.notes = body.notes

  const { error: updateErr } = await svc
    .from('resto_recettes')
    .update(updates)
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Si les items sont fournis, remplacer les ingrédients
  if (body.items !== undefined) {
    const { error: delErr } = await svc
      .from('resto_recette_ingredients')
      .delete()
      .eq('recette_id', id)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    if (body.items.length > 0) {
      const rows = body.items.map((item) => ({
        recette_id: id,
        ingredient_id: item.ingredient_id,
        quantity_used: item.quantity_used,
      }))
      const { error: insErr } = await svc.from('resto_recette_ingredients').insert(rows)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  // Retourner la recette complète mise à jour
  const { data: full, error: fullErr } = await svc
    .from('resto_recettes')
    .select('*, resto_recette_ingredients(quantity_used, resto_ingredients(id, name, unit, price_per_unit_fcfa))')
    .eq('id', id)
    .single()

  if (fullErr) return NextResponse.json({ error: fullErr.message }, { status: 500 })
  return NextResponse.json(full)
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const owns = await verifyOwnership(merchantId, id)
  if (!owns) return NextResponse.json({ error: 'Recette introuvable' }, { status: 404 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('resto_recettes')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
