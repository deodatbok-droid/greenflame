import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/utils/admin-guard'

export async function GET(req: NextRequest) {
  await requireAdmin()
  const svc = createServiceClient()
  const { searchParams } = new URL(req.url)
  const categorySlug = searchParams.get('category')
  const status = searchParams.get('status')
  const search = searchParams.get('q')

  // Requête sur la table products directement (inclut les produits à subscription_trigger)
  let query = svc
    .from('products')
    .select(`
      id, name, description, price_fcfa, emoji, image_url, is_available,
      stock_quantity, category, subcategory, subscription_trigger,
      created_at, marketplace_category_id,
      merchants!inner (id, business_name, subscription_tier, is_active),
      mkt_cat:marketplace_categories!marketplace_category_id (id, name, slug)
    `)
    .eq('merchants.is_active', true)
    .order('created_at', { ascending: false })
    .limit(300)

  if (categorySlug && categorySlug !== 'all') {
    const { data: cat } = await svc
      .from('marketplace_categories')
      .select('id').eq('slug', categorySlug).single()
    if (cat) query = query.eq('marketplace_category_id', cat.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let products = (data ?? []).map((p: any) => ({
    id:                 p.id,
    name:               p.name,
    description:        p.description,
    price_fcfa:         p.price_fcfa,
    emoji:              p.emoji,
    image_url:          p.image_url,
    is_available:       p.is_available,
    stock_quantity:     p.stock_quantity,
    category:           p.category,
    subscription_trigger: p.subscription_trigger,
    category_name:      p.mkt_cat?.name ?? null,
    merchant_id:        p.merchants?.id,
    business_name:      p.merchants?.business_name,
    subscription_tier:  p.merchants?.subscription_tier,
    product_created_at: p.created_at,
    ranking_score:      0,
  }))

  if (status === 'active') products = products.filter((p: any) => p.is_available)
  if (status === 'hidden') products = products.filter((p: any) => !p.is_available)
  if (search) {
    const q = search.toLowerCase()
    products = products.filter((p: any) =>
      p.name?.toLowerCase().includes(q) ||
      p.business_name?.toLowerCase().includes(q)
    )
  }

  return NextResponse.json(products)
}

export async function PATCH(req: NextRequest) {
  await requireAdmin()
  const svc = createServiceClient()
  const { product_id, is_available } = await req.json()
  if (!product_id) return NextResponse.json({ error: 'product_id requis' }, { status: 400 })
  const { error } = await svc.from('products').update({ is_available }).eq('id', product_id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
