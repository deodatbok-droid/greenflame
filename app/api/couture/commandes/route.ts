/**
 * /api/couture/commandes — Tableau des commandes couture
 * GET  — liste les commandes du marchand (avec infos client + accessoires)
 * POST — crée une nouvelle commande
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
    .from('couture_commandes')
    .select('*, couture_clients(full_name, phone), couture_commande_accessoires(*), couture_retouches(*)')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

type AccessoireItem = {
  accessoire_id: string
  name_snapshot: string
  prix_unitaire_snapshot: number
  quantite: number
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const body = await req.json() as {
    client_id?: string | null
    client_name_snapshot?: string
    modele_description?: string
    tissu_metres?: number
    tissu_prix_metre?: number
    accessoires_fcfa?: number
    main_oeuvre_fcfa?: number
    prix_total_fcfa?: number
    avance_versee_fcfa?: number
    date_livraison?: string | null
    notes?: string | null
    urgent?: boolean
    etape?: string | null
    accessoires_items?: AccessoireItem[]
  }

  if (!body.client_name_snapshot?.trim()) {
    return NextResponse.json({ error: 'Nom du client requis' }, { status: 400 })
  }
  if (!body.modele_description?.trim()) {
    return NextResponse.json({ error: 'Description du modèle requise' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data: cmd, error: cmdErr } = await svc
    .from('couture_commandes')
    .insert({
      merchant_id: merchantId,
      client_id: body.client_id ?? null,
      client_name_snapshot: body.client_name_snapshot.trim(),
      modele_description: body.modele_description.trim(),
      tissu_metres: body.tissu_metres ?? 0,
      tissu_prix_metre: body.tissu_prix_metre ?? 0,
      accessoires_fcfa: body.accessoires_fcfa ?? 0,
      main_oeuvre_fcfa: body.main_oeuvre_fcfa ?? 0,
      prix_total_fcfa: body.prix_total_fcfa ?? 0,
      avance_versee_fcfa: body.avance_versee_fcfa ?? 0,
      date_livraison: body.date_livraison ?? null,
      notes: body.notes ?? null,
      urgent: body.urgent ?? false,
      etape: body.etape ?? null,
    })
    .select('id')
    .single()

  if (cmdErr) return NextResponse.json({ error: cmdErr.message }, { status: 500 })

  if (body.accessoires_items && body.accessoires_items.length > 0) {
    const rows = body.accessoires_items.map((it) => ({
      commande_id: cmd.id,
      accessoire_id: it.accessoire_id || null,
      name_snapshot: it.name_snapshot,
      prix_unitaire_snapshot: it.prix_unitaire_snapshot,
      quantite: it.quantite,
    }))
    const { error: accErr } = await svc.from('couture_commande_accessoires').insert(rows)
    if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 })
  }

  const { data, error } = await svc
    .from('couture_commandes')
    .select('*, couture_clients(full_name, phone), couture_commande_accessoires(*)')
    .eq('id', cmd.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
