/**
 * /api/couture/clients/[id] — Modification / suppression d'un client couture
 * PATCH  — mise à jour partielle (mesures + infos de base)
 * DELETE — suppression après vérification de propriété
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

async function verifyOwnership(merchantId: string, clientId: string): Promise<boolean> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('couture_clients')
    .select('id')
    .eq('id', clientId)
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
  if (!owns) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const body = await req.json() as Partial<{
    full_name: string
    phone: string | null
    tour_poitrine: number | null
    tour_taille: number | null
    tour_hanches: number | null
    longueur_dos: number | null
    longueur_robe: number | null
    longueur_pantalon: number | null
    epaules: number | null
    longueur_manche: number | null
    tour_cou: number | null
    notes: string | null
  }>

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.full_name !== undefined) updates.full_name = body.full_name.trim()
  if (body.phone !== undefined) updates.phone = body.phone
  if (body.tour_poitrine !== undefined) updates.tour_poitrine = body.tour_poitrine
  if (body.tour_taille !== undefined) updates.tour_taille = body.tour_taille
  if (body.tour_hanches !== undefined) updates.tour_hanches = body.tour_hanches
  if (body.longueur_dos !== undefined) updates.longueur_dos = body.longueur_dos
  if (body.longueur_robe !== undefined) updates.longueur_robe = body.longueur_robe
  if (body.longueur_pantalon !== undefined) updates.longueur_pantalon = body.longueur_pantalon
  if (body.epaules !== undefined) updates.epaules = body.epaules
  if (body.longueur_manche !== undefined) updates.longueur_manche = body.longueur_manche
  if (body.tour_cou !== undefined) updates.tour_cou = body.tour_cou
  if (body.notes !== undefined) updates.notes = body.notes

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('couture_clients')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const owns = await verifyOwnership(merchantId, id)
  if (!owns) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('couture_clients')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
