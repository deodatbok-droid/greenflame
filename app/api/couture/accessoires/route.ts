/**
 * /api/couture/accessoires — Catalogue d'accessoires couture
 * GET  — liste les accessoires du marchand
 * POST — crée un accessoire
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
    .from('couture_accessoires')
    .select('*')
    .eq('merchant_id', merchantId)
    .order('name')

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
    price_per_unit_fcfa?: number
  }

  if (!body.name?.trim()) {
    return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('couture_accessoires')
    .insert({
      merchant_id: merchantId,
      name: body.name.trim(),
      unit: body.unit?.trim() || 'pièce',
      price_per_unit_fcfa: body.price_per_unit_fcfa ?? 0,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
