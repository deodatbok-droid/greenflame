'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'

/* ── Types ── */
interface Agent {
  agent: { id: string; full_name: string; phone: string }
  account: { id: string; balance_fcfa: number; float_limit_fcfa: number; is_active: boolean } | null
}

interface Application {
  id: string
  status: string
  business_name: string
  assigned_agent_id: string | null
  visit_done_at: string | null
  created_at: string
  applicant: { full_name: string; phone: string } | null
  agent: { full_name: string } | null
}

const STATUS_CFG: Record<string, { label: string; color: string }> = {
  pending_review:  { label: 'En attente',       color: 'bg-yellow-900/40 text-yellow-300' },
  assigned:        { label: 'Assigné',           color: 'bg-blue-900/40 text-blue-300'    },
  field_verified:  { label: 'Vérifié terrain',   color: 'bg-teal-900/40 text-teal-300'   },
  pending_admin:   { label: 'Admin en attente',  color: 'bg-purple-900/40 text-purple-300'},
  approved:        { label: 'Approuvé',          color: 'bg-green-900/40 text-green-300'  },
  rejected:        { label: 'Rejeté',            color: 'bg-red-900/40 text-red-400'      },
}

/* ── Composant principal ── */
export default function AdminFieldAgentsPage() {
  const [agents, setAgents]       = useState<Agent[]>([])
  const [apps, setApps]           = useState<Application[]>([])
  const [loading, setLoading]     = useState(true)
  const [selected, setSelected]   = useState<Agent | null>(null)
  const [creditAmt, setCreditAmt] = useState('')
  const [creditLim, setCreditLim] = useState('')
  const [crediting, setCrediting] = useState(false)
  const [tab, setTab]             = useState<'agents' | 'dossiers'>('agents')
  const [agentFilter, setAgentFilter] = useState<string>('all')

  const load = useCallback(async () => {
    setLoading(true)
    const [floatRes, appsRes] = await Promise.all([
      fetch('/api/admin/float').then(r => r.json()),
      fetch('/api/admin/merchant-applications').then(r => r.json()),
    ])
    setAgents(Array.isArray(floatRes) ? floatRes : [])
    setApps(Array.isArray(appsRes) ? appsRes : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  /* ── Stats par agent ── */
  function agentStats(agentId: string) {
    const mine = apps.filter(a => a.assigned_agent_id === agentId)
    return {
      total:   mine.length,
      visited: mine.filter(a => a.visit_done_at).length,
      pending: mine.filter(a => ['assigned', 'field_verified'].includes(a.status)).length,
    }
  }

  async function creditFloat(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    const amt = parseInt(creditAmt, 10)
    if (!amt || amt <= 0) { toast.error('Montant invalide'); return }

    setCrediting(true)
    const res = await fetch(`/api/admin/float/${selected.agent.id}/credit`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        amount_fcfa:      amt,
        float_limit_fcfa: creditLim ? parseInt(creditLim, 10) : undefined,
      }),
    })
    const d = await res.json()
    setCrediting(false)

    if (d.ok) {
      toast.success(`Float de ${selected.agent.full_name} crédité (+${formatFcfa(amt)})`)
      setSelected(null)
      setCreditAmt('')
      setCreditLim('')
      load()
    } else {
      toast.error(d.error ?? 'Erreur')
    }
  }

  const filteredApps = agentFilter === 'all'
    ? apps
    : apps.filter(a => a.assigned_agent_id === agentFilter)

  const unassigned = apps.filter(a => !a.assigned_agent_id && a.status === 'pending_review')

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-6xl">

      {/* ── En-tête ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agents de terrain</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {agents.length} agent{agents.length !== 1 ? 's' : ''} · {apps.length} dossier{apps.length !== 1 ? 's' : ''} total
          </p>
        </div>
        <Link
          href="/admin/users"
          className="text-xs text-brand-400 hover:text-brand-300 border border-brand-800 hover:border-brand-600 px-3 py-1.5 rounded-lg transition-colors"
        >
          Promouvoir un agent →
        </Link>
      </div>

      {/* ── Alerte dossiers non assignés ── */}
      {unassigned.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700/40 rounded-xl px-4 py-3 flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <p className="text-yellow-300 text-sm">
            <span className="font-semibold">{unassigned.length} dossier{unassigned.length > 1 ? 's' : ''}</span> en attente d'assignation à un agent.{' '}
            <button className="underline hover:no-underline" onClick={() => { setTab('dossiers'); setAgentFilter('all') }}>
              Voir les dossiers
            </button>
          </p>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="flex gap-1 bg-gray-800/50 rounded-xl p-1 w-fit">
        {(['agents', 'dossiers'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-gray-700 text-white' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            {t === 'agents' ? `👤 Agents (${agents.length})` : `📋 Dossiers (${apps.length})`}
          </button>
        ))}
      </div>

      {/* ══ TAB AGENTS ══════════════════════════════════════════════ */}
      {tab === 'agents' && (
        <div className="space-y-3">
          {agents.length === 0 ? (
            <div className="bg-gray-800/40 rounded-2xl p-10 text-center">
              <p className="text-3xl mb-3">🤷</p>
              <p className="text-gray-300 font-semibold">Aucun agent de terrain</p>
              <p className="text-gray-500 text-sm mt-1">
                Allez dans <Link href="/admin/users" className="text-brand-400 underline">Membres</Link> pour promouvoir un utilisateur en <code className="text-brand-300">field_agent</code>.
              </p>
            </div>
          ) : (
            agents.map(({ agent, account }) => {
              const stats = agentStats(agent.id)
              const pct   = account ? Math.min(Math.round((account.balance_fcfa / account.float_limit_fcfa) * 100), 100) : 0

              return (
                <div key={agent.id} className="bg-gray-800/60 border border-gray-700/50 rounded-2xl p-5">
                  <div className="flex items-start gap-4">

                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-brand-900/60 border border-brand-700/40 flex items-center justify-center text-brand-400 font-bold text-sm flex-shrink-0">
                      {agent.full_name.charAt(0).toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-white font-semibold">{agent.full_name}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${account?.is_active ? 'bg-green-900/40 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                          {account?.is_active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      <p className="text-gray-400 text-sm">{agent.phone}</p>

                      {/* Stats */}
                      <div className="flex gap-4 mt-3 text-sm">
                        <div className="text-center">
                          <p className="text-white font-bold">{stats.total}</p>
                          <p className="text-gray-500 text-xs">Dossiers</p>
                        </div>
                        <div className="text-center">
                          <p className="text-brand-400 font-bold">{stats.visited}</p>
                          <p className="text-gray-500 text-xs">Visités</p>
                        </div>
                        <div className="text-center">
                          <p className="text-yellow-400 font-bold">{stats.pending}</p>
                          <p className="text-gray-500 text-xs">En cours</p>
                        </div>
                      </div>
                    </div>

                    {/* Float */}
                    <div className="text-right flex-shrink-0">
                      {account ? (
                        <>
                          <p className="text-brand-300 font-bold text-lg">{formatFcfa(account.balance_fcfa)}</p>
                          <p className="text-gray-500 text-xs">/ {formatFcfa(account.float_limit_fcfa)}</p>
                          <div className="w-24 h-1.5 bg-gray-700 rounded-full mt-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${pct > 70 ? 'bg-brand-500' : pct > 30 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </>
                      ) : (
                        <p className="text-gray-500 text-xs">Pas de float</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => { setSelected({ agent, account }); setTab('agents') }}
                      className="flex-1 text-xs bg-brand-900/40 hover:bg-brand-900/70 text-brand-300 border border-brand-800/60 py-2 rounded-xl transition-colors"
                    >
                      💵 Créditer float
                    </button>
                    <button
                      onClick={() => { setAgentFilter(agent.id); setTab('dossiers') }}
                      className="flex-1 text-xs bg-gray-700/40 hover:bg-gray-700/70 text-gray-300 border border-gray-600/60 py-2 rounded-xl transition-colors"
                    >
                      📋 Voir ses dossiers
                    </button>
                    <Link
                      href={`/admin/users/${agent.id}`}
                      className="flex-1 text-center text-xs bg-gray-700/40 hover:bg-gray-700/70 text-gray-300 border border-gray-600/60 py-2 rounded-xl transition-colors"
                    >
                      👤 Profil
                    </Link>
                  </div>

                  {/* Panel crédit float (inline) */}
                  {selected?.agent.id === agent.id && (
                    <form onSubmit={creditFloat} className="mt-4 bg-gray-900/60 border border-gray-700/50 rounded-xl p-4 space-y-3">
                      <p className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Créditer le float</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Montant (FCFA) *</label>
                          <input
                            type="number"
                            value={creditAmt}
                            onChange={e => setCreditAmt(e.target.value)}
                            placeholder="Ex : 50 000"
                            min="1"
                            className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:border-brand-500 focus:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-400 block mb-1">Nouveau plafond (optionnel)</label>
                          <input
                            type="number"
                            value={creditLim}
                            onChange={e => setCreditLim(e.target.value)}
                            placeholder={account ? String(account.float_limit_fcfa) : '100 000'}
                            min="1"
                            className="w-full bg-gray-800 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:border-brand-500 focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" disabled={crediting} className="flex-1 bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white text-sm font-semibold py-2 rounded-lg transition-colors">
                          {crediting ? 'Traitement…' : 'Confirmer le crédit'}
                        </button>
                        <button type="button" onClick={() => setSelected(null)} className="px-4 bg-gray-700 text-gray-400 text-sm py-2 rounded-lg hover:bg-gray-600 transition-colors">
                          Annuler
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ══ TAB DOSSIERS ════════════════════════════════════════════ */}
      {tab === 'dossiers' && (
        <div className="space-y-4">

          {/* Filtre par agent */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setAgentFilter('all')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${agentFilter === 'all' ? 'bg-brand-600 border-brand-500 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}`}
            >
              Tous
            </button>
            <button
              onClick={() => setAgentFilter('none')}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${agentFilter === 'none' ? 'bg-yellow-700 border-yellow-600 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}`}
            >
              Non assignés ({unassigned.length})
            </button>
            {agents.map(({ agent }) => (
              <button
                key={agent.id}
                onClick={() => setAgentFilter(agent.id)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${agentFilter === agent.id ? 'bg-brand-700 border-brand-600 text-white' : 'bg-gray-800 border-gray-600 text-gray-400 hover:text-white'}`}
              >
                {agent.full_name.split(' ')[0]}
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-2xl border border-gray-700/50">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700/50" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <th className="text-left text-xs text-gray-500 font-semibold uppercase tracking-wide px-4 py-3">Marchand</th>
                  <th className="text-left text-xs text-gray-500 font-semibold uppercase tracking-wide px-4 py-3">Statut</th>
                  <th className="text-left text-xs text-gray-500 font-semibold uppercase tracking-wide px-4 py-3">Agent assigné</th>
                  <th className="text-left text-xs text-gray-500 font-semibold uppercase tracking-wide px-4 py-3">Visite</th>
                  <th className="text-left text-xs text-gray-500 font-semibold uppercase tracking-wide px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/30">
                {(agentFilter === 'none'
                  ? unassigned
                  : agentFilter === 'all'
                    ? apps
                    : filteredApps
                ).map(app => {
                  const cfg = STATUS_CFG[app.status] ?? { label: app.status, color: 'bg-gray-700 text-gray-400' }
                  return (
                    <tr key={app.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-white font-medium">{app.business_name}</p>
                        <p className="text-gray-500 text-xs">{app.applicant?.full_name} · {app.applicant?.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-semibold px-2 py-1 rounded-full ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {app.agent?.full_name ?? <span className="text-yellow-500">Non assigné</span>}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {app.visit_done_at
                          ? new Date(app.visit_done_at).toLocaleDateString('fr-FR')
                          : '—'
                        }
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/merchants/applications/${app.id}`}
                          className="text-xs text-brand-400 hover:text-brand-300 underline"
                        >
                          Voir →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
                {filteredApps.length === 0 && agentFilter !== 'all' && agentFilter !== 'none' && (
                  <tr>
                    <td colSpan={5} className="text-center text-gray-500 py-8 text-sm">
                      Aucun dossier pour cet agent
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
