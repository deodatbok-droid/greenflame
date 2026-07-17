import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import BudgetClient from './BudgetClient'

export const metadata = { title: 'Mon Budget — GreenFlame' }

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/budget')

  const { month: rawMonth } = await searchParams
  const today = new Date()
  const month = rawMonth ?? `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  // Chargement initial côté serveur
  const startDate = `${month}-01`
  const lastDay   = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
  const endDate   = lastDay.toISOString().slice(0, 10)

  const [entriesRes, limitsRes, goalsRes, walletRes, gfTxnRes] = await Promise.all([
    supabase
      .from('budget_entries')
      .select('*')
      .eq('user_id', user.id)
      .eq('month_key', month)
      .order('entry_date', { ascending: false }),

    supabase
      .from('budget_limits')
      .select('*')
      .eq('user_id', user.id),

    supabase
      .from('savings_goals')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['active', 'paused'])
      .order('created_at', { ascending: false }),

    supabase
      .from('users')
      .select('wallet_gf')
      .eq('id', user.id)
      .single(),

    supabase
      .from('transactions')
      .select('id, amount_fcfa, created_at, metadata, merchants(business_name)')
      .eq('buyer_id', user.id)
      .eq('status', 'completed')
      .gte('created_at', `${startDate}T00:00:00Z`)
      .lte('created_at', `${endDate}T23:59:59Z`)
      .order('created_at', { ascending: false }),
  ])

  return (
    <BudgetClient
      initialMonth={month}
      initialEntries={entriesRes.data ?? []}
      initialLimits={limitsRes.data ?? []}
      initialGoals={goalsRes.data ?? []}
      walletGf={walletRes.data?.wallet_gf ?? 0}
      initialGfTxns={(gfTxnRes.data ?? []).map((t: any) => ({
        id:         t.id,
        amount_fcfa:t.amount_fcfa,
        merchant:   t.merchants?.business_name ?? 'Marchand GreenFlame',
        date:       t.created_at,
      }))}
    />
  )
}
