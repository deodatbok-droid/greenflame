'use client'

import { useState, useMemo } from 'react'

interface Entry {
  id: string
  first_name: string
  last_name: string
  email: string | null
  whatsapp: string
  role: string
  referral_code: string
  created_at: string
  referred_by_id: string | null
  referrer_name: string | null
}

export default function WaitlistAdminClient({ entries }: { entries: Entry[] }) {
  const [filter, setFilter] = useState<'all' | 'user' | 'merchant'>('all')
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    return entries.filter(e => {
      if (filter !== 'all' && e.role !== filter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return (
          e.first_name.toLowerCase().includes(q) ||
          e.last_name.toLowerCase().includes(q) ||
          e.whatsapp.includes(q) ||
          (e.email ?? '').toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [entries, filter, search])

  const total     = entries.length
  const merchants = entries.filter(e => e.role === 'merchant').length
  const buyers    = entries.filter(e => e.role === 'user').length
  const referred  = entries.filter(e => e.referred_by_id).length

  function exportCsv() {
    const headers = ['Prénom', 'Nom', 'WhatsApp', 'Email', 'Rôle', 'Parrain', 'Code', 'Date']
    const rows = filtered.map(e => [
      e.first_name,
      e.last_name,
      e.whatsapp,
      e.email ?? '',
      e.role === 'merchant' ? 'Marchand' : 'Acheteur',
      e.referrer_name ?? '',
      e.referral_code,
      new Date(e.created_at).toLocaleString('fr-FR'),
    ])
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url
    a.download = `waitlist-greenflame-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-6xl">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Liste d&apos;attente</h1>
          <p className="text-gray-400 text-sm mt-1">Pré-inscriptions avant le lancement officiel</p>
        </div>
        <button
          onClick={exportCsv}
          className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium rounded-xl transition-colors"
        >
          ↓ Exporter CSV
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total inscrits',   value: total,     color: 'text-white'       },
          { label: 'Acheteurs',        value: buyers,    color: 'text-blue-400'    },
          { label: 'Marchands',        value: merchants, color: 'text-amber-400'   },
          { label: 'Via parrainage',   value: referred,  color: 'text-green-400'   },
        ].map(s => (
          <div key={s.label} className="bg-gray-800 rounded-xl p-4 border border-gray-700">
            <p className="text-gray-400 text-xs mb-2">{s.label}</p>
            <p className={`text-3xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filtres + recherche */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-1 bg-gray-800 rounded-xl p-1 border border-gray-700">
          {(['all', 'user', 'merchant'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-brand-600 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {f === 'all' ? `Tous (${total})` : f === 'user' ? `Acheteurs (${buyers})` : `Marchands (${merchants})`}
            </button>
          ))}
        </div>
        <input
          type="search"
          placeholder="Recherche nom, WhatsApp, email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
        />
      </div>

      {/* Tableau */}
      <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-xs text-gray-400 font-medium">
                <th className="text-left px-4 py-3">Nom</th>
                <th className="text-left px-4 py-3">WhatsApp</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-center px-4 py-3">Rôle</th>
                <th className="text-left px-4 py-3">Parrain</th>
                <th className="text-left px-4 py-3">Code</th>
                <th className="text-right px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    Aucune inscription trouvée
                  </td>
                </tr>
              ) : filtered.map(e => (
                <tr key={e.id} className="hover:bg-gray-700/30 transition-colors">
                  <td className="px-4 py-3 font-medium text-white whitespace-nowrap">
                    {e.first_name} {e.last_name}
                  </td>
                  <td className="px-4 py-3 text-gray-300 tabular-nums">
                    {e.whatsapp}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {e.email ?? <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      e.role === 'merchant'
                        ? 'bg-amber-900/30 text-amber-400'
                        : 'bg-blue-900/30 text-blue-400'
                    }`}>
                      {e.role === 'merchant' ? '🏪 Marchand' : '🛒 Acheteur'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {e.referrer_name ?? <span className="text-gray-600">Organique</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-brand-400 bg-brand-900/20 px-2 py-0.5 rounded">
                      {e.referral_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-xs text-gray-500 tabular-nums whitespace-nowrap">
                    {new Date(e.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit', month: 'short', year: 'numeric',
                    })}
                    <br />
                    <span className="text-gray-600">
                      {new Date(e.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length > 0 && (
          <div className="px-4 py-3 border-t border-gray-700 text-xs text-gray-500">
            {filtered.length} inscription{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''}
          </div>
        )}
      </div>

    </div>
  )
}
