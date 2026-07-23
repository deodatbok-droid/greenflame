'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'

interface AgentFloat {
  agent: { id: string; full_name: string; phone: string }
  account: {
    id: string
    balance_fcfa: number
    float_limit_fcfa: number
    is_active: boolean
  } | null
}

export default function AdminFloatPage() {
  const [data, setData]       = useState<AgentFloat[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<AgentFloat | null>(null)
  const [amount, setAmount]   = useState('')
  const [limit, setLimit]     = useState('')
  const [notes, setNotes]     = useState('')
  const [crediting, setCrediting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/admin/float')
    const d   = res.ok ? await res.json() : []
    setData(Array.isArray(d) ? d : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function creditFloat(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const amt = parseInt(amount, 10)
    if (!amt || amt <= 0) { toast.error('Montant invalide'); return }

    setCrediting(true)
    const res = await fetch(`/api/admin/float/${selected.agent.id}/credit`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        amount_fcfa:      amt,
        float_limit_fcfa: limit ? parseInt(limit, 10) : undefined,
        notes:            notes.trim() || undefined,
      }),
    })
    const d = await res.json()
    setCrediting(false)

    if (d.ok) {
      toast.success(`Float de ${selected.agent.full_name} alimenté (+${formatFcfa(amt)})`)
      setSelected(null)
      setAmount('')
      setLimit('')
      setNotes('')
      load()
    } else {
      toast.error(d.error ?? 'Erreur')
    }
  }

  const totalFloat = data.reduce((s, d) => s + (d.account?.balance_fcfa ?? 0), 0)

  return (
    <div className="max-w-4xl space-y-6">

      <div className="flex items-center gap-3">
        <Link href="/admin/dashboard" className="text-gray-400 hover:text-white text-sm">← Dashboard</Link>
        <span className="text-gray-600">/</span>
        <span className="text-gray-400 text-sm">Float agents</span>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white">Float agents terrain</h1>
          <p className="text-gray-400 text-sm mt-1">
            {data.length} agent(s) · Total float : {formatFcfa(totalFloat)}
          </p>
        </div>
      </div>

      {/* Modal crédit */}
      {selected && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md space-y-5">
            <div>
              <h2 className="font-bold text-xl text-white">Alimenter le float</h2>
              <p className="text-gray-400 text-sm mt-0.5">
                {selected.agent.full_name} · Solde actuel : {formatFcfa(selected.account?.balance_fcfa ?? 0)}
              </p>
            </div>
            <form onSubmit={creditFloat} className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">Montant à créditer (FCFA) *</label>
                <input
                  type="number"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="Ex : 50000"
                  min="1"
                  className="input w-full"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">
                  Nouveau plafond (FCFA)
                  <span className="text-gray-600 ml-1">— actuel : {formatFcfa(selected.account?.float_limit_fcfa ?? 200000)}</span>
                </label>
                <input
                  type="number"
                  value={limit}
                  onChange={e => setLimit(e.target.value)}
                  placeholder="Laisser vide pour conserver"
                  className="input w-full"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">Notes (optionnel)</label>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Ex : Remise de cash marché Dantokpa" className="input w-full" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={crediting}
                  className="flex-1 bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded-xl transition-colors disabled:opacity-60">
                  {crediting ? 'Crédit…' : 'Créditer le float'}
                </button>
                <button type="button" onClick={() => { setSelected(null); setAmount(''); setLimit(''); setNotes('') }}
                  className="flex-1 bg-gray-700 text-gray-300 font-semibold py-3 rounded-xl hover:bg-gray-600 transition-colors">
                  Annuler
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Liste agents */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="text-center py-12 text-gray-500">Aucun agent terrain enregistré</div>
      ) : (
        <div className="bg-gray-800 rounded-xl overflow-x-auto">
          <table className="min-w-full w-full">
            <thead className="border-b border-gray-700">
              <tr>
                {['Agent', 'Solde float', 'Plafond', 'Statut', 'Action'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700/50">
              {data.map(row => {
                const acc   = row.account
                const pct   = acc ? Math.round((acc.balance_fcfa / acc.float_limit_fcfa) * 100) : 0
                const color = pct > 60 ? 'bg-green-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'
                return (
                  <tr key={row.agent.id} className="hover:bg-gray-900/40 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-white">{row.agent.full_name}</p>
                      <p className="text-xs text-gray-400">{row.agent.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      {acc ? (
                        <div>
                          <p className="text-sm font-bold text-white">{formatFcfa(acc.balance_fcfa)}</p>
                          <div className="h-1.5 bg-gray-700 rounded-full w-24 mt-1.5 overflow-hidden">
                            <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">Pas de compte</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {acc ? formatFcfa(acc.float_limit_fcfa) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {acc ? (
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${acc.is_active ? 'text-green-400 bg-green-900/40' : 'text-red-400 bg-red-900/40'}`}>
                          {acc.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => { setSelected(row); setLimit(String(acc?.float_limit_fcfa ?? 200000)) }}
                        className="text-xs font-semibold text-brand-400 hover:text-brand-300 transition-colors"
                      >
                        Alimenter →
                      </button>
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
