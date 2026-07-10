'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FundSummary {
  total_fonds:                  number
  total_pool_recompenses:       number
  total_pool_evenements:        number
  nb_transactions:              number
  total_distribue_recompenses:  number
  total_distribue_evenements:   number
}

interface LedgerEntry {
  id:               string
  transaction_id:   string
  amount_fcfa:      number
  pool_recompenses: number
  pool_evenements:  number
  created_at:       string
}

interface DistribEntry {
  id:             string
  pool_type:      'recompenses' | 'evenements'
  amount_fcfa:    number
  recipient_id:   string | null
  description:    string
  distributed_at: string
  users:          { full_name: string } | null
  admins:         { full_name: string } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString('fr-FR') + ' F'
}

function fmtDate(d: string): string {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RewardsFundPage() {
  const supabase = createClient()

  const [summary,   setSummary]   = useState<FundSummary | null>(null)
  const [ledger,    setLedger]    = useState<LedgerEntry[]>([])
  const [distribs,  setDistribs]  = useState<DistribEntry[]>([])
  const [loading,   setLoading]   = useState(true)
  const [tab,       setTab]       = useState<'apercu' | 'credits' | 'distributions'>('apercu')

  // Distribution form
  const [form, setForm] = useState({
    pool_type:    'recompenses' as 'recompenses' | 'evenements',
    amount_fcfa:  '',
    recipient_id: '',
    description:  '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg,  setSubmitMsg]  = useState<{ ok: boolean; msg: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [sumRes, ledgerRes, distribRes] = await Promise.all([
      supabase.from('rewards_fund_summary').select('*').single(),
      supabase.from('rewards_fund_ledger').select('*').order('created_at', { ascending: false }).limit(50),
      supabase
        .from('rewards_fund_distributions')
        .select('*, users:recipient_id(full_name), admins:distributed_by(full_name)')
        .order('distributed_at', { ascending: false })
        .limit(50),
    ])
    if (sumRes.data)    setSummary(sumRes.data as FundSummary)
    if (ledgerRes.data) setLedger(ledgerRes.data as LedgerEntry[])
    if (distribRes.data) setDistribs(distribRes.data as unknown as DistribEntry[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const handleDistrib = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setSubmitMsg(null)
    const amount = parseInt(form.amount_fcfa, 10)
    if (!amount || amount <= 0 || !form.description.trim()) {
      setSubmitMsg({ ok: false, msg: 'Montant et description requis.' })
      setSubmitting(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    const payload: Record<string, unknown> = {
      pool_type:      form.pool_type,
      amount_fcfa:    amount,
      description:    form.description.trim(),
      distributed_by: user?.id ?? null,
    }
    if (form.recipient_id.trim()) payload.recipient_id = form.recipient_id.trim()

    const { error } = await supabase.from('rewards_fund_distributions').insert(payload)
    if (error) {
      setSubmitMsg({ ok: false, msg: error.message })
    } else {
      setSubmitMsg({ ok: true, msg: 'Distribution enregistrée.' })
      setForm({ pool_type: 'recompenses', amount_fcfa: '', recipient_id: '', description: '' })
      load()
    }
    setSubmitting(false)
  }

  // Soldes disponibles (total accumulé - total distribué)
  const soldeRecomp   = (summary?.total_pool_recompenses ?? 0) - (summary?.total_distribue_recompenses ?? 0)
  const soldeEvenem   = (summary?.total_pool_evenements  ?? 0) - (summary?.total_distribue_evenements  ?? 0)
  const soldGlobal    = soldeRecomp + soldeEvenem

  return (
    <div className="max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">🎁 Fonds Récompenses / Événements</h1>
        <p className="text-sm text-gray-400 mt-1">
          3% prélevé sur chaque commission marchande — 30% récompenses · 70% événements
        </p>
      </div>

      {loading ? (
        <div className="text-gray-400 py-12 text-center">Chargement…</div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Solde disponible global"   value={fmt(soldGlobal)}  accent="emerald" />
            <KpiCard label="Pool Récompenses (30%)"    value={fmt(soldeRecomp)} sub={`/${fmt(summary?.total_pool_recompenses ?? 0)} accumulé`} accent="amber" />
            <KpiCard label="Pool Événements (70%)"     value={fmt(soldeEvenem)} sub={`/${fmt(summary?.total_pool_evenements ?? 0)} accumulé`}  accent="violet" />
            <KpiCard label="Transactions créditantes"  value={String(summary?.nb_transactions ?? 0)} accent="sky" />
          </div>

          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-700">
            {(['apercu', 'credits', 'distributions'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  tab === t
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-gray-400 hover:text-white'
                }`}
              >
                {t === 'apercu' ? 'Aperçu' : t === 'credits' ? 'Crédits reçus' : 'Distributions'}
              </button>
            ))}
          </div>

          {/* Tab: Aperçu */}
          {tab === 'apercu' && (
            <div className="grid md:grid-cols-2 gap-6">

              {/* Pool Récompenses */}
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h2 className="text-amber-400 font-semibold mb-3">🏆 Pool Récompenses</h2>
                <Row label="Accumulé total"   value={fmt(summary?.total_pool_recompenses ?? 0)} />
                <Row label="Distribué"        value={fmt(summary?.total_distribue_recompenses ?? 0)} />
                <Row label="Solde disponible" value={fmt(soldeRecomp)} bold accent="amber" />
                <p className="text-xs text-gray-500 mt-3">
                  Utilisé pour les récompenses individuelles (paliers de carrière, tirages cagnotte, etc.)
                </p>
              </div>

              {/* Pool Événements */}
              <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h2 className="text-violet-400 font-semibold mb-3">🎉 Pool Événements</h2>
                <Row label="Accumulé total"   value={fmt(summary?.total_pool_evenements ?? 0)} />
                <Row label="Distribué"        value={fmt(summary?.total_distribue_evenements ?? 0)} />
                <Row label="Solde disponible" value={fmt(soldeEvenem)} bold accent="violet" />
                <p className="text-xs text-gray-500 mt-3">
                  Utilisé pour les événements collectifs (conférences nationales, cérémonies, etc.)
                </p>
              </div>

              {/* Formulaire distribution */}
              <div className="md:col-span-2 bg-gray-800 rounded-xl p-5 border border-gray-700">
                <h2 className="text-white font-semibold mb-4">Enregistrer une distribution</h2>
                <form onSubmit={handleDistrib} className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Pool *</label>
                      <select
                        value={form.pool_type}
                        onChange={e => setForm(f => ({ ...f, pool_type: e.target.value as 'recompenses' | 'evenements' }))}
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white"
                      >
                        <option value="recompenses">🏆 Récompenses</option>
                        <option value="evenements">🎉 Événements</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Montant (FCFA) *</label>
                      <input
                        type="number"
                        min="1"
                        value={form.amount_fcfa}
                        onChange={e => setForm(f => ({ ...f, amount_fcfa: e.target.value }))}
                        placeholder="ex : 150000"
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">ID bénéficiaire (laisser vide = collectif)</label>
                      <input
                        type="text"
                        value={form.recipient_id}
                        onChange={e => setForm(f => ({ ...f, recipient_id: e.target.value }))}
                        placeholder="UUID utilisateur (optionnel)"
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Description *</label>
                      <input
                        type="text"
                        value={form.description}
                        onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                        placeholder="ex : Récompense R6 Ambassadeur — Kofi A."
                        className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500"
                      />
                    </div>
                  </div>

                  {submitMsg && (
                    <p className={`text-sm ${submitMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>
                      {submitMsg.msg}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    {submitting ? 'Enregistrement…' : 'Enregistrer la distribution'}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Tab: Crédits reçus */}
          {tab === 'credits' && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-right">Total</th>
                      <th className="px-4 py-3 text-right">Récompenses</th>
                      <th className="px-4 py-3 text-right">Événements</th>
                      <th className="px-4 py-3 text-left">Ref. transaction</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Aucun crédit enregistré.</td></tr>
                    ) : ledger.map(e => (
                      <tr key={e.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{fmtDate(e.created_at)}</td>
                        <td className="px-4 py-3 text-white text-right font-mono">{fmt(e.amount_fcfa)}</td>
                        <td className="px-4 py-3 text-amber-400 text-right font-mono">{fmt(e.pool_recompenses)}</td>
                        <td className="px-4 py-3 text-violet-400 text-right font-mono">{fmt(e.pool_evenements)}</td>
                        <td className="px-4 py-3 text-gray-500 font-mono text-xs">{e.transaction_id.slice(0, 8).toUpperCase()}…</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab: Distributions */}
          {tab === 'distributions' && (
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
                      <th className="px-4 py-3 text-left">Date</th>
                      <th className="px-4 py-3 text-left">Pool</th>
                      <th className="px-4 py-3 text-right">Montant</th>
                      <th className="px-4 py-3 text-left">Bénéficiaire</th>
                      <th className="px-4 py-3 text-left">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distribs.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">Aucune distribution enregistrée.</td></tr>
                    ) : distribs.map(d => (
                      <tr key={d.id} className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors">
                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{fmtDate(d.distributed_at)}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            d.pool_type === 'recompenses'
                              ? 'bg-amber-900/40 text-amber-300'
                              : 'bg-violet-900/40 text-violet-300'
                          }`}>
                            {d.pool_type === 'recompenses' ? '🏆 Récompenses' : '🎉 Événements'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-white text-right font-mono font-semibold">{fmt(d.amount_fcfa)}</td>
                        <td className="px-4 py-3 text-gray-300">
                          {d.users?.full_name ?? (d.recipient_id ? d.recipient_id.slice(0, 8) + '…' : <span className="text-gray-500">Collectif</span>)}
                        </td>
                        <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{d.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ label, value, sub, accent = 'emerald' }: {
  label:   string
  value:   string
  sub?:    string
  accent?: 'emerald' | 'amber' | 'violet' | 'sky'
}) {
  const colors = {
    emerald: 'text-emerald-400',
    amber:   'text-amber-400',
    violet:  'text-violet-400',
    sky:     'text-sky-400',
  }
  return (
    <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-xl font-bold ${colors[accent]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-0.5">{sub}</p>}
    </div>
  )
}

function Row({ label, value, bold, accent }: {
  label:   string
  value:   string
  bold?:   boolean
  accent?: 'amber' | 'violet'
}) {
  const colorMap = { amber: 'text-amber-400', violet: 'text-violet-400' }
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-gray-700/50 last:border-0">
      <span className="text-sm text-gray-400">{label}</span>
      <span className={`text-sm font-mono ${bold ? (accent ? colorMap[accent] : 'text-white') + ' font-semibold' : 'text-gray-200'}`}>
        {value}
      </span>
    </div>
  )
}
