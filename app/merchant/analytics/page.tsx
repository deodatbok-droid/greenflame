import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatFcfa } from '@/lib/utils/format'
import Link from 'next/link'
import AnalyticsCharts from './AnalyticsCharts'
import { getServerT } from '@/lib/i18n/server'

// ── Helpers ──────────────────────────────────────────────────────────────────
function startOf(unit: 'day' | 'week' | 'month', ref = new Date()): Date {
  const d = new Date(ref)
  if (unit === 'day') { d.setHours(0, 0, 0, 0) }
  else if (unit === 'week') { d.setDate(d.getDate() - d.getDay()); d.setHours(0, 0, 0, 0) }
  else { d.setDate(1); d.setHours(0, 0, 0, 0) }
  return d
}

function subtractDays(d: Date, n: number): Date {
  const r = new Date(d); r.setDate(r.getDate() - n); return r
}

function pct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null
  return Math.round(((current - previous) / previous) * 100)
}

type Tx = {
  amount_fcfa: number
  commission_total: number
  created_at: string
  buyer_id: string
  buyers: { full_name: string } | null
}

function aggregate(txs: Tx[]) {
  const gmv = txs.reduce((s, t) => s + t.amount_fcfa, 0)
  const net = txs.reduce((s, t) => s + (t.amount_fcfa - t.commission_total), 0)
  const fees = txs.reduce((s, t) => s + t.commission_total, 0)
  const count = txs.length
  const avg = count > 0 ? Math.round(gmv / count) : 0
  return { gmv, net, fees, count, avg }
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default async function AnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: merchant } = await supabase
    .from('merchants')
    .select('id, business_name, subscription_tier, subscription_expires_at, is_platform_hub')
    .eq('user_id', user.id)
    .single()

  if (!merchant) redirect('/merchant/activate')

  const isHub = merchant.is_platform_hub ?? false
  const tier = merchant.subscription_tier ?? 'free'
  const expires = merchant.subscription_expires_at ? new Date(merchant.subscription_expires_at) : null
  const isVip = isHub || (tier === 'vip' && expires !== null && expires > new Date())
  if (!isVip) redirect('/merchant/upgrade')

  const { t, locale } = await getServerT()
  const localeCode = locale === 'en' ? 'en-US' : 'fr-FR'

  // ── Fetch all transactions (last 6 months) ──────────────────────────────
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const { data: rawTxs } = await supabase
    .from('transactions')
    .select('amount_fcfa, commission_total, created_at, buyer_id, buyers:buyer_id(full_name)')
    .eq('merchant_id', merchant.id)
    .eq('status', 'completed')
    .gte('created_at', sixMonthsAgo.toISOString())
    .order('created_at', { ascending: true })

  const txs: Tx[] = (rawTxs ?? []).map(t => ({
    ...t,
    buyers: Array.isArray(t.buyers)
      ? (t.buyers[0] as { full_name: string } | null) ?? null
      : (t.buyers as { full_name: string } | null),
  }))

  const { data: allTimeRaw } = await supabase
    .from('transactions')
    .select('amount_fcfa, commission_total')
    .eq('merchant_id', merchant.id)
    .eq('status', 'completed')

  const allTimeTxs = allTimeRaw ?? []
  const allTimeGmv = allTimeTxs.reduce((s, t) => s + t.amount_fcfa, 0)
  const allTimeNet = allTimeTxs.reduce((s, t) => s + (t.amount_fcfa - t.commission_total), 0)
  const allTimeCount = allTimeTxs.length

  // ── Period boundaries ───────────────────────────────────────────────────
  const now = new Date()
  const todayStart    = startOf('day')
  const weekStart     = startOf('week')
  const monthStart    = startOf('month')
  const yesterday     = startOf('day', subtractDays(now, 1))
  const prevWeekStart = subtractDays(weekStart, 7)
  const prevWeekEnd   = weekStart
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const prevMonthEnd   = monthStart

  // ── Slice by period ─────────────────────────────────────────────────────
  const inRange = (t: Tx, from: Date, to: Date) => {
    const d = new Date(t.created_at)
    return d >= from && d < to
  }

  const todayTxs     = txs.filter(t => inRange(t, todayStart, new Date(now.getTime() + 86400000)))
  const yesterdayTxs = txs.filter(t => inRange(t, yesterday, todayStart))
  const weekTxs      = txs.filter(t => inRange(t, weekStart, new Date(now.getTime() + 86400000)))
  const prevWeekTxs  = txs.filter(t => inRange(t, prevWeekStart, prevWeekEnd))
  const monthTxs     = txs.filter(t => inRange(t, monthStart, new Date(now.getTime() + 86400000)))
  const prevMonthTxs = txs.filter(t => inRange(t, prevMonthStart, prevMonthEnd))

  const today         = aggregate(todayTxs)
  const yesterday_agg = aggregate(yesterdayTxs)
  const week          = aggregate(weekTxs)
  const prevWeek      = aggregate(prevWeekTxs)
  const month         = aggregate(monthTxs)
  const prevMonth     = aggregate(prevMonthTxs)

  // ── 6-month bar chart data ──────────────────────────────────────────────
  const monthlyData: { label: string; gmv: number; net: number; count: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const slice = txs.filter(t => inRange(t, d, end))
    const agg = aggregate(slice)
    monthlyData.push({
      label: d.toLocaleDateString(localeCode, { month: 'short', year: '2-digit' }),
      gmv: agg.gmv,
      net: agg.net,
      count: agg.count,
    })
  }

  // ── 30-day daily chart ──────────────────────────────────────────────────
  const dailyData: { label: string; gmv: number; count: number }[] = []
  for (let i = 29; i >= 0; i--) {
    const d = startOf('day', subtractDays(now, i))
    const end = startOf('day', subtractDays(now, i - 1))
    const slice = txs.filter(t => inRange(t, d, end))
    const agg = aggregate(slice)
    dailyData.push({
      label: d.toLocaleDateString(localeCode, { day: '2-digit', month: 'short' }),
      gmv: agg.gmv,
      count: agg.count,
    })
  }

  // ── Best day of week — labels from Intl ────────────────────────────────
  // Jan 1, 2023 was a Sunday (day 0), so i=0 → Sunday, i=1 → Monday, etc.
  const DOW_LABELS = Array.from({ length: 7 }, (_, i) =>
    new Date(2023, 0, 1 + i).toLocaleDateString(localeCode, { weekday: 'short' })
  )
  const dowMap: Record<number, { gmv: number; count: number; days: Set<string> }> = {}
  for (let i = 0; i < 7; i++) dowMap[i] = { gmv: 0, count: 0, days: new Set() }
  for (const tx of txs) {
    const d = new Date(tx.created_at)
    const dow = d.getDay()
    dowMap[dow].gmv += tx.amount_fcfa
    dowMap[dow].count++
    dowMap[dow].days.add(d.toISOString().slice(0, 10))
  }
  const dowData = DOW_LABELS.map((label, i) => ({
    label,
    avgGmv: dowMap[i].days.size > 0 ? Math.round(dowMap[i].gmv / dowMap[i].days.size) : 0,
    count: dowMap[i].count,
  }))
  const bestDow = dowData.reduce((best, d) => d.avgGmv > best.avgGmv ? d : best, dowData[0])

  // ── Best hour of day ────────────────────────────────────────────────────
  const hourMap: Record<number, number> = {}
  for (let i = 0; i < 24; i++) hourMap[i] = 0
  for (const tx of txs) {
    const h = new Date(tx.created_at).getHours()
    hourMap[h] = (hourMap[h] ?? 0) + tx.amount_fcfa
  }
  const hourData = Object.entries(hourMap).map(([h, gmv]) => ({
    label: `${h}h`,
    gmv,
  }))
  const bestHour = hourData.reduce((best, h) => h.gmv > best.gmv ? h : best, hourData[0])

  // ── Top clients ─────────────────────────────────────────────────────────
  const clientMap: Record<string, { name: string; count: number; gmv: number }> = {}
  for (const tx of txs) {
    if (!clientMap[tx.buyer_id]) {
      clientMap[tx.buyer_id] = {
        name: tx.buyers?.full_name ?? 'Client',
        count: 0,
        gmv: 0,
      }
    }
    clientMap[tx.buyer_id].count++
    clientMap[tx.buyer_id].gmv += tx.amount_fcfa
  }
  const topClients = Object.values(clientMap)
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, 5)

  // ── Unique buyers ────────────────────────────────────────────────────────
  const uniqueBuyers = new Set(txs.map(t => t.buyer_id)).size
  const uniqueBuyersMonth = new Set(monthTxs.map(t => t.buyer_id)).size
  const repeatBuyers = Object.values(clientMap).filter(c => c.count > 1).length

  const currentMonthLabel = now.toLocaleDateString(localeCode, { month: 'long', year: 'numeric' })

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('merchant.analytics.title')}</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {merchant.business_name} · {t('merchant.analytics.subtitle')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-1 rounded-full">VIP</span>
          <Link href="/merchant/tools" className="text-brand-600 text-sm">
            {t('merchant.analytics.backToTools')}
          </Link>
        </div>
      </div>

      {/* ── KPIs AUJOURD'HUI ── */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          {t('merchant.analytics.today')}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label={t('merchant.analytics.salesLabel')}
            value={formatFcfa(today.gmv)} unit="FCFA"
            delta={pct(today.gmv, yesterday_agg.gmv)}
            sub={`${today.count} tx · ${t('merchant.analytics.vsSameYesterday').replace('{amount}', formatFcfa(yesterday_agg.gmv))}`}
          />
          <KpiCard
            label={t('merchant.analytics.netRevenue')}
            value={formatFcfa(today.net)} unit="FCFA"
            delta={pct(today.net, yesterday_agg.net)}
            sub={t('merchant.analytics.afterFees').replace('{amount}', formatFcfa(today.fees))}
          />
          <KpiCard
            label={t('merchant.analytics.txLabel')}
            value={String(today.count)} unit={t('merchant.analytics.ventesUnit')}
            delta={pct(today.count, yesterday_agg.count)}
            sub={t('merchant.analytics.txCountYesterday').replace('{n}', String(yesterday_agg.count))}
          />
          <KpiCard
            label={t('merchant.analytics.avgCart')}
            value={today.count > 0 ? formatFcfa(today.avg) : '—'} unit="FCFA"
            delta={pct(today.avg, yesterday_agg.avg)}
            sub={t('merchant.analytics.perTransaction')}
          />
        </div>
      </section>

      {/* ── KPIs SEMAINE ── */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          {t('merchant.analytics.thisWeek')}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label={t('merchant.analytics.gmvWeek')}
            value={formatFcfa(week.gmv)} unit="FCFA"
            delta={pct(week.gmv, prevWeek.gmv)}
            sub={t('merchant.analytics.prevWeek').replace('{amount}', formatFcfa(prevWeek.gmv))}
          />
          <KpiCard
            label={t('merchant.analytics.netWeek')}
            value={formatFcfa(week.net)} unit="FCFA"
            delta={pct(week.net, prevWeek.net)}
            sub={t('merchant.analytics.feesWeek').replace('{amount}', formatFcfa(week.fees))}
          />
          <KpiCard
            label={t('merchant.analytics.txLabel')}
            value={String(week.count)} unit={t('merchant.analytics.ventesUnit')}
            delta={pct(week.count, prevWeek.count)}
            sub={t('merchant.analytics.prevWeekTx').replace('{n}', String(prevWeek.count))}
          />
          <KpiCard
            label={t('merchant.analytics.avgCart')}
            value={week.count > 0 ? formatFcfa(week.avg) : '—'} unit="FCFA"
            delta={pct(week.avg, prevWeek.avg)}
            sub={t('merchant.analytics.weeklyAvg')}
          />
        </div>
      </section>

      {/* ── KPIs MOIS ── */}
      <section>
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-3">
          {currentMonthLabel}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <KpiCard
            label={t('merchant.analytics.gmvMonth')}
            value={formatFcfa(month.gmv)} unit="FCFA" accent
            delta={pct(month.gmv, prevMonth.gmv)}
            sub={t('merchant.analytics.prevMonthAmount').replace('{amount}', formatFcfa(prevMonth.gmv))}
          />
          <KpiCard
            label={t('merchant.analytics.netMonth')}
            value={formatFcfa(month.net)} unit="FCFA" accent
            delta={pct(month.net, prevMonth.net)}
            sub={t('merchant.analytics.commFees').replace('{amount}', formatFcfa(month.fees))}
          />
          <KpiCard
            label={t('merchant.analytics.txMonth')}
            value={String(month.count)} unit={t('merchant.analytics.ventesUnit')} accent
            delta={pct(month.count, prevMonth.count)}
            sub={t('merchant.analytics.prevMonthTx').replace('{n}', String(prevMonth.count))}
          />
          <KpiCard
            label={t('merchant.analytics.activeClients')}
            value={String(uniqueBuyersMonth)} unit={t('merchant.analytics.buyers')}
            delta={null}
            sub={t('merchant.analytics.loyalClients').replace('{n}', String(repeatBuyers))}
          />
        </div>
      </section>

      {/* ── GRAPHIQUES ── */}
      <AnalyticsCharts
        monthlyData={monthlyData}
        dailyData={dailyData}
        dowData={dowData}
        hourData={hourData}
      />

      {/* ── INSIGHTS ── */}
      <section className="grid md:grid-cols-2 gap-4">

        {/* Meilleur moment */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="font-semibold text-gray-900 mb-4">{t('merchant.analytics.bestMoments')}</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-brand-50 rounded-xl">
              <div>
                <p className="text-xs text-gray-500">{t('merchant.analytics.bestDay')}</p>
                <p className="font-bold text-brand-700 text-lg">{bestDow.label}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">{t('merchant.analytics.avgSales')}</p>
                <p className="font-semibold text-gray-800">{formatFcfa(bestDow.avgGmv)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-green-50 rounded-xl">
              <div>
                <p className="text-xs text-gray-500">{t('merchant.analytics.mostActiveHour')}</p>
                <p className="font-bold text-green-700 text-lg">{bestHour.label}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400">{t('merchant.analytics.totalSalesLabel')}</p>
                <p className="font-semibold text-gray-800">{formatFcfa(bestHour.gmv)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* All time */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="font-semibold text-gray-900 mb-4">{t('merchant.analytics.allTime')}</p>
          <div className="space-y-3">
            {[
              { label: t('merchant.analytics.gmvTotal'),   value: formatFcfa(allTimeGmv),   unit: 'FCFA',                               color: 'text-brand-700' },
              { label: t('merchant.analytics.netTotal'),   value: formatFcfa(allTimeNet),   unit: 'FCFA',                               color: 'text-green-700' },
              { label: t('merchant.analytics.txTotal'),    value: String(allTimeCount),     unit: t('merchant.analytics.ventesUnit'),   color: 'text-gray-800' },
              { label: t('merchant.analytics.uniqueClients'), value: String(uniqueBuyers), unit: t('merchant.analytics.buyers'),       color: 'text-purple-700' },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{s.label}</p>
                <p className={`font-bold text-sm ${s.color}`}>
                  {s.value} <span className="text-xs font-normal text-gray-400">{s.unit}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TOP CLIENTS ── */}
      {topClients.length > 0 && (
        <section>
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <p className="font-semibold text-gray-900 mb-4">{t('merchant.analytics.topClients')}</p>
            <div className="space-y-1">
              {topClients.map((c, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-amber-100 text-amber-700'
                    : i === 1 ? 'bg-gray-200 text-gray-600'
                    : i === 2 ? 'bg-orange-100 text-orange-600'
                    : 'bg-gray-100 text-gray-500'
                  }`}>{i + 1}</span>
                  <div className="w-9 h-9 bg-brand-100 rounded-full flex items-center justify-center text-sm font-bold text-brand-700 flex-shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{c.name}</p>
                    <p className="text-xs text-gray-400">
                      {c.count} {c.count > 1
                        ? t('merchant.analytics.purchasePlural')
                        : t('merchant.analytics.purchaseSingular')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-brand-700">{formatFcfa(c.gmv)}</p>
                    <p className="text-xs text-gray-400">FCFA</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

    </div>
  )
}

// ── Composant KPI Card ────────────────────────────────────────────────────────
function KpiCard({
  label, value, unit, delta, sub, accent = false
}: {
  label: string; value: string; unit: string
  delta: number | null; sub: string; accent?: boolean
}) {
  const isPos = delta !== null && delta >= 0
  const hasData = delta !== null

  return (
    <div className={`rounded-xl p-4 border ${accent ? 'bg-brand-700 text-white border-brand-600' : 'bg-white border-gray-100'}`}>
      <p className={`text-xs mb-1 ${accent ? 'text-brand-200' : 'text-gray-400'}`}>{label}</p>
      <p className={`text-xl font-bold ${accent ? 'text-white' : 'text-gray-900'}`}>
        {value} <span className={`text-xs font-normal ${accent ? 'text-brand-200' : 'text-gray-400'}`}>{unit}</span>
      </p>
      {hasData ? (
        <span className={`inline-flex items-center gap-0.5 text-xs font-medium mt-1 px-1.5 py-0.5 rounded-full ${
          isPos
            ? accent ? 'bg-white/20 text-green-200' : 'bg-green-50 text-green-700'
            : accent ? 'bg-white/20 text-red-200'   : 'bg-red-50 text-red-600'
        }`}>
          {isPos ? '↑' : '↓'} {Math.abs(delta)}%
        </span>
      ) : (
        <p className={`text-xs mt-1 ${accent ? 'text-brand-200' : 'text-gray-400'}`}>{sub}</p>
      )}
      {hasData && <p className={`text-xs mt-0.5 ${accent ? 'text-brand-200' : 'text-gray-400'}`}>{sub}</p>}
    </div>
  )
}
