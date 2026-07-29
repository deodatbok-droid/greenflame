import { NextRequest, NextResponse } from 'next/server'
import { getBizApiSession } from '@/lib/business/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function resolveBusinessId(requestedId?: string | null): Promise<string | null> {
  if (requestedId) return requestedId
  // Resolve from user session — return the first business they belong to
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return null
  const { data } = await auth.from('biz_members').select('business_id').eq('user_id', user.id).limit(1).maybeSingle()
  return data?.business_id ?? null
}

export async function POST(request: NextRequest) {
  const url  = new URL(request.url)
  const body = await request.json() as {
    business_id?: string
    name?: string; sku?: string; barcode?: string; unit?: string
    unit_price?: number; buy_price?: number; tax_rate?: number
    initial_stock?: number; alert_threshold?: number; gf_listed?: boolean
    category_id?: string
  }

  const businessId = await resolveBusinessId(url.searchParams.get('business_id') ?? body.business_id)
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { name, sku, barcode, unit = 'pièce', unit_price, buy_price, tax_rate = 0, initial_stock = 0, alert_threshold = 5, gf_listed = false, category_id } = body
  if (!name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const svc = createServiceClient()

  const { data: product, error: pErr } = await svc
    .from('biz_products')
    .insert({ business_id: businessId, name: name.trim(), sku: sku || null, barcode: barcode || null, unit, unit_price: unit_price ?? null, buy_price: buy_price ?? null, tax_rate, gf_listed, category_id: category_id ?? null })
    .select('id')
    .single()

  if (pErr || !product) return NextResponse.json({ error: pErr?.message ?? 'Erreur création produit' }, { status: 500 })

  await svc.from('biz_inventory').insert({
    business_id: businessId, product_id: product.id,
    quantity: initial_stock, cmup: buy_price ?? null, alert_threshold,
  })

  if (initial_stock > 0) {
    await svc.from('biz_inventory_moves').insert({
      business_id: businessId, product_id: product.id,
      move_type: 'initial', quantity: initial_stock, note: 'Stock initial',
    })
  }

  return NextResponse.json({ ok: true, product_id: product.id })
}

export async function GET(request: NextRequest) {
  const url        = new URL(request.url)
  const businessId = await resolveBusinessId(url.searchParams.get('business_id'))
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('biz_products')
    .select('id, name, sku, barcode, unit, unit_price, tax_rate, gf_listed, biz_inventory(quantity, cmup, alert_threshold)')
    .eq('business_id', businessId)
    .order('name')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
