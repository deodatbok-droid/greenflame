'use client'

import { useState } from 'react'
import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts'
import { formatFcfa } from '@/lib/utils/format'
import { useLocale } from '@/components/providers/LocaleProvider'

// ── Types ─────────────────────────────────────────────────────────────────────
type MonthDatum     = { label: string; gmv: number; net: number; count: number }
type DayDatum       = { label: string; gmv: number; count: number }
type DowDatum       = { label: string; avgGmv: number; count: number }
type HourDatum      = { label: string; gmv: number }
type RetentionDatum = { label: string; newBuyers: number; returning: number; retentionRate: number }
type PaymentDatum   = { method: string; count: number; gmv: number; avgBasket: number; pct: number }
type ProductDatum   = { name: string; revenue: number; qty: number }

interface Props {
  monthlyData:      MonthDatum[]
  dailyData:        DayDatum[]
  dowData:          DowDatum[]
  hourData:         HourDatum[]
  retentionData:    RetentionDatum[]
  paymentBreakdown: PaymentDatum[]
  topProducts:      ProductDatum[]
}

// ── Config ────────────────────────────────────────────────────────────────────
const METHOD_LABELS: Record<string, string> = {
  momo:   'MTN MoMo',
  moov:   'Moov Money',
  cash:   'Espèces',
  wallet: 'Portefeuille GF',
  orange: 'Orange Money',
  autre:  'Autre',
}
const METHOD_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#6b7280']

