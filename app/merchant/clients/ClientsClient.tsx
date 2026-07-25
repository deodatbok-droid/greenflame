'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

type ClientRecord = {
  name: string
  phone: string | null
  nb_transactions_gf: number
  total_achats_gf: number
  nb_devis: number
  nb_factures: number
  total_facture_fcfa: number
  devis_acceptes: number
  factures_payees: number
  derniere_interaction: string
  source: 'gf' | 'docs' | 'both'
}

function fmtFcfa(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA'
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function ClientStatus({ last }: { last: string }) {
  const days = Math.floor((Date.now() - new Date(last).getTime()) / 86_400_000)
  if (days <= 30)  return <span className="text-xs text-green-600 font-medium">Actif</span>
  if (days <= 90)  return <span className="text-xs text-amber-500 font-medium">Récent</span>
  return <span className="text-xs text-gray-400">Dormant</span>
}

function SourceBadge({ source }: { source: ClientRecord['source'] }) {
  if (source === 'both') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 px-1.5 py-0.5 rounded-full">
      🔥+📄
    </span>
  )
  if (source === 'gf') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-brand-50 text-brand-700 border border-brand-200 px-1.5 py-0.5 rounded-full">
      🔥 GF
    </span>
  )
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-50 text-gray-500 border border-gray-200 px-1.5 py-0.5 rounded-full">
      📄 Docs
    </span>
  )
}

export default function ClientsClient() {
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'total' | 'recent' | 'nb_docs' | 'achats_gf'>('recent')
  const [filterSource, setFilterSource] = useState<'all' | 'gf' | 'docs' | 'both'>('all')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/merchant/clients')
      if (res.ok) setClients(await res.json())
    } catch { /* silent */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = clients
    .filter(c => {
      if (filterSource !== 'all' && c.source !== filterSource) return false
      if (!search) return true
      const q = search.toLowerCase()
      return c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)
    })
    .sort((a, b) => {
      if (sortBy === 'total')     return (b.total_facture_fcfa + b.total_achats_gf) - (a.total_facture_fcfa + a.total_achats_gf)
      if (sortBy === 'achats_gf') return b.total_achats_gf - a.total_achats_gf
      if (sortBy === 'nb_docs')   return (b.nb_devis + b.nb_factures + b.nb_transactions_gf) - (a.nb_devis + a.nb_factures + a.nb_transactions_gf)
      return new Date(b.derniere_interaction).getTime() - new Date(a.derniere_interaction).getTime()
    })

  const totalClients     = clients.length
  const gfClients        = clients.filter(c => c.source === 'gf' || c.source === 'both').length
  const totalGfVolume    = clients.reduce((s, c) => s + c.total_achats_gf, 0)
  const totalFactureSum  = clients.reduce((s, c) => s + c.total_facture_fcfa, 0)
  const paymentRate      = (() => {
    const paid  = clients.reduce((s, c) => s + c.factures_payees, 0)
    const total = clients.reduce((s, c) => s + c.nb_factures, 0)
    return total > 0 ? Math.round((paid / total) * 100) : 0
  })()
  const activeCount = clients.filter(c =>
    Math.floor((Date.now() - new Date(c.derniere_interaction).getTime()) / 86_400_000) <= 30
  ).length

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Carnet clients</h1>
        <p className="text-sm text-gray-500 mt-0.5">Transactions GreenFlame + devis et factures</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{totalClients}</div>
          <div className="text-xs text-gray-500 mt-1">Clients uniques</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-brand-600">{gfClients}</div>
          <div className="text-xs text-gray-500 mt-1">🔥 Via GreenFlame</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-lg font-bold text-gray-900">{fmtFcfa(totalGfVolume + totalFactureSum)}</div>
          <div className="text-xs text-gray-500 mt-1">Volume total</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{activeCount}</div>
          <div className="text-xs text-gray-500 mt-1">Actifs (30j)</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          placeholder="Rechercher par nom ou téléphone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-brand-500"
        />
        <select
          value={filterSource}
          onChange={e => setFilterSource(e.target.value as any)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
        >
          <option value="all">Tous les clients</option>
          <option value="gf">🔥 Via GreenFlame</option>
          <option value="docs">📄 Via documents</option>
          <option value="both">🔥+📄 Les deux</option>
        </select>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
        >
          <option value="recent">Trier par dernière interaction</option>
          <option value="total">Trier par volume total</option>
          <option value="achats_gf">Trier par achats GreenFlame</option>
          <option value="nb_docs">Trier par nombre d'interactions</option>
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-2">👥</div>
          <div className="font-medium">
            {clients.length === 0 ? 'Aucun client encore' : 'Aucun résultat'}
          </div>
          {clients.length === 0 && (
            <>
              <div className="text-sm mt-1 text-gray-400">Les clients apparaissent après une transaction ou un document.</div>
              <Link href="/merchant/tools/facture" className="inline-block mt-3 text-sm text-brand-600 hover:underline">
                Créer une facture →
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="min-w-full w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-center px-4 py-3">Source</th>
                <th className="text-center px-4 py-3">Statut</th>
                <th className="text-right px-4 py-3">Achats GF</th>
                <th className="text-right px-4 py-3">Facturé</th>
                <th className="text-center px-4 py-3">Docs</th>
                <th className="text-left px-4 py-3">Dernier contact</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c, i) => {
                const payRate = c.nb_factures > 0
                  ? Math.round((c.factures_payees / c.nb_factures) * 100)
                  : null
                const waLink = c.phone
                  ? `https://wa.me/${c.phone.replace(/\D/g, '')}`
                  : null
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.name}</div>
                      {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <SourceBadge source={c.source} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ClientStatus last={c.derniere_interaction} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.nb_transactions_gf > 0 ? (
                        <div>
                          <div className="font-medium text-brand-700">{fmtFcfa(c.total_achats_gf)}</div>
                          <div className="text-xs text-gray-400">{c.nb_transactions_gf} tx</div>
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {c.nb_factures > 0 ? (
                        <div>
                          <div className="font-medium text-gray-800">{fmtFcfa(c.total_facture_fcfa)}</div>
                          {payRate !== null && (
                            <div className={`text-xs ${payRate >= 80 ? 'text-green-600' : payRate >= 50 ? 'text-amber-500' : 'text-red-400'}`}>
                              {payRate}% payé
                            </div>
                          )}
                        </div>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-center text-xs text-gray-500">
                      {c.nb_devis > 0 && <span>{c.nb_devis} devis </span>}
                      {c.nb_factures > 0 && <span>{c.nb_factures} fact.</span>}
                      {c.nb_devis === 0 && c.nb_factures === 0 && '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                      {fmtDate(c.derniere_interaction)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 items-center">
                        <Link
                          href={`/merchant/tools/facture?client=${encodeURIComponent(c.name)}${c.phone ? `&phone=${encodeURIComponent(c.phone)}` : ''}`}
                          className="text-xs text-brand-600 hover:underline whitespace-nowrap"
                        >
                          + Facture
                        </Link>
                        {waLink && (
                          <a href={waLink} target="_blank" rel="noopener noreferrer" className="text-xs text-green-600 hover:underline">
                            WA
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Taux de paiement factures : <strong>{paymentRate}%</strong>
      </p>
    </div>
  )
}
