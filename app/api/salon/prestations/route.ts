/**
 * /api/salon/prestations — Gestion des prestations salon
 * GET  — liste les prestations avec leurs produits
 * POST — crée une prestation avec sa liste de produits
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
    .from('salon_prestations')
    .select('*, salon_prestation_products(quantity_used, salon_products(id, name, unit, package_quantity, package_cost_fcfa))')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

type PrestationItem = { product_id: string; quantity_used: number }

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const body = await req.json() as {
    name?: string
    selling_price_fcfa?: number
    duration_minutes?: number
    notes?: string
    items?: PrestationItem[]
  }

  const { name, selling_price_fcfa, duration_minutes, notes, items } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Nom de la prestation requis' }, { status: 400 })

  const svc = createServiceClient()

  // Insérer la prestation
  const { data: prestation, error: prestErr } = await svc
    .from('salon_prestations')
    .insert({
      merchant_id: merchantId,
      name: name.trim(),
      selling_price_fcfa: selling_price_fcfa ?? 0,
      duration_minutes: duration_minutes ?? 60,
      notes: notes ?? null,
    })
    .select('id')
    .single()

  if (prestErr || !prestation) return NextResponse.json({ error: prestErr?.message ?? 'Erreur création' }, { status: 500 })

  // Insérer les produits utilisés
  if (items && items.length > 0) {
    const rows = items.map((item) => ({
      prestation_id: prestation.id,
      product_id: item.product_id,
      quantity_used: item.quantity_used,
    }))
    const { error: itemsErr } = await svc.from('salon_prestation_products').insert(rows)
    if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })
  }

  // Retourner la prestation complète
  const { data: full, error: fullErr } = await svc
    .from('salon_prestations')
    .select('*, salon_prestation_products(quantity_used, salon_products(id, name, unit, package_quantity, package_cost_fcfa))')
    .eq('id', prestation.id)
    .single()

  if (fullErr) return NextResponse.json({ error: fullErr.message }, { status: 500 })
  return NextResponse.json(full, { status: 201 })
}
