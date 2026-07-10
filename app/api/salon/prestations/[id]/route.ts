/**
 * /api/salon/prestations/[id] — Modification / suppression d'une prestation
 * PATCH  — mise à jour (nom, prix, produits utilisés)
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

async function verifyOwnership(merchantId: string, prestationId: string): Promise<boolean> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('salon_prestations')
    .select('id')
    .eq('id', prestationId)
    .eq('merchant_id', merchantId)
    .single()
  return !!data
}

type PrestationItem = { product_id: string; quantity_used: number }

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
  if (!owns) return NextResponse.json({ error: 'Prestation introuvable' }, { status: 404 })

  const body = await req.json() as Partial<{
    name: string
    selling_price_fcfa: number
    duration_minutes: number
    notes: string
    items: PrestationItem[]
  }>

  const svc = createServiceClient()

  // Mettre à jour les champs scalaires
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) updates.name = body.name.trim()
  if (body.selling_price_fcfa !== undefined) updates.selling_price_fcfa = body.selling_price_fcfa
  if (body.duration_minutes !== undefined) updates.duration_minutes = body.duration_minutes
  if (body.notes !== undefined) updates.notes = body.notes

  const { error: updateErr } = await svc
    .from('salon_prestations')
    .update(updates)
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Si les items sont fournis, remplacer les produits
  if (body.items !== undefined) {
    const { error: delErr } = await svc
      .from('salon_prestation_products')
      .delete()
      .eq('prestation_id', id)

    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    if (body.items.length > 0) {
      const rows = body.items.map((item) => ({
        prestation_id: id,
        product_id: item.product_id,
        quantity_used: item.quantity_used,
      }))
      const { error: insErr } = await svc.from('salon_prestation_products').insert(rows)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  // Retourner la prestation complète mise à jour
  const { data: full, error: fullErr } = await svc
    .from('salon_prestations')
    .select('*, salon_prestation_products(quantity_used, salon_products(id, name, unit, package_quantity, package_cost_fcfa))')
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
  if (!owns) return NextResponse.json({ error: 'Prestation introuvable' }, { status: 404 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('salon_prestations')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
