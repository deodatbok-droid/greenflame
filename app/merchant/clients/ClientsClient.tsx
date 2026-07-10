'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type ClientRecord = {
  client_name: string
  client_phone: string | null
  nb_devis: number
  nb_factures: number
  total_facture_fcfa: number
  devis_acceptes: number
  factures_payees: number
  derniere_interaction: string
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

export default function ClientsClient({ merchantId }: { merchantId: string }) {
  const supabase = createClient()
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<'total' | 'recent' | 'nb_docs'>('recent')

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('commercial_documents')
      .select('client_name, client_phone, type, status, total_fcfa, created_at')
      .eq('merchant_id', merchantId)
      .neq('status', 'annule')

    if (data) {
      // Agréger par client (nom + téléphone)
      const map = new Map<string, ClientRecord>()
      for (const doc of data) {
        const key = `${doc.client_name}||${doc.client_phone ?? ''}`
        const existing = map.get(key) ?? {
          client_name: doc.client_name,
          client_phone: doc.client_phone,
          nb_devis: 0,
          nb_factures: 0,
          total_facture_fcfa: 0,
          devis_acceptes: 0,
          factures_payees: 0,
          derniere_interaction: doc.created_at,
        }

        if (doc.type === 'devis') {
          existing.nb_devis++
          if (doc.status === 'accepte') existing.devis_acceptes++
        }
        if (doc.type === 'facture') {
          existing.nb_factures++
          existing.total_facture_fcfa += doc.total_fcfa
          if (doc.status === 'paye') existing.factures_payees++
        }
        if (doc.created_at > existing.derniere_interaction) {
          existing.derniere_interaction = doc.created_at
        }
        map.set(key, existing)
      }
      setClients(Array.from(map.values()))
    }
    setLoading(false)
  }, [merchantId])

  useEffect(() => { load() }, [load])

  const sorted = [...clients]
    .filter(c => {
      if (!search) return true
      const q = search.toLowerCase()
      return c.client_name.toLowerCase().includes(q) || (c.client_phone ?? '').includes(q)
    })
    .sort((a, b) => {
      if (sortBy === 'total')   return b.total_facture_fcfa - a.total_facture_fcfa
      if (sortBy === 'nb_docs') return (b.nb_devis + b.nb_factures) - (a.nb_devis + a.nb_factures)
      return new Date(b.derniere_interaction).getTime() - new Date(a.derniere_interaction).getTime()
    })

  const totalClients  = clients.length
  const totalFactureSum = clients.reduce((s, c) => s + c.total_facture_fcfa, 0)
  const paymentRate = clients.reduce((s, c) => s + c.factures_payees, 0) /
                      Math.max(1, clients.reduce((s, c) => s + c.nb_factures, 0))

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Carnet clients</h1>
        <p className="text-sm text-gray-500 mt-0.5">Agrégé depuis vos devis et factures</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{totalClients}</div>
          <div className="text-xs text-gray-500 mt-1">Clients uniques</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">{fmtFcfa(totalFactureSum)}</div>
          <div className="text-xs text-gray-500 mt-1">Total facturé</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-green-600">{Math.round(paymentRate * 100)}%</div>
          <div className="text-xs text-gray-500 mt-1">Taux de paiement</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="text-2xl font-bold text-gray-900">
            {clients.filter(c => Math.floor((Date.now() - new Date(c.derniere_interaction).getTime()) / 86_400_000) <= 30).length}
          </div>
          <div className="text-xs text-gray-500 mt-1">Actifs (30 derniers jours)</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Rechercher par nom ou téléphone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 focus:outline-none focus:border-brand-500"
        />
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as any)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
        >
          <option value="recent">Trier par dernière interaction</option>
          <option value="total">Trier par total facturé</option>
          <option value="nb_docs">Trier par nombre de documents</option>
        </select>
      </div>

      {/* Liste clients */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Chargement…</div>
      ) : sorted.length === 0 ? (
        <div className="text-center py-12 text-gray-400 bg-white rounded-xl border border-gray-200">
          <div className="text-4xl mb-2">👥</div>
          <div className="font-medium">Aucun client encore</div>
          <div className="text-sm mt-1">Créez vos premiers devis ou factures pour voir vos clients ici.</div>
          <Link href="/merchant/tools/devis" className="inline-block mt-3 text-sm text-brand-600 hover:underline">
            Créer un devis →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="min-w-full w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-xs text-gray-500 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Client</th>
                <th className="text-center px-4 py-3">Statut</th>
                <th className="text-center px-4 py-3">Devis</th>
                <th className="text-center px-4 py-3">Factures</th>
                <th className="text-right px-4 py-3">Total facturé</th>
                <th className="text-center px-4 py-3">Taux paiement</th>
                <th className="text-left px-4 py-3">Dernier contact</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map((c, i) => {
                const payRate = c.nb_factures > 0 ? Math.round((c.factures_payees / c.nb_factures) * 100) : null
                const waLink = c.client_phone
                  ? `https://wa.me/${c.client_phone.replace(/\D/g, '')}`
                  : null
                return (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{c.client_name}</div>
                      {c.client_phone && (
                        <div className="text-xs text-gray-400">{c.client_phone}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ClientStatus last={c.derniere_interaction} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-gray-800">{c.nb_devis}</span>
                      {c.devis_acceptes > 0 && (
                        <span className="text-xs text-green-600 ml-1">({c.devis_acceptes} acc.)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="font-medium text-gray-800">{c.nb_factures}</span>
                      {c.factures_payees > 0 && (
                        <span className="text-xs text-green-600 ml-1">({c.factures_payees} pay.)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {fmtFcfa(c.total_facture_fcfa)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {payRate !== null ? (
                        <span className={payRate >= 80 ? 'text-green-600 font-medium' : payRate >= 50 ? 'text-amber-500 font-medium' : 'text-red-500 font-medium'}>
                          {payRate}%
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(c.derniere_interaction)}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <Link href="/merchant/tools/facture" className="text-xs text-brand-600 hover:underline whitespace-nowrap">
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
    </div>
  )
}
