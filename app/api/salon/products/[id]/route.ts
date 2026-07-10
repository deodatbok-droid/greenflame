/**
 * /api/salon/products/[id] — Modification / suppression d'un produit
 * PATCH  — mise à jour partielle
 * DELETE — suppression
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

async function verifyOwnership(merchantId: string, productId: string): Promise<boolean> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('salon_products')
    .select('id')
    .eq('id', productId)
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
  if (!owns) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })

  const body = await req.json() as Partial<{
    name: string
    unit: string
    package_quantity: number
    package_cost_fcfa: number
  }>

  const updates: Record<string, unknown> = {}
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.unit !== undefined) updates.unit = body.unit
  if (body.package_quantity !== undefined) updates.package_quantity = body.package_quantity
  if (body.package_cost_fcfa !== undefined) updates.package_cost_fcfa = body.package_cost_fcfa
  updates.updated_at = new Date().toISOString()

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('salon_products')
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
  if (!owns) return NextResponse.json({ error: 'Produit introuvable' }, { status: 404 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('salon_products')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
