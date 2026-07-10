import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  const { data: wallet } = await supabase
    .from('wallet_summary')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (!wallet) {
    return NextResponse.json({ error: 'Wallet non trouve' }, { status: 404 })
  }

  const [ledgerRes, networkRes] = await Promise.all([
    supabase
      .from('wallet_ledger')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('network_tree')
      .select('*')
      .eq('user_id', user.id)
      .single(),
  ])

  const ledger = ledgerRes.data
  const { data: network } = networkRes

  // Compter les membres du reseau direct
  const { count: directCount } = await supabase
    .from('network_tree')
    .select('*', { count: 'exact', head: true })
    .eq('l1_upline', user.id)

  // Commissions du mois en cours
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { data: monthlyCommissions } = await supabase
    .from('commission_distributions')
    .select('amount_fcfa')
    .eq('recipient_id', user.id)
    .eq('distribution_type', 'network')
    .gte('created_at', startOfMonth.toISOString())

  const monthlyTotal = monthlyCommissions?.reduce((sum, c) => sum + c.amount_fcfa, 0) ?? 0

  return NextResponse.json({
    wallet,
    ledger: ledger ?? [],
    network,
    stats: {
      directMembersCount: directCount ?? 0,
      monthlyCommissions: monthlyTotal,
    },
  })
}
