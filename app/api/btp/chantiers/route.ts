/**
 * /api/btp/chantiers — Gestion des chantiers BTP
 * GET  — liste les chantiers avec leurs matériaux imbriqués
 * POST — crée un chantier avec sa liste de matériaux optionnelle
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
    .from('btp_chantiers')
    .select('*, btp_chantier_materiaux(*)')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

type MateriauxInput = {
  nom_materiau: string
  unit: string
  quantity_needed: number
  price_per_unit_fcfa: number
  materiau_id?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const body = await req.json() as {
    client_name?: string
    client_phone?: string
    description?: string
    adresse?: string
    date_debut?: string
    date_fin_prevue?: string
    prix_total_fcfa?: number
    avance_versee_fcfa?: number
    notes?: string
    materiaux?: MateriauxInput[]
  }

  const {
    client_name, client_phone, description, adresse,
    date_debut, date_fin_prevue, prix_total_fcfa,
    avance_versee_fcfa, notes, materiaux,
  } = body

  if (!client_name?.trim()) return NextResponse.json({ error: 'Nom du client requis' }, { status: 400 })
  if (!description?.trim()) return NextResponse.json({ error: 'Description du chantier requise' }, { status: 400 })

  const svc = createServiceClient()

  const { data: chantier, error: chantierErr } = await svc
    .from('btp_chantiers')
    .insert({
      merchant_id: merchantId,
      client_name: client_name.trim(),
      client_phone: client_phone ?? null,
      description: description.trim(),
      adresse: adresse ?? null,
      date_debut: date_debut ?? null,
      date_fin_prevue: date_fin_prevue ?? null,
      prix_total_fcfa: prix_total_fcfa ?? 0,
      avance_versee_fcfa: avance_versee_fcfa ?? 0,
      notes: notes ?? null,
    })
    .select('id')
    .single()

  if (chantierErr || !chantier) {
    return NextResponse.json({ error: chantierErr?.message ?? 'Erreur création' }, { status: 500 })
  }

  if (materiaux && materiaux.length > 0) {
    const rows = materiaux.map((m) => ({
      chantier_id: chantier.id,
      materiau_id: m.materiau_id ?? null,
      nom_materiau: m.nom_materiau,
      unit: m.unit,
      quantity_needed: m.quantity_needed,
      price_per_unit_fcfa: m.price_per_unit_fcfa,
    }))
    const { error: matErr } = await svc.from('btp_chantier_materiaux').insert(rows)
    if (matErr) return NextResponse.json({ error: matErr.message }, { status: 500 })
  }

  const { data: full, error: fullErr } = await svc
    .from('btp_chantiers')
    .select('*, btp_chantier_materiaux(*)')
    .eq('id', chantier.id)
    .single()

  if (fullErr) return NextResponse.json({ error: fullErr.message }, { status: 500 })
  return NextResponse.json(full, { status: 201 })
}
