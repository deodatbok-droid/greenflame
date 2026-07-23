import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import FactureClient, { type MerchantProfile, type CatalogProduct } from './FactureClient'

export default async function FacturePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [merchantRes, userRes] = await Promise.all([
    supabase
      .from('merchants')
      .select('id, business_name, address_text, city, subscription_tier, subscription_expires_at')
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('users')
      .select('phone')
      .eq('id', user.id)
      .single(),
  ])

  const merchant = merchantRes.data
  if (!merchant) redirect('/merchant/activate')

  const [appRes, productsRes] = await Promise.all([
    supabase
      .from('merchant_applications')
      .select('ifu, rccm')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from('products')
      .select('id, name, price_fcfa, emoji')
      .eq('merchant_id', merchant.id)
      .eq('is_available', true)
      .order('name')
      .limit(200),
  ])

  const tier    = merchant.subscription_tier ?? 'free'
  const expires = merchant.subscription_expires_at ? new Date(merchant.subscription_expires_at) : null
  const isPro   = tier !== 'free' && expires !== null && expires > new Date()

  const profile: MerchantProfile = {
    businessName: merchant.business_name,
    address:      merchant.address_text ?? null,
    city:         merchant.city ?? null,
    phone:        userRes.data?.phone ?? null,
    ifu:          appRes.data?.ifu ?? null,
    rccm:         appRes.data?.rccm ?? null,
  }

  const products: CatalogProduct[] = (productsRes.data ?? []).map(p => ({
    id:        p.id,
    name:      p.name,
    priceFcfa: p.price_fcfa,
    emoji:     p.emoji ?? null,
  }))

  return <FactureClient isPro={isPro} merchant={profile} products={products} />
}
