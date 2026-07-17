import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ClientCreditAlert from '@/components/merchant/ClientCreditAlert'
import MerchantDashboardClient from './MerchantDashboardClient'

export default async function MerchantDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!merchant) redirect('/dashboard')

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)

  const [personalWalletRes, merchantWalletRes, monthTxRes, todayTxRes, userRes, allTimeTxRes, productCountRes] = await Promise.all([
    // Wallet perso : cashback + commissions réseau + GFP
    supabase
      .from('wallets')
      .select('balance_fcfa, balance_gfp, total_earned_fcfa')
      .eq('user_id', user.id)
      .single(),
    // Wallet boutique : revenus ventes + float agent
    supabase
      .from('merchant_wallets')
      .select('balance_fcfa, total_earned_fcfa, total_withdrawn_fcfa')
      .eq('merchant_id', merchant.id)
      .single(),
    supabase
      .from('transactions')
      .select('amount_fcfa, commission_total, buyer_id, payment_method')
      .eq('merchant_id', merchant.id)
      .eq('status', 'completed')
      .gte('created_at', startOfMonth.toISOString()),
    supabase
      .from('transactions')
      .select('amount_fcfa, commission_total, buyer_id, payment_method')
      .eq('merchant_id', merchant.id)
      .eq('status', 'completed')
      .gte('created_at', startOfDay.toISOString()),
    supabase
      .from('users')
      .select('referral_code, role')
      .eq('id', user.id)
      .single(),
    // Ventilation all-time par méthode de paiement
    supabase
      .from('transactions')
      .select('amount_fcfa, payment_method')
      .eq('merchant_id', merchant.id)
      .eq('status', 'completed'),
    // Checklist activation : nombre de produits listés
    supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchant.id),
  ])

  const personalWallet  = personalWalletRes.data
  const merchantWallet  = merchantWalletRes.data
  const monthTxs        = monthTxRes.data ?? []
  const todayTxs        = todayTxRes.data ?? []
  const allTimeTxs      = allTimeTxRes.data ?? []

  const activationSteps = {
    hasProducts:  (productCountRes.count ?? 0) > 0,
    hasQrSaved:   !!merchant.qr_code_url,
    hasFirstSale: merchant.total_gmv > 0,
  }

  const monthGmv        = monthTxs.reduce((s, t) => s + t.amount_fcfa, 0)
  const monthCommission = monthTxs.reduce((s, t) => s + t.commission_total, 0)
  const todayGmv        = todayTxs.reduce((s, t) => s + t.amount_fcfa, 0)
  const todayCommission = todayTxs.reduce((s, t) => s + t.commission_total, 0)

  // Ventilation all-time par méthode de paiement
  const revenueByMethod = allTimeTxs.reduce(
    (acc, t) => {
      const method = t.payment_method as string
      if (method === 'cash_confirmed') acc.cash += t.amount_fcfa
      else if (method === 'wallet_gf')  acc.walletGf += t.amount_fcfa
      else if (method === 'mtn_momo' || method === 'moov_money' || method === 'celtiis') acc.momo += t.amount_fcfa
      return acc
    },
    { cash: 0, walletGf: 0, momo: 0 }
  )

  // Acheteurs uniques ce mois (communauté)
  const buyerMap = new Map<string, { totalGenerated: number; purchaseCount: number }>()
  for (const tx of monthTxs) {
    const existing = buyerMap.get(tx.buyer_id) ?? { totalGenerated: 0, purchaseCount: 0 }
    buyerMap.set(tx.buyer_id, {
      totalGenerated: existing.totalGenerated + tx.commission_total,
      purchaseCount: existing.purchaseCount + 1,
    })
  }

  const uniqueBuyerIds = Array.from(buyerMap.keys())
  let recentBuyers: Array<{ buyerId: string; name: string; purchaseCount: number; totalGenerated: number }> = []

  if (uniqueBuyerIds.length > 0) {
    const { data: buyerProfiles } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', uniqueBuyerIds)

    recentBuyers = (buyerProfiles ?? []).map(b => ({
      buyerId: b.id,
      name: b.full_name ?? 'Client',
      purchaseCount: buyerMap.get(b.id)?.purchaseCount ?? 0,
      totalGenerated: buyerMap.get(b.id)?.totalGenerated ?? 0,
    })).sort((a, b) => b.totalGenerated - a.totalGenerated)
  }

  // Clients avec crédit (pour l'alerte)
  const recentBuyerIds = Array.from(new Set(todayTxs.map(t => t.buyer_id)))
  let clientsWithCredit: Array<{ userId: string; fullName: string; balance: number }> = []
  if (recentBuyerIds.length > 0) {
    const { data: buyerWallets } = await supabase
      .from('wallets')
      .select('user_id, balance_fcfa, users(full_name)')
      .in('user_id', recentBuyerIds)
      .gt('balance_fcfa', 0)

    clientsWithCredit = (buyerWallets ?? []).map(w => ({
      userId: w.user_id,
      fullName: (w.users as unknown as { full_name: string } | null)?.full_name ?? 'Client',
      balance: w.balance_fcfa,
    }))
  }

  const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenflame.africa'
  const referralCode = userRes.data?.referral_code ?? ''
  const referralUrl  = `${appUrl}/register?ref=${referralCode}`
  const isAdmin      = userRes.data?.role?.includes('admin') || userRes.data?.role?.includes('platform_upline')

  return (
    <>
      {clientsWithCredit.length > 0 && (
        <div className="max-w-4xl mx-auto px-4 pt-4">
          <ClientCreditAlert clients={clientsWithCredit} />
        </div>
      )}
      <MerchantDashboardClient
        merchant={{
          id: merchant.id,
          business_name: merchant.business_name,
          business_category: merchant.business_category,
          is_verified: merchant.is_verified,
          commission_rate: merchant.commission_rate,
          total_gmv: merchant.total_gmv,
          qr_code_url: merchant.qr_code_url ?? null,
          banner_url: merchant.banner_url ?? null,
          subscription_tier: merchant.subscription_tier ?? 'free',
          subscription_expires_at: merchant.subscription_expires_at ?? null,
          agent_service_active: merchant.agent_service_active ?? false,
          is_platform_hub: merchant.is_platform_hub ?? false,
        }}
        revenueByMethod={revenueByMethod}
        merchantWallet={merchantWallet ? { balance_fcfa: merchantWallet.balance_fcfa, total_earned_fcfa: merchantWallet.total_earned_fcfa } : null}
        personalWallet={personalWallet ? { balance_fcfa: personalWallet.balance_fcfa, balance_gfp: personalWallet.balance_gfp } : null}
        monthStats={{
          count: monthTxs.length,
          gmv: monthGmv,
          commission: monthCommission,
          netRevenue: monthGmv - monthCommission,
        }}
        todayStats={{
          count: todayTxs.length,
          gmv: todayGmv,
          commission: todayCommission,
        }}
        recentBuyers={recentBuyers}
        referralUrl={referralUrl}
        merchantUserId={user.id}
        isAdmin={isAdmin ?? false}
        activationSteps={activationSteps}
      />
    </>
  )
}
