import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import PlatformChartsClient from './PlatformChartsClient'

// ── Types exportés vers le client ─────────────────────────────────────────────
export type MonthlyTrendDatum = {
  label: string
  gmv: number
  net: number
  commission: number
  txCount: number
  newUsers: number
}

export type PaymentDistDatum = {
  method: string
  count: number
  gmv: number
  pct: number
}

export type LeaderboardEntry = {
  id: string
  name: string
  sector: string | null
  gmv: number
  txCount: number
  netRev: number
}

export type SectorPerfDatum = {
  sector: string
  gmv: number
  txCount: number
}

export type NetworkEffectDatum = {
  label: string
  gmv: number
  count: number
  pct: number
}

export type PlatformRetentionDatum = {
  label: string
  newBuyers: number
  returning: number
  retentionRate: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `${Math.round(n / 1_000)}k`
  return n.toLocaleString('fr-FR')
}

const SECTOR_LABELS: Record<string, string> = {
  consultant: 'Consultant', avocat: 'Avocat', photographe: 'Photo',
  transporteur: 'Transport', medecin: 'Santé', coach: 'Coach',
  evenement: 'Événements', imprimerie: 'Imprimerie', autre: 'Autre',
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function PlatformAnalyticsPage() {
  // Auth check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  if (!isAdmin) redirect('/admin/dashboard')

  const svc = createServiceClient()
  const now = new Date()
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const monthStart   = new Date(now.getFullYear(), now.getMonth(), 1)

  // ── Requêtes parallèles ────────────────────────────────────────────────────
  const [txsRes, merchantsRes, usersRes] = await Promise.all([
    svc
      .from('transactions')
      .select('id, amount_fcfa, commission_total, created_at, buyer_id, payment_method, merchant_id')
      .eq('status', 'completed')
      .gte('created_at', sixMonthsAgo.toISOString()),
    svc.from('merchants').select('id, business_name, sector, subscription_tier').eq('is_active', true),
    svc.from('users').select('id, created_at, upline_id').gte('created_at', sixMonthsAgo.toISOString()),
  ])

  const allTxs       = txsRes.data       ?? []
  const allMerchants = merchantsRes.data ?? []
  const recentUsers  = usersRes.data     ?? []

  const merchantMap = new Map(allMerchants.map(m => [m.id, m]))

  // ── Tendance mensuelle (6 mois) ───────────────────────────────────────────
  const monthlyTrend: MonthlyTrendDatum[] = []
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const label = start.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    const slice = allTxs.filter(t => { const d = new Date(t.created_at); return d >= start && d < end })
    const newUsr = recentUsers.filter(u => { const d = new Date(u.created_at); return d >= start && d < end }).length
    monthlyTrend.push({
      label,
      gmv:        slice.reduce((s, t) => s + t.amount_fcfa, 0),
      net:        slice.reduce((s, t) => s + t.amount_fcfa - t.commission_total, 0),
      commission: slice.reduce((s, t) => s + t.commission_total, 0),
      txCount:    slice.length,
      newUsers:   newUsr,
    })
  }

  // ── Répartition méthodes de paiement ──────────────────────────────────────
  const methodAgg: Record<string, { count: number; gmv: number }> = {}
  for (const tx of allTxs) {
    const m = tx.payment_method ?? 'autre'
    if (!methodAgg[m]) methodAgg[m] = { count: 0, gmv: 0 }
    methodAgg[m].count++
    methodAgg[m].gmv += tx.amount_fcfa
  }
  const paymentDistribution: PaymentDistDatum[] = Object.entries(methodAgg)
    .map(([method, d]) => ({
      method,
      count: d.count,
      gmv:   d.gmv,
      pct:   allTxs.length > 0 ? Math.round((d.count / allTxs.length) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  // ── Leaderboard marchands (ce mois) ───────────────────────────────────────
  const thisMthTxs = allTxs.filter(t => new Date(t.created_at) >= monthStart)
  const leaderAgg: Record<string, { gmv: number; txCount: number; netRev: number }> = {}
  for (const tx of thisMthTxs) {
    if (!leaderAgg[tx.merchant_id]) leaderAgg[tx.merchant_id] = { gmv: 0, txCount: 0, netRev: 0 }
    leaderAgg[tx.merchant_id].gmv     += tx.amount_fcfa
    leaderAgg[tx.merchant_id].txCount += 1
    leaderAgg[tx.merchant_id].netRev  += tx.amount_fcfa - tx.commission_total
  }
  const leaderboard: LeaderboardEntry[] = Object.entries(leaderAgg)
    .map(([id, d]) => ({
      id,
      name:   merchantMap.get(id)?.business_name ?? '—',
      sector: merchantMap.get(id)?.sector        ?? null,
      ...d,
    }))
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 10)

  // ── GMV par secteur ────────────────────────────────────────────────────────
  const sectorAgg: Record<string, { gmv: number; txCount: number }> = {}
  for (const tx of allTxs) {
    const sector = merchantMap.get(tx.merchant_id)?.sector ?? 'autre'
    if (!sectorAgg[sector]) sectorAgg[sector] = { gmv: 0, txCount: 0 }
    sectorAgg[sector].gmv     += tx.amount_fcfa
    sectorAgg[sector].txCount += 1
  }
  const sectorPerf: SectorPerfDatum[] = Object.entries(sectorAgg)
    .map(([sector, d]) => ({ sector: SECTOR_LABELS[sector] ?? sector, ...d }))
    .sort((a, b) => b.gmv - a.gmv)

  // ── Effet réseau (acheteurs référés vs. directs) ───────────────────────────
  const buyerIds = [...new Set(allTxs.map(t => t.buyer_id))]
  const { data: buyerProfilesRaw } = buyerIds.length > 0
    ? await svc.from('users').select('id, upline_id').in('id', buyerIds.slice(0, 1000))
    : { data: [] }
  const buyerMap = new Map((buyerProfilesRaw ?? []).map(u => [u.id, u]))

  let refGmv = 0, dirGmv = 0, refCount = 0, dirCount = 0
  for (const tx of allTxs) {
    if (buyerMap.get(tx.buyer_id)?.upline_id) {
      refGmv += tx.amount_fcfa; refCount++
    } else {
      dirGmv += tx.amount_fcfa; dirCount++
    }
  }
  const networkEffect: NetworkEffectDatum[] = [
    { label: 'Via communauté', gmv: refGmv, count: refCount, pct: allTxs.length > 0 ? Math.round((refCount / allTxs.length) * 100) : 0 },
    { label: 'Directs',        gmv: dirGmv, count: dirCount, pct: allTxs.length > 0 ? Math.round((dirCount / allTxs.length) * 100) : 0 },
  ]

  // ── Rétention acheteurs (plateforme) ──────────────────────────────────────
  const mthBuyerSets: Set<string>[] = []
  for (let i = 5; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const slice = allTxs.filter(t => { const d = new Date(t.created_at); return d >= start && d < end })
    mthBuyerSets.push(new Set(slice.map(t => t.buyer_id)))
  }
  const platformRetention: PlatformRetentionDatum[] = mthBuyerSets.map((current, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const label = start.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
    const prev  = i > 0 ? mthBuyerSets[i - 1] : null
    const returning     = prev ? [...current].filter(id => prev.has(id)).length : 0
    const newBuyers     = Math.max(0, current.size - returning)
    const retentionRate = prev && prev.size > 0 ? Math.round((returning / prev.size) * 100) : 0
    return { label, newBuyers, returning, retentionRate }
  })

  // ── KPIs globaux ──────────────────────────────────────────────────────────
  const totalGmv       = allTxs.reduce((s, t) => s + t.amount_fcfa, 0)
  const totalComm      = allTxs.reduce((s, t) => s + t.commission_total, 0)
  const totalTxCount   = allTxs.length
  const avgBasket      = totalTxCount > 0 ? Math.round(totalGmv / totalTxCount) : 0
  const uniqueBuyers   = new Set(allTxs.map(t => t.buyer_id)).size
  const platformRev    = Math.round(totalComm * 0.45)  // GOVERNANCE 45%
  const thisMthGmv     = monthlyTrend[5]?.gmv ?? 0
  const prevMthGmv     = monthlyTrend[4]?.gmv ?? 0
  const gmvGrowthPct   = prevMthGmv > 0 ? Math.round(((thisMthGmv - prevMthGmv) / prevMthGmv) * 100) : null
  const vipCount       = allMerchants.filter(m => m.subscription_tier === 'vip').length
  const proCount       = allMerchants.filter(m => m.subscription_tier === 'pro').length

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics Plateforme</h1>
          <p className="text-sm text-gray-400 mt-1">Vue transactionnelle · 6 derniers mois</p>
        </div>
        <Link href="/admin/dashboard" className="text-brand-600 text-sm hover:text-brand-700">
          ← Dashboard
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="card text-center">
          <p className="text-2xl font-bold text-brand-700">{fmt(totalGmv)} F</p>
          <p className="text-xs text-gray-400 mt-1">GMV 6 mois</p>
          {gmvGrowthPct !== null && (
            <p className={`text-xs font-semibold mt-0.5 ${gmvGrowthPct >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {gmvGrowthPct >= 0 ? '+' : ''}{gmvGrowthPct}% ce mois
            </p>
          )}
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-gray-900">{totalTxCount.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-gray-400 mt-1">Transactions</p>
          <p className="text-xs text-gray-300 mt-0.5">{fmt(avgBasket)} F panier moy.</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-purple-700">{uniqueBuyers.toLocaleString('fr-FR')}</p>
          <p className="text-xs text-gray-400 mt-1">Acheteurs uniques</p>
          <p className="text-xs text-gray-300 mt-0.5">6 mois</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-700">{fmt(platformRev)} F</p>
          <p className="text-xs text-gray-400 mt-1">Revenu GreenFlame</p>
          <p className="text-xs text-gray-300 mt-0.5">45% des commissions</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-amber-700">{allMerchants.length}</p>
          <p className="text-xs text-gray-400 mt-1">Marchands actifs</p>
          <p className="text-xs text-gray-300 mt-0.5">{vipCount} VIP · {proCount} Pro</p>
        </div>
      </div>

      {/* Charts (client) */}
      <PlatformChartsClient
        monthlyTrend={monthlyTrend}
        paymentDistribution={paymentDistribution}
        leaderboard={leaderboard}
        sectorPerf={sectorPerf}
        networkEffect={networkEffect}
        platformRetention={platformRetention}
      />

    </div>
  )
}
