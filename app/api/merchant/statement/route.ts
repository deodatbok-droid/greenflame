import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') // 'YYYY-MM'
  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: 'Paramètre month invalide (format: YYYY-MM)' }, { status: 400 })
  }

  const svc = createServiceClient()

  const { data: merchant } = await svc
    .from('merchants')
    .select('id, business_name, business_category, commission_rate, subscription_tier, is_platform_hub, is_active')
    .eq('user_id', user.id)
    .single()

  if (!merchant?.is_active) return NextResponse.json({ error: 'Boutique introuvable' }, { status: 403 })

  const isHub = merchant.is_platform_hub ?? false
  const isPro = isHub || ['pro', 'vip', 'agent'].includes(merchant.subscription_tier ?? '')
  if (!isPro) return NextResponse.json({ error: 'Fonctionnalité réservée aux abonnés Pro' }, { status: 403 })

  const [year, m] = month.split('-').map(Number)
  const from = new Date(year, m - 1, 1)
  const to   = new Date(year, m, 1)

  const { data: transactions } = await svc
    .from('transactions')
    .select(`
      id, amount_fcfa, commission_total, completed_at, payment_method,
      users!buyer_id (full_name, phone),
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
    items:            tx.transaction_items ?? [],
  }))

  const ca         = rows.reduce((s, t) => s + t.amount_fcfa, 0)
  const commission = rows.reduce((s, t) => s + t.commission_total, 0)
  const net        = ca - commission

  return NextResponse.json({
    merchant: {
      business_name:    merchant.business_name,
      business_category: merchant.business_category,
      commission_rate:  merchant.commission_rate,
    },
    period:       month,
    transactions: rows,
    summary:      { ca, commission, net, count: rows.length },
  })
}
