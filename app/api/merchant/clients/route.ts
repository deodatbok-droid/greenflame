import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type ClientRecord = {
  name: string
  phone: string | null
  nb_transactions_gf: number
  total_achats_gf: number
  nb_devis: number
  nb_factures: number
  total_facture_fcfa: number
  devis_acceptes: number
  factures_payees: number
  derniere_interaction: string
  source: 'gf' | 'docs' | 'both'
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  const { data: merchant } = await svc
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!merchant) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const merchantId = merchant.id

  // Acheteurs via transactions GreenFlame (completed seulement)
  const { data: txData } = await svc
    .from('transactions')
    .select('buyer_id, amount_fcfa, created_at, users!buyer_id(full_name, phone)')
    .eq('merchant_id', merchantId)
    .eq('status', 'completed')

  // Clients via devis / factures
  const { data: docData } = await svc
    .from('commercial_documents')
    .select('client_name, client_phone, type, status, total_fcfa, created_at')
    .eq('merchant_id', merchantId)
    .neq('status', 'annule')

  const map = new Map<string, ClientRecord>()

  const makeKey = (phone: string | null, fallback: string) =>
    phone ? phone.replace(/\D/g, '') : `name:${fallback}`

  // 1. Transactions GreenFlame
  for (const tx of txData ?? []) {
    const u = tx.users as unknown as { full_name: string; phone: string } | null
    if (!u) continue
    const key = makeKey(u.phone, tx.buyer_id)
    const existing = map.get(key)
    if (existing) {
      existing.nb_transactions_gf++
      existing.total_achats_gf += tx.amount_fcfa
      if (tx.created_at > existing.derniere_interaction) existing.derniere_interaction = tx.created_at
      if (existing.source === 'docs') existing.source = 'both'
    } else {
      map.set(key, {
        name:                 u.full_name,
        phone:                u.phone,
        nb_transactions_gf:   1,
        total_achats_gf:      tx.amount_fcfa,
        nb_devis:             0,
        nb_factures:          0,
        total_facture_fcfa:   0,
        devis_acceptes:       0,
        factures_payees:      0,
        derniere_interaction: tx.created_at,
        source:               'gf',
      })
    }
  }

  // 2. Devis / factures
  for (const doc of docData ?? []) {
    const key = makeKey(doc.client_phone, doc.client_name)
    const existing = map.get(key)
    if (existing) {
      if (existing.source === 'gf') existing.source = 'both'
    }
    const entry = existing ?? {
      name:                 doc.client_name,
      phone:                doc.client_phone,
      nb_transactions_gf:   0,
      total_achats_gf:      0,
      nb_devis:             0,
      nb_factures:          0,
      total_facture_fcfa:   0,
      devis_acceptes:       0,
      factures_payees:      0,
      derniere_interaction: doc.created_at,
      source:               'docs' as const,
    }

    if (doc.type === 'devis') {
      entry.nb_devis++
      if (doc.status === 'accepte') entry.devis_acceptes++
    }
    if (doc.type === 'facture') {
      entry.nb_factures++
      entry.total_facture_fcfa += doc.total_fcfa
      if (doc.status === 'paye') entry.factures_payees++
    }
    if (doc.created_at > entry.derniere_interaction) entry.derniere_interaction = doc.created_at

    if (!existing) map.set(key, entry)
  }

  return NextResponse.json(Array.from(map.values()))
}
