'use client'

import {
  AreaChart, Area, BarChart, Bar, ComposedChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import type {
  MonthlyTrendDatum, PaymentDistDatum, LeaderboardEntry,
  SectorPerfDatum, NetworkEffectDatum, PlatformRetentionDatum,
} from './page'
import { useState } from 'react'

// ── Config ────────────────────────────────────────────────────────────────────
const METHOD_LABELS: Record<string, string> = {
  momo: 'MTN MoMo', moov: 'Moov Money', cash: 'Espèces',
  wallet: 'Portefeuille GF', orange: 'Orange Money', autre: 'Autre',
}
const METHOD_COLORS = ['#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#6b7280']
const NETWORK_COLORS = ['#22c55e', '#94a3b8']

function fmtShort(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `${Math.round(v / 1_000)}k`
  return String(v)
}

function fmtFcfa(v: number): string {
  return `${v.toLocaleString('fr-FR')} F`
}

// ── Tooltip partagé ───────────────────────────────────────────────────────────
type TEntry = { name: string; value: number; color: string; dataKey: string }
function GfTooltip({ active, payload, label }: { active?: boolean; payload?: TEntry[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg text-xs">
      {label && <p className="font-semibold text-gray-700 pb-1 mb-1 border-b border-gray-100">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-1.5 py-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color }} />
          <span className="text-gray-500">{p.name}:</span>
          <span className="font-semibold text-gray-900">
            {p.dataKey === 'retentionRate' ? `${p.value}%`
              : p.dataKey === 'txCount' || p.dataKey === 'newUsers' ? p.value.toLocaleString('fr-FR')
              : fmtShort(p.value) + ' F'}
          </span>
        </p>
      ))}
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  monthlyTrend:      MonthlyTrendDatum[]
  paymentDistribution: PaymentDistDatum[]
  leaderboard:       LeaderboardEntry[]
  sectorPerf:        SectorPerfDatum[]
  networkEffect:     NetworkEffectDatum[]
  platformRetention: PlatformRetentionDatum[]
}

