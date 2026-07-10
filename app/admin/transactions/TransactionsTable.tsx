'use client'

import { useState } from 'react'
import { formatFcfa } from '@/lib/utils/format'
import type { TxRow, DistRow } from './page'

function FraudBadge({ level, flags, narrative }: {
  level: 'low' | 'medium' | 'high' | null
  flags: string[] | null
  narrative: string | null
}) {
  if (!level || level === 'low') return null
  const isHigh = level === 'high'
  return (
    <span
      title={narrative ?? undefined}
      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium cursor-help ${
        isHigh
          ? 'bg-red-900/50 text-red-400 border border-red-800'
          : 'bg-yellow-900/40 text-yellow-400 border border-yellow-800'
      }`}
    >
      {isHigh ? '🚨' : '⚠️'}
      {flags && flags.length > 0 ? flags[0] : level.toUpperCase()}
    </span>
  )
}

const DIST_LABELS: Record<string, string> = {
  cashback:  'Cashback acheteur',
  network:   'Communauté',
  platform:  'Plateforme GreenFlame',
  spillover: 'Spillover fund',
}

function DistBadge({ d }: { d: DistRow }) {
  const label = d.distribution_type === 'network' && d.level
    ? `Communauté N${d.level}`
    : (DIST_LABELS[d.distribution_type] ?? d.distribution_type)

  const color =
    d.distribution_type === 'cashback'  ? 'bg-brand-900/30 text-brand-400'  :
    d.distribution_type === 'network'   ? 'bg-green-900/30 text-green-400'  :
    d.distribution_type === 'platform'  ? 'bg-gray-700 text-gray-300'        :
                                          'bg-yellow-900/30 text-yellow-400'

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${color}`}>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold">{label}</p>
        {d.recipient_name && (
          <p className="text-xs opacity-70 truncate">{d.recipient_name}</p>
        )}
        {d.is_gfp && <p className="text-xs opacity-70">→ Points GFP</p>}
      </div>
      <p className="text-xs font-bold flex-shrink-0">+{formatFcfa(d.amount_fcfa)}</p>
    </div>
  )
}

