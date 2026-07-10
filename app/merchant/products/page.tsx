import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProductsClient from './ProductsClient'

const FREE_PRODUCT_LIMIT = 10

export default async function MerchantProductsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('subscription_tier, subscription_expires_at, is_platform_hub')
    .eq('user_id', user.id)
    .single()

  if (!merchant) redirect('/merchant/activate')

  const tier = merchant.subscription_tier ?? 'free'
  const expires = merchant.subscription_expires_at
    ? new Date(merchant.subscription_expires_at)
    : null
  // VIP only gets unlimited products; Standard (tous les autres) = 10 produits
  const isVip = tier === 'vip' && expires !== null && expires > new Date()
  const activeTier: 'free' | 'pro' | 'vip' = isVip ? 'vip' : 'free'

  return (
    <div>
      <div className="px-4 pt-4 pb-1">
        <Link href="/merchant/dashboard" className="text-sm text-brand-600 flex items-center gap-1">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" /></svg>
          Dashboard
        </Link>
      </div>
      <ProductsClient
        tier={activeTier}
        productLimit={isVip || (merchant.is_platform_hub ?? false) ? Infinity : FREE_PRODUCT_LIMIT}
        isHub={merchant.is_platform_hub ?? false}
      />
    </div>
  )
}
