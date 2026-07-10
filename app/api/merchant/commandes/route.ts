import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  const { data: merchant } = await svc
    .from('merchants')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!merchant) return NextResponse.json({ error: 'Marchand introuvable' }, { status: 404 })

  const { data: transactions } = await svc
    .from('transactions')
    .select(`
      id, created_at, amount_fcfa, commission_total, payment_method, status,
      users!buyer_id (full_name, phone),
      transaction_items (product_name, quantity, unit_price_fcfa, emoji)
    `)
    .eq('merchant_id', merchant.id)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(30)

  const rows = (transactions ?? []).map((tx: any) => ({
    id: tx.id,
    created_at: tx.created_at,
    amount_fcfa: tx.amount_fcfa,
    commission_total: tx.commission_total,
    net_fcfa: tx.amount_fcfa - tx.commission_total,
    payment_method: tx.payment_method,
    buyer_name: tx.users?.full_name ?? 'Client',
    buyer_phone: tx.users?.phone ?? null,
    items: tx.transaction_items ?? [],
  }))

  return NextResponse.json({ transactions: rows })
}
