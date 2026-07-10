import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface MonthData {
  month: string          // 'YYYY-MM'
  ca: number             // Chiffre d'affaires brut (montant total encaissé)
  commission: number     // Frais GreenFlame (commission_total)
  net: number            // Revenu net marchand (ca - commission)
  count: number          // Nombre de transactions
  byMethod: Record<string, number>  // CA par méthode de paiement
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  // Récupérer le marchand
  const { data: merchant } = await svc
    .from('merchants')
    .select('id, commission_rate, is_active, total_gmv')
    .eq('user_id', user.id)
    .single()

  if (!merchant?.is_active) {
    return NextResponse.json({ error: 'Boutique introuvable' }, { status: 403 })
  }

  // 12 derniers mois de transactions complétées
  const since = new Date()
  since.setFullYear(since.getFullYear() - 1)
  since.setDate(1)
  since.setHours(0, 0, 0, 0)

  const { data: transactions, error } = await svc
    .from('transactions')
    .select('amount_fcfa, commission_total, completed_at, payment_method')
    .eq('merchant_id', merchant.id)
    .eq('status', 'completed')
    .gte('completed_at', since.toISOString())
    .order('completed_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Groupement par mois (JS-level)
  const byMonth = new Map<string, MonthData>()

  for (const tx of transactions ?? []) {
    const date = new Date(tx.completed_at)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`

    if (!byMonth.has(key)) {
      byMonth.set(key, { month: key, ca: 0, commission: 0, net: 0, count: 0, byMethod: {} })
    }

    const m = byMonth.get(key)!
    m.ca         += tx.amount_fcfa
    m.commission += tx.commission_total ?? 0
    m.net        += tx.amount_fcfa - (tx.commission_total ?? 0)
    m.count++
    m.byMethod[tx.payment_method] = (m.byMethod[tx.payment_method] ?? 0) + tx.amount_fcfa
  }

  const months = Array.from(byMonth.values())
    .sort((a, b) => b.month.localeCompare(a.month))

  // Totaux globaux (all-time)
  const totals = {
    ca:         merchant.total_gmv ?? 0,
    commission: Math.floor((merchant.total_gmv ?? 0) * merchant.commission_rate),
    net:        Math.floor((merchant.total_gmv ?? 0) * (1 - merchant.commission_rate)),
  }

  return NextResponse.json({
    months,
    commissionRate: merchant.commission_rate,
    totals,
  })
}
