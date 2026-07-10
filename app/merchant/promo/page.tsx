import { createClient, createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import ProGate from '@/components/merchant/ProGate'
import PromoClient from './PromoClient'

export default async function MerchantPromoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const svc = createServiceClient()
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, business_name, subscription_tier, subscription_expires_at, is_platform_hub')
    .eq('user_id', user.id)
    .single()

  if (!merchant) redirect('/merchant/dashboard')

  const isHub = merchant.is_platform_hub ?? false
  const tier = merchant.subscription_tier ?? 'free'
  const isActive = isHub || (
    tier !== 'free'
    && merchant.subscription_expires_at
    && new Date(merchant.subscription_expires_at) > new Date()
  )

  const { data: credits } = await svc
    .from('promo_message_credits')
    .select('balance, total_used')
    .eq('merchant_id', merchant.id)
    .maybeSingle()

  const walletBalance = await svc
    .from('merchant_wallets')
    .select('balance_fcfa')
    .eq('merchant_id', merchant.id)
    .single()
    .then(r => r.data?.balance_fcfa ?? 0)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/merchant/dashboard" className="text-brand-600 text-sm">← Tableau de bord</Link>
      </div>

      <div>
        <h1 className="text-xl font-bold text-gray-900">📣 Messages promotionnels</h1>
        <p className="text-sm text-gray-500 mt-1">
          Envoyez une offre à tous vos acheteurs passés en quelques secondes.
        </p>
      </div>

      <ProGate tier={tier as 'free' | 'standard' | 'vip'} requires="standard" featureName="Messages promotionnels" featureIcon="📣">
        <PromoClient
          merchantId={merchant.id}
          businessName={merchant.business_name}
          tierActive={!!isActive}
          balance={credits?.balance ?? 0}
          totalUsed={credits?.total_used ?? 0}
          walletBalance={walletBalance}
        />
      </ProGate>
    </div>
  )
}
