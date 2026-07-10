import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import MerchantStatementClient from './MerchantStatementClient'

interface PageProps {
  searchParams: Promise<{ month?: string }>
}

export default async function MerchantStatementPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const month = params.month ?? new Date().toISOString().slice(0, 7)

  if (!/^\d{4}-\d{2}$/.test(month)) redirect('/merchant/dashboard')

  const svc = createServiceClient()
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, business_name, business_category, commission_rate, subscription_tier, is_platform_hub, is_active, is_verified')
    .eq('user_id', user.id)
    .single()

  if (!merchant?.is_active) redirect('/merchant/dashboard')

  const isHub = merchant.is_platform_hub ?? false
  const isPro = isHub || ['pro', 'vip', 'agent'].includes(merchant.subscription_tier ?? '')
  if (!isPro) redirect('/merchant/upgrade')

  const [year, m] = month.split('-').map(Number)
  const from = new Date(year, m - 1, 1)
  const to   = new Date(year, m, 1)

  const { data: transactions } = await svc
    .from('transactions')
    .select(`
      id, amount_fcfa, commission_total, completed_at, payment_method,
      users!buyer_id (full_name),
      transaction_items (product_name, quantity, unit_price_fcfa)
    `)
    .eq('merchant_id', merchant.id)
    .eq('status', 'completed')
    .gte('completed_at', from.toISOString())
    .lt('completed_at', to.toISOString())
    .order('completed_at', { ascending: true })

  const rows = (transactions ?? []).map((tx: any) => ({
    id:               tx.id,
    completed_at:     tx.completed_at,
    amount_fcfa:      tx.amount_fcfa,
    commission_total: tx.commission_total,
    net_fcfa:         tx.amount_fcfa - tx.commission_total,
    payment_method:   tx.payment_method,
    buyer_name:       tx.users?.full_name ?? 'Client',
    items:            (tx.transaction_items ?? []) as { product_name: string; quantity: number; unit_price_fcfa: number }[],
  }))

  const ca         = rows.reduce((s, t) => s + t.amount_fcfa, 0)
  const commission = rows.reduce((s, t) => s + t.commission_total, 0)

  return (
    <MerchantStatementClient
      merchant={{
        business_name:     merchant.business_name,
        business_category: merchant.business_category,
        commission_rate:   merchant.commission_rate,
        is_verified:       merchant.is_verified ?? false,
      }}
      period={month}
      transactions={rows}
      summary={{ ca, commission, net: ca - commission, count: rows.length }}
    />
  )
}
