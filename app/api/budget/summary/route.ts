import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/budget/summary?month=YYYY-MM
 *
 * Retourne pour le mois donné :
 *  - total revenus (entrées manuelles)
 *  - total dépenses (entrées manuelles)
 *  - détail par catégorie (dépenses)
 *  - détail par catégorie (revenus)
 *  - achats GF du mois (transactions buyer = user, status=completed)
 *  - solde wallet GF
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const month = searchParams.get('month') ?? new Date().toISOString().slice(0, 7)

  // ── 1. Entrées budget (manuelles + import GF) ──────────────────────────────
  const { data: entries, error: eErr } = await supabase
    .from('budget_entries')
    .select('type, amount_fcfa, category, source')
    .eq('user_id', user.id)
    .eq('month_key', month)

  if (eErr) return NextResponse.json({ error: eErr.message }, { status: 500 })

  const incomeEntries  = (entries ?? []).filter(e => e.type === 'income')
  const expenseEntries = (entries ?? []).filter(e => e.type === 'expense')

  const totalIncome  = incomeEntries.reduce((s, e) => s + Number(e.amount_fcfa), 0)
  const totalExpense = expenseEntries.reduce((s, e) => s + Number(e.amount_fcfa), 0)

  // Détail par catégorie
  const incomeByCategory:  Record<string, number> = {}
  const expenseByCategory: Record<string, number> = {}
  for (const e of incomeEntries)  incomeByCategory[e.category]  = (incomeByCategory[e.category]  ?? 0) + Number(e.amount_fcfa)
  for (const e of expenseEntries) expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + Number(e.amount_fcfa)

  // ── 2. Achats GF du mois (transactions acheteur) ───────────────────────────
  const startDate = `${month}-01`
  const endDate   = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)
    .toISOString().slice(0, 10)

  const { data: gfTxns } = await supabase
    .from('transactions')
    .select('id, amount_fcfa, created_at, metadata, merchants(business_name)')
    .eq('buyer_id', user.id)
    .eq('status', 'completed')
    .gte('created_at', `${startDate}T00:00:00Z`)
    .lte('created_at', `${endDate}T23:59:59Z`)
    .order('created_at', { ascending: false })

  const totalGfSpend = (gfTxns ?? []).reduce((s, t) => s + Number(t.amount_fcfa), 0)

  // ── 3. Solde wallet GF ────────────────────────────────────────────────────
  const { data: walletData } = await supabase
    .from('users')
    .select('wallet_gf')
    .eq('id', user.id)
    .single()

  return NextResponse.json({
    month,
    totalIncome,
    totalExpense,
    totalGfSpend,
    netBalance: totalIncome - totalExpense,
    incomeByCategory,
    expenseByCategory,
    walletGf: walletData?.wallet_gf ?? 0,
    gfTransactions: (gfTxns ?? []).map(t => ({
      id: t.id,
      amount_fcfa: t.amount_fcfa,
      merchant: (t.merchants as any)?.business_name ?? 'Marchand',
      date: t.created_at,
    })),
  })
}