// ── Composant ─────────────────────────────────────────────────────────────────
export default function PlatformChartsClient({
  monthlyTrend, paymentDistribution, leaderboard, sectorPerf, networkEffect, platformRetention,
}: Props) {
  const [trendView, setTrendView] = useState<'gmv' | 'commission' | 'txCount' | 'newUsers'>('gmv')

  const trendConfig = {
    gmv:        { key: 'gmv',        label: 'GMV',           color: '#16a34a', gradId: 'gradGmv'    },
    commission: { key: 'commission', label: 'Commissions',   color: '#6366f1', gradId: 'gradComm'   },
    txCount:    { key: 'txCount',    label: 'Transactions',  color: '#f59e0b', gradId: 'gradTx'     },
    newUsers:   { key: 'newUsers',   label: 'Nouveaux membres', color: '#06b6d4', gradId: 'gradUsr' },
  }
  const tc = trendConfig[trendView]

  const maxSectorGmv = sectorPerf[0]?.gmv ?? 1

  return (
    <div className="space-y-4">

      {/* ── Tendance plateforme ─────────────────────────────────────────────── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="font-semibold text-gray-900">Tendance plateforme</p>
            <p className="text-xs text-gray-400 mt-0.5">6 derniers mois</p>
          </div>
          <div className="flex gap-1 flex-wrap justify-end">
            {(Object.keys(trendConfig) as (keyof typeof trendConfig)[]).map(v => (
              <button
                key={v}
                onClick={() => setTrendView(v)}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  trendView === v ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
              >
                {trendConfig[v].label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={monthlyTrend} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              {Object.values(trendConfig).map(c => (
                <linearGradient key={c.gradId} id={c.gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={c.color} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={c.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
            <YAxis tickFormatter={fmtShort} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} width={40} />
            <Tooltip content={<GfTooltip />} />
            <Area
              type="monotone"
              dataKey={tc.key}
              name={tc.label}
              stroke={tc.color}
              strokeWidth={2.5}
              fill={`url(#${tc.gradId})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>

        {/* Summary row */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-4 border-t border-gray-50">
          {[
            { label: 'GMV mois',   value: fmtShort(monthlyTrend[5]?.gmv ?? 0) + ' F',         color: 'text-brand-700'  },
            { label: 'Comm. mois', value: fmtShort(monthlyTrend[5]?.commission ?? 0) + ' F',  color: 'text-indigo-600' },
            { label: 'Tx mois',    value: (monthlyTrend[5]?.txCount ?? 0).toLocaleString('fr-FR'), color: 'text-amber-600' },
            { label: 'Nv. membres',value: (monthlyTrend[5]?.newUsers ?? 0).toLocaleString('fr-FR'), color: 'text-cyan-600' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-400">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Rétention + Méthodes de paiement ──────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Rétention acheteurs plateforme */}
        <div className="card">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="font-semibold text-gray-900">Rétention acheteurs</p>
              <p className="text-xs text-gray-400 mt-0.5">Plateforme · mensuel</p>
            </div>
            <div className="flex flex-col gap-1 text-xs text-gray-400 text-right">
              <span className="flex items-center gap-1.5 justify-end"><span className="w-2 h-2 bg-indigo-500 rounded-sm" /> Récurrents</span>
              <span className="flex items-center gap-1.5 justify-end"><span className="w-2 h-2 bg-emerald-400 rounded-sm" /> Nouveaux</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <ComposedChart data={platformRetention} margin={{ top: 4, right: 20, bottom: 0, left: 0 }}>
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
                          <span className="w-2 h-2 rounded-full" style={{ background: p.color as string }} />
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

        {/* Méthodes de paiement */}
        <div className="card">
          <p className="font-semibold text-gray-900 mb-4">Méthodes de paiement</p>
          {paymentDistribution.length > 0 ? (
            <div className="flex gap-4 items-center">
              <div className="flex-shrink-0">
                <PieChart width={140} height={140}>
                  <Pie
                    data={paymentDistribution}
                    dataKey="count"
                    nameKey="method"
                    cx="50%"
                    cy="50%"
                    innerRadius={38}
                    outerRadius={64}
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {paymentDistribution.map((_, i) => (
                      <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v, name) => [`${v as number} tx`, METHOD_LABELS[name as string] ?? (name as string)]} />
                </PieChart>
              </div>
              <div className="flex-1 space-y-2">
                {paymentDistribution.map((d, i) => (
                  <div key={d.method} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: METHOD_COLORS[i % METHOD_COLORS.length] }} />
                    <span className="text-xs text-gray-700 flex-1 truncate">{METHOD_LABELS[d.method] ?? d.method}</span>
                    <span className="text-xs font-semibold text-gray-900 flex-shrink-0">{d.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Aucune donnée</p>
          )}
        </div>
      </div>

      {/* ── GMV par secteur + Effet réseau ─────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* GMV par secteur */}
        <div className="card">
          <p className="font-semibold text-gray-900 mb-4">GMV par secteur</p>
          {sectorPerf.length > 0 ? (
            <div className="space-y-2.5">
              {sectorPerf.map((s, i) => (
                <div key={s.sector}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-700 font-medium">{s.sector}</span>
                    <span className="text-gray-500">{fmtShort(s.gmv)} F · {s.txCount} tx</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{
                        width: `${Math.round((s.gmv / maxSectorGmv) * 100)}%`,
                        background: ['#16a34a','#3b82f6','#f59e0b','#8b5cf6','#ef4444','#06b6d4','#ec4899','#84cc16'][i % 8],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">Aucune donnée sectorielle</p>
          )}
        </div>

        {/* Effet réseau */}
        <div className="card">
          <p className="font-semibold text-gray-900 mb-1">Effet réseau</p>
          <p className="text-xs text-gray-400 mb-4">GMV généré via la communauté vs. directs</p>
          <div className="flex gap-4 items-center">
            <div className="flex-shrink-0">
              <PieChart width={140} height={140}>
                <Pie
                  data={networkEffect}
                  dataKey="gmv"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={64}
                  paddingAngle={3}
                  strokeWidth={0}
                >
                  {networkEffect.map((_, i) => (
                    <Cell key={i} fill={NETWORK_COLORS[i % NETWORK_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [fmtFcfa(v as number), 'GMV']} />
              </PieChart>
            </div>
            <div className="flex-1 space-y-3">
              {networkEffect.map((d, i) => (
                <div key={d.label}>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: NETWORK_COLORS[i] }} />
                    <span className="text-xs font-semibold text-gray-800">{d.label}</span>
                    <span className="text-xs font-bold text-gray-900 ml-auto">{d.pct}%</span>
                  </div>
                  <p className="text-xs text-gray-400 pl-4">{fmtShort(d.gmv)} F · {d.count.toLocaleString('fr-FR')} tx</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Leaderboard marchands ──────────────────────────────────────────── */}
      <div className="card overflow-x-auto p-0">
        <div className="px-5 py-4 border-b border-gray-100">
          <p className="font-semibold text-gray-900">Top marchands — ce mois</p>
          <p className="text-xs text-gray-400 mt-0.5">Classés par GMV</p>
        </div>
        {leaderboard.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-50">
                {['#', 'Marchand', 'Secteur', 'GMV', 'Tx', 'Net'].map(h => (
                  <th key={h} className="text-left px-4 py-2.5 text-xs font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((m, i) => (
                <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      i === 0 ? 'bg-amber-100 text-amber-700'
                      : i === 1 ? 'bg-gray-200 text-gray-600'
                      : i === 2 ? 'bg-orange-100 text-orange-600'
                      : 'bg-gray-100 text-gray-500'
                    }`}>{i + 1}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">{m.name}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">{m.sector ?? '—'}</td>
                  <td className="px-4 py-3 font-bold text-brand-700 whitespace-nowrap">{fmtShort(m.gmv)} F</td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{m.txCount}</td>
                  <td className="px-4 py-3 text-green-700 font-medium whitespace-nowrap">{fmtShort(m.netRev)} F</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-gray-400 text-center py-10">Aucune transaction ce mois</p>
        )}
      </div>

    </div>
  )
}
