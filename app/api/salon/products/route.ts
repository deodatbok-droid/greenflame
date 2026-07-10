/**
 * /api/salon/products — Bibliothèque de produits salon
 * GET  — liste les produits du marchand
 * POST — crée un nouveau produit
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
    .from('salon_products')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const merchantId = await getMerchantId(user.id)
  if (!merchantId) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const body = await req.json() as {
    name?: string
    unit?: string
    package_quantity?: number
    package_cost_fcfa?: number
  }

  const { name, unit, package_quantity, package_cost_fcfa } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nom du produit requis' }, { status: 400 })
  if (!package_quantity || package_quantity <= 0) return NextResponse.json({ error: 'Quantité invalide' }, { status: 400 })
  if (package_cost_fcfa === undefined || package_cost_fcfa < 0) return NextResponse.json({ error: 'Coût invalide' }, { status: 400 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('salon_products')
    .insert({
      merchant_id: merchantId,
      name: name.trim(),
      unit: unit ?? 'mL',
      package_quantity,
      package_cost_fcfa,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