function fmtShort(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${Math.round(v / 1_000)}k`
  return String(v)
}

// ── Tooltip générique FCFA ────────────────────────────────────────────────────
type TooltipEntry = { name: string; value: number; color: string; dataKey: string }
function FcfaTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipEntry[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-gray-700 mb-1.5 pb-1 border-b border-gray-100">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-900">
            {p.dataKey === 'retentionRate' || p.dataKey === 'count'
              ? p.dataKey === 'retentionRate' ? `${p.value}%` : p.value
              : formatFcfa(p.value)}
          </span>
        </p>
      ))}
    </div>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────
export default function AnalyticsCharts({
  monthlyData, dailyData, dowData, hourData,
  retentionData, paymentBreakdown, topProducts,
}: Props) {
  const { t } = useLocale()
  const [activeMonthView, setActiveMonthView] = useState<'gmv' | 'net' | 'count'>('gmv')
  const [activeDailyView, setActiveDailyView] = useState<'gmv' | 'count'>('gmv')

  const monthViewData = monthlyData.map(d => ({
    ...d,
    value: activeMonthView === 'gmv' ? d.gmv : activeMonthView === 'net' ? d.net : d.count,
  }))

  const hourFiltered = hourData.filter((_, i) => i >= 6 && i <= 22)
  const maxProductRevenue = topProducts[0]?.revenue ?? 1

  const monthColor  = activeMonthView === 'net' ? '#22c55e' : activeMonthView === 'count' ? '#a78bfa' : '#16a34a'
  const dailyColor  = activeDailyView === 'count' ? '#818cf8' : '#4ade80'

  return (
    <div className="space-y-4">

      {/* ── Évolution 6 mois ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-900">{t('merchant.analytics.evolution6months')}</p>
          <div className="flex gap-1">
            {(['gmv', 'net', 'count'] as const).map(v => (
              <button
                key={v}
                onClick={() => setActiveMonthView(v)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  activeMonthView === v ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {v === 'gmv' ? 'GMV' : v === 'net' ? 'Net' : 'Txs'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={monthViewData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="gradMonth" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={monthColor} stopOpacity={0.18} />
                <stop offset="95%" stopColor={monthColor} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={36} />
            <Tooltip content={<FcfaTooltip />} />
            <Area
              type="monotone"
              dataKey="value"
              name={activeMonthView === 'gmv' ? 'GMV' : activeMonthView === 'net' ? 'Net' : 'Transactions'}
              stroke={monthColor}
              strokeWidth={2.5}
              fill="url(#gradMonth)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
        <div className="flex justify-between mt-3 pt-3 border-t border-gray-50">
          {monthlyData.slice(-3).map((m, i) => (
            <div key={i} className="text-center">
              <p className="text-xs text-gray-500">{m.label}</p>
              <p className="text-sm font-bold text-gray-800">{fmtShort(m.gmv)} F</p>
              <p className="text-xs text-gray-500">{m.count} tx</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── 30 derniers jours ────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="font-semibold text-gray-900">{t('merchant.analytics.last30days')}</p>
          <div className="flex gap-1">
            {(['gmv', 'count'] as const).map(v => (
              <button
                key={v}
                onClick={() => setActiveDailyView(v)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  activeDailyView === v ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {v === 'gmv' ? t('merchant.analytics.chartSales') : t('merchant.analytics.chartTx')}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={128}>
          <BarChart data={dailyData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap="8%">
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={6} />
            <YAxis tickFormatter={fmtShort} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={32} />
            <Tooltip content={<FcfaTooltip />} />
            <Bar
              dataKey={activeDailyView === 'gmv' ? 'gmv' : 'count'}
              name={activeDailyView === 'gmv' ? 'GMV' : 'Transactions'}
              fill={dailyColor}
              radius={[3, 3, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* ── Jour de semaine + Heure ───────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="font-semibold text-gray-900 mb-4">{t('merchant.analytics.avgByDay')}</p>
          <ResponsiveContainer width="100%" height={112}>
            <BarChart data={dowData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={32} />
              <Tooltip content={<FcfaTooltip />} />
              <Bar dataKey="avgGmv" name="Moy. GMV" fill="#22c55e" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-2 text-center">{t('merchant.analytics.avgGmvByDow')}</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="font-semibold text-gray-900 mb-4">{t('merchant.analytics.activityByHour')}</p>
          <ResponsiveContainer width="100%" height={112}>
            <BarChart data={hourFiltered} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis tickFormatter={fmtShort} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={32} />
              <Tooltip content={<FcfaTooltip />} />
              <Bar dataKey="gmv" name="GMV" fill="#fbbf24" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <p className="text-xs text-gray-500 mt-2 text-center">{t('merchant.analytics.totalGmvByHour')}</p>
        </div>
      </div>

      {/* ── Fidélisation clients (NEW) ────────────────────────────────────── */}
      {retentionData.some(d => d.newBuyers > 0 || d.returning > 0) && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-semibold text-gray-900">Fidélisation clients</p>
              <p className="text-xs text-gray-500 mt-0.5">Acheteurs nouveaux vs. récurrents · taux de rétention</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 flex-shrink-0">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500 inline-block" /> Récurrents
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-emerald-400 inline-block" /> Nouveaux
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> Rétention %
              </span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={retentionData} margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
              <YAxis yAxisId="left"  tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={24} allowDecimals={false} />
              <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}%`} tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={30} domain={[0, 100]} />
              <Tooltip
                content={({ active, payload, label: lbl }) => {
                  if (!active || !payload?.length) return null
                  return (
                    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-xs space-y-1">
                      <p className="font-semibold text-gray-700 pb-1 border-b border-gray-100">{lbl}</p>
                      {payload.map((p, i) => (
                        <p key={i} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                          <span className="text-gray-500">{p.name}:</span>
                          <span className="font-semibold text-gray-900">
                            {p.dataKey === 'retentionRate' ? `${p.value}%` : p.value}
                          </span>
                        </p>
                      ))}
                    </div>
                  )
                }}
              />
              <Bar yAxisId="left" dataKey="returning" name="Récurrents" stackId="a" fill="#6366f1" />
              <Bar yAxisId="left" dataKey="newBuyers"  name="Nouveaux"   stackId="a" fill="#34d399" radius={[3, 3, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="retentionRate" name="Rétention" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3, fill: '#f59e0b', strokeWidth: 0 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Méthodes de paiement (NEW) ────────────────────────────────────── */}
      {paymentBreakdown.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="font-semibold text-gray-900 mb-4">Méthodes de paiement</p>
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-shrink-0">
              <PieChart width={180} height={180}>
                <Pie
                  data={paymentBreakdown}
                  dataKey="count"
                  nameKey="method"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                  strokeWidth={0}
                >
                  {paymentBreakdown.map((_, i) => (
                    <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v, name) => [
                    `${v as number} ventes`,
                    METHOD_LABELS[name as string] ?? (name as string),
                  ]}
                />
              </PieChart>
            </div>
            <div className="flex-1 w-full space-y-2.5">
              {paymentBreakdown.map((d, i) => (
                <div key={d.method} className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: METHOD_COLORS[i % METHOD_COLORS.length] }} />
                  <span className="text-sm text-gray-700 w-28 flex-shrink-0">{METHOD_LABELS[d.method] ?? d.method}</span>
                  <span className="text-xs text-gray-500 w-14 flex-shrink-0">{d.count} ventes</span>
                  <span className="text-xs font-semibold text-gray-800 w-8 flex-shrink-0">{d.pct}%</span>
                  <div className="flex-1">
                    <div className="h-1.5 bg-gray-100 rounded-full">
                      <div className="h-1.5 rounded-full" style={{ width: `${d.pct}%`, background: METHOD_COLORS[i % METHOD_COLORS.length] }} />
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 text-right flex-shrink-0">{fmtShort(d.avgBasket)} F moy.</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Produits populaires (NEW) ──────────────────────────────────────── */}
      {topProducts.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <p className="font-semibold text-gray-900 mb-4">Produits les plus vendus</p>
          <div className="space-y-2">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-amber-100 text-amber-700'
                  : i === 1 ? 'bg-gray-200 text-gray-600'
                  : i === 2 ? 'bg-orange-100 text-orange-600'
                  : 'bg-gray-100 text-gray-500'
                }`}>{i + 1}</span>
                <span className="text-sm text-gray-800 flex-1 min-w-0 truncate">{p.name}</span>
                <div className="flex-1 max-w-28 hidden sm:block">
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div
                      className="h-1.5 bg-brand-500 rounded-full"
                      style={{ width: `${Math.round((p.revenue / maxProductRevenue) * 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-gray-500 w-10 text-right flex-shrink-0">{p.qty} u.</span>
                <span className="text-xs font-bold text-brand-700 w-16 text-right flex-shrink-0">{fmtShort(p.revenue)} F</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

