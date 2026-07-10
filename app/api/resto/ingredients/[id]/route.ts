/**
 * /api/resto/ingredients/[id] — Modification / suppression d'un ingrédient
 * PATCH  — mise à jour partielle
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

async function verifyOwnership(merchantId: string, ingredientId: string): Promise<boolean> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('resto_ingredients')
    .select('id')
    .eq('id', ingredientId)
    .eq('merchant_id', merchantId)
    .single()
  return !!data
}

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
  if (!owns) return NextResponse.json({ error: 'Ingrédient introuvable' }, { status: 404 })

  const body = await req.json() as Partial<{
    name: string
    unit: string
    price_per_unit_fcfa: number
  }>

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.unit !== undefined) updates.unit = body.unit
  if (body.price_per_unit_fcfa !== undefined) updates.price_per_unit_fcfa = body.price_per_unit_fcfa
  updates.updated_at = new Date().toISOString()

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('resto_ingredients')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
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
  if (!owns) return NextResponse.json({ error: 'Ingrédient introuvable' }, { status: 404 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('resto_ingredients')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
