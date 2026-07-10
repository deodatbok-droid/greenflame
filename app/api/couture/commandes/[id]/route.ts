/**
 * /api/couture/commandes/[id] — Modification / suppression d'une commande
 * PATCH  — mise à jour partielle (statut, montants, dates, urgent, etape, accessoires)
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

async function verifyOwnership(merchantId: string, commandeId: string): Promise<boolean> {
  const svc = createServiceClient()
  const { data } = await svc
    .from('couture_commandes')
    .select('id')
    .eq('id', commandeId)
    .eq('merchant_id', merchantId)
    .single()
  return !!data
}

type AccessoireItem = {
  accessoire_id: string
  name_snapshot: string
  prix_unitaire_snapshot: number
  quantite: number
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
  if (!owns) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const body = await req.json() as Partial<{
    client_id: string | null
    client_name_snapshot: string
    modele_description: string
    tissu_metres: number
    tissu_prix_metre: number
    accessoires_fcfa: number
    main_oeuvre_fcfa: number
    prix_total_fcfa: number
    avance_versee_fcfa: number
    date_livraison: string | null
    status: 'en_cours' | 'pret' | 'livre' | 'annule'
    notes: string | null
    urgent: boolean
    etape: string | null
    accessoires_items: AccessoireItem[]
  }>

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.client_id !== undefined) updates.client_id = body.client_id
  if (body.client_name_snapshot !== undefined) updates.client_name_snapshot = body.client_name_snapshot.trim()
  if (body.modele_description !== undefined) updates.modele_description = body.modele_description.trim()
  if (body.tissu_metres !== undefined) updates.tissu_metres = body.tissu_metres
  if (body.tissu_prix_metre !== undefined) updates.tissu_prix_metre = body.tissu_prix_metre
  if (body.accessoires_fcfa !== undefined) updates.accessoires_fcfa = body.accessoires_fcfa
  if (body.main_oeuvre_fcfa !== undefined) updates.main_oeuvre_fcfa = body.main_oeuvre_fcfa
  if (body.prix_total_fcfa !== undefined) updates.prix_total_fcfa = body.prix_total_fcfa
  if (body.avance_versee_fcfa !== undefined) updates.avance_versee_fcfa = body.avance_versee_fcfa
  if (body.date_livraison !== undefined) updates.date_livraison = body.date_livraison
  if (body.status !== undefined) updates.status = body.status
  if (body.notes !== undefined) updates.notes = body.notes
  if (body.urgent !== undefined) updates.urgent = body.urgent
  if (body.etape !== undefined) updates.etape = body.etape

  const svc = createServiceClient()
  const { error: updateErr } = await svc
    .from('couture_commandes')
    .update(updates)
    .eq('id', id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  // Resync accessories if provided (null = don't touch, [] = clear all)
  if (body.accessoires_items !== undefined) {
    await svc.from('couture_commande_accessoires').delete().eq('commande_id', id)
    if (body.accessoires_items.length > 0) {
      const rows = body.accessoires_items.map((it) => ({
        commande_id: id,
        accessoire_id: it.accessoire_id || null,
        name_snapshot: it.name_snapshot,
        prix_unitaire_snapshot: it.prix_unitaire_snapshot,
        quantite: it.quantite,
      }))
      const { error: accErr } = await svc.from('couture_commande_accessoires').insert(rows)
      if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 })
    }
  }

  const { data, error } = await svc
    .from('couture_commandes')
    .select('*, couture_clients(full_name, phone), couture_commande_accessoires(*), couture_retouches(*)')
    .eq('id', id)
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
  if (!owns) return NextResponse.json({ error: 'Commande introuvable' }, { status: 404 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('couture_commandes')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