export default function TransactionsTable({ txList }: { txList: TxRow[] }) {
  const [search,    setSearch]    = useState('')
  const [expandedId, setExpanded] = useState<string | null>(null)

  const filtered = search.trim()
    ? txList.filter(tx =>
        tx.merchant_name?.toLowerCase().includes(search.toLowerCase()) ||
        tx.buyer_name?.toLowerCase().includes(search.toLowerCase()) ||
        tx.buyer_phone?.includes(search)
      )
    : txList

  function toggle(id: string) {
    setExpanded(prev => prev === id ? null : id)
  }

  return (
    <div className="space-y-4">
      <input
        type="text"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Rechercher par marchand, acheteur ou téléphone…"
        className="w-full bg-gray-700 text-white px-4 py-3 rounded-xl border border-gray-600 focus:border-brand-500 focus:outline-none text-sm placeholder-gray-500"
      />
      <p className="text-gray-500 text-xs">{filtered.length} transaction(s) · Cliquez sur une ligne pour voir les commissions</p>

      {/* Mobile-friendly cards on small screens, table on md+ */}
      <div className="hidden md:block bg-gray-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-700">
              <tr>
                {['Date', 'Marchand', 'Acheteur', 'Montant', 'Commission', 'Mode', 'Statut', ''].map(h => (
                  <th key={h} className="px-3 py-3 text-left text-xs text-gray-400 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/30">
              {filtered.map(tx => (
                <>
                  <tr
                    key={tx.id}
                    onClick={() => toggle(tx.id)}
                    className="hover:bg-gray-700/30 cursor-pointer"
                  >
                    <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {new Date(tx.created_at).toLocaleDateString('fr-FR', {
                        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                      })}
                    </td>
                    <td className="px-3 py-3 text-white">{tx.merchant_name ?? '—'}</td>
                    <td className="px-3 py-3">
                      <p className="text-white">{tx.buyer_name ?? '—'}</p>
                      <p className="text-gray-500 text-xs">{tx.buyer_phone}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="text-white font-medium">{formatFcfa(tx.amount_fcfa)} F</span>
                      {tx.fraud_level && tx.fraud_level !== 'low' && (
                        <div className="mt-0.5">
                          <FraudBadge level={tx.fraud_level} flags={tx.fraud_flags} narrative={tx.fraud_narrative} />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-brand-400 whitespace-nowrap">{formatFcfa(tx.commission_total)} F</td>
                    <td className="px-3 py-3 text-gray-400 text-xs whitespace-nowrap">
                      <span>{tx.payment_method ?? '—'}</span>
                      {tx.idempotency_key?.startsWith('proxy-') && (
                        <span className="ml-1.5 inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-purple-900/40 text-purple-300 border border-purple-800">
                          Proxy
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`badge text-xs ${
                        tx.status === 'completed' ? 'text-green-400 bg-green-900/20' :
                        tx.status === 'failed'    ? 'text-red-400 bg-red-900/20'     :
                                                   'text-yellow-400 bg-yellow-900/20'
                      }`}>
                        {tx.status}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-gray-400 text-xs">
                      {expandedId === tx.id ? '▲' : '▼'}
                    </td>
                  </tr>

                  {/* Expanded detail */}
                  {expandedId === tx.id && (
                    <tr key={`${tx.id}-detail`}>
                      <td colSpan={8} className="px-4 py-4 bg-gray-700/20">
                        {tx.distributions.length === 0 ? (
                          <p className="text-gray-500 text-sm">Aucune distribution enregistrée pour cette transaction.</p>
                        ) : (
                          <div>
                            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-3">
                              Distribution des {formatFcfa(tx.commission_total)} FCFA de commission
                            </p>
                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                              {tx.distributions
                                .sort((a, b) => {
                                  const order = { cashback: 0, network: 1, platform: 2, spillover: 3 }
                                  const oa = order[a.distribution_type as keyof typeof order] ?? 9
                                  const ob = order[b.distribution_type as keyof typeof order] ?? 9
                                  if (oa !== ob) return oa - ob
                                  return (a.level ?? 0) - (b.level ?? 0)
                                })
                                .map((d, i) => <DistBadge key={i} d={d} />)
                              }
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-400">Aucune transaction</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {filtered.map(tx => (
          <div key={tx.id} className="bg-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => toggle(tx.id)}
              className="w-full flex items-start gap-3 p-4 text-left"
            >
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-white text-sm">{tx.merchant_name ?? '—'}</p>
                  <span className={`badge text-xs ml-2 ${
                    tx.status === 'completed' ? 'text-green-400 bg-green-900/20' :
                    tx.status === 'failed'    ? 'text-red-400 bg-red-900/20'     :
                                               'text-yellow-400 bg-yellow-900/20'
                  }`}>
                    {tx.status}
                  </span>
                </div>
                <p className="text-gray-400 text-xs">{tx.buyer_name} · {tx.buyer_phone}</p>
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  <span className="font-bold text-white">{formatFcfa(tx.amount_fcfa)} FCFA</span>
                  <span className="text-brand-400">comm. {formatFcfa(tx.commission_total)}</span>
                  {tx.fraud_level && tx.fraud_level !== 'low' && (
                    <FraudBadge level={tx.fraud_level} flags={tx.fraud_flags} narrative={tx.fraud_narrative} />
                  )}
                </div>
                <p className="text-gray-500 text-xs flex items-center gap-1.5 flex-wrap">
                  <span>
                    {new Date(tx.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                    })}
                    {tx.payment_method && ` · ${tx.payment_method}`}
                  </span>
                  {tx.idempotency_key?.startsWith('proxy-') && (
                    <span className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-purple-900/40 text-purple-300 border border-purple-800">
                      Proxy
                    </span>
                  )}
                </p>
              </div>
              <span className="text-gray-500 text-xs mt-1 flex-shrink-0">{expandedId === tx.id ? '▲' : '▼'}</span>
            </button>

            {expandedId === tx.id && tx.distributions.length > 0 && (
              <div className="border-t border-gray-700 p-4">
                <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Distributions</p>
                <div className="space-y-1.5">
                  {tx.distributions
                    .sort((a, b) => {
                      const order = { cashback: 0, network: 1, platform: 2, spillover: 3 }
                      return (order[a.distribution_type as keyof typeof order] ?? 9) -
                             (order[b.distribution_type as keyof typeof order] ?? 9)
                    })
                    .map((d, i) => <DistBadge key={i} d={d} />)
                  }
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="text-center text-gray-400 py-8">Aucune transaction</p>
        )}
      </div>
    </div>
  )
}
