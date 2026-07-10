/**
 * /api/btp/chantiers/[id] — Chantier BTP individuel
 * PATCH  — modifie un chantier (statut, infos, remplacement optionnel des matériaux)
 * DELETE — supprime un chantier
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

type MateriauxInput = {
  nom_materiau: string
  unit: string
  quantity_needed: number
  price_per_unit_fcfa: number
  materiau_id?: string
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const { id } = await params
  const body = await req.json() as {
    client_name?: string
    client_phone?: string
    description?: string
    adresse?: string
    date_debut?: string
    date_fin_prevue?: string
    status?: string
    prix_total_fcfa?: number
    avance_versee_fcfa?: number
    notes?: string
    materiaux?: MateriauxInput[]
  }

  const { materiaux, ...chantierFields } = body

  const svc = createServiceClient()

  const { data: chantier, error: chantierErr } = await svc
    .from('btp_chantiers')
    .update({ ...chantierFields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('merchant_id', merchantId)
    .select('id')
    .single()

  if (chantierErr || !chantier) {
    return NextResponse.json({ error: chantierErr?.message ?? 'Chantier introuvable' }, { status: 500 })
  }

  // Remplacement complet des matériaux si fournis
  if (materiaux !== undefined) {
    const { error: delErr } = await svc
      .from('btp_chantier_materiaux')
      .delete()
      .eq('chantier_id', id)
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

    if (materiaux.length > 0) {
      const rows = materiaux.map((m) => ({
        chantier_id: id,
        materiau_id: m.materiau_id ?? null,
        nom_materiau: m.nom_materiau,
        unit: m.unit,
        quantity_needed: m.quantity_needed,
        price_per_unit_fcfa: m.price_per_unit_fcfa,
      }))
      const { error: insErr } = await svc.from('btp_chantier_materiaux').insert(rows)
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })
    }
  }

  const { data: full, error: fullErr } = await svc
    .from('btp_chantiers')
    .select('*, btp_chantier_materiaux(*)')
    .eq('id', id)
    .single()

  if (fullErr) return NextResponse.json({ error: fullErr.message }, { status: 500 })
  return NextResponse.json(full)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const { id } = await params

  const svc = createServiceClient()
  const { error } = await svc
    .from('btp_chantiers')
    .delete()
    .eq('id', id)
    .eq('merchant_id', merchantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
