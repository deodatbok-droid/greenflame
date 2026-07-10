/**
 * /api/resto/ingredients — Bibliothèque d'ingrédients restauration
 * GET  — liste les ingrédients du marchand, triés par nom
 * POST — crée un nouvel ingrédient
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
    .from('resto_ingredients')
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

  const { name, unit, price_per_unit_fcfa } = body

  if (!name?.trim()) return NextResponse.json({ error: 'Nom de l\'ingrédient requis' }, { status: 400 })
  if (price_per_unit_fcfa === undefined || price_per_unit_fcfa < 0) {
    return NextResponse.json({ error: 'Prix invalide' }, { status: 400 })
  }

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('resto_ingredients')
    .insert({
      merchant_id: merchantId,
      name: name.trim(),
      unit: unit ?? 'kg',
      price_per_unit_fcfa,
    })
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
