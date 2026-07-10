'use client'

/**
 * AdminFlammeClient — Interface admin pour gérer le système Flamme + Rang + Cagnotte
 */

import { useState } from 'react'
import Link from 'next/link'

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface CommunityStats {
  count_etincelle: number
  count_flamme: number
  count_brasier: number
  count_etoile: number
  count_soleil: number
  total_members: number
}

interface PotState {
  current_balance_fcfa: number
  total_contributed_fcfa: number
  total_drawn_fcfa: number
  active_contributors: number
  last_draw_at: string | null
}

interface DrawRecord {
  id: string
  amount_drawn_fcfa: number
  eligible_count: number
  status: string
  drawn_at: string | null
  created_at: string
  pot_winners?: Array<{
    amount_won_fcfa: number
    eligible_again_at: string
    users: { full_name: string; phone: string } | null
  }>
}

interface TopMember {
  user_id: string
  full_name: string
  phone: string
  score_flamme: number
  rang: string
  life_goals_covered: number
  flammes_activite: number
  flammes_autonomie: number
  updated_at: string
}

interface Props {
  communityStats: CommunityStats | null
  recentDraws: DrawRecord[]
  topMembers: TopMember[]
  pot: PotState | null
}

// ─── STYLE PAR RANG ──────────────────────────────────────────────────────────

const RANG_DISPLAY: Record<string, { emoji: string; color: string; label: string }> = {
  étincelle: { emoji: '✨', color: 'text-gray-500', label: 'Étincelle' },
  flamme:    { emoji: '🔥', color: 'text-orange-600', label: 'Flamme' },
  brasier:   { emoji: '🌋', color: 'text-red-600', label: 'Brasier' },
  étoile:    { emoji: '⭐', color: 'text-yellow-600', label: 'Étoile' },
  soleil:    { emoji: '☀️', color: 'text-amber-600', label: 'Soleil' },
}

function formatFcfa(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' F'
}

// ─── COMPOSANT ───────────────────────────────────────────────────────────────

export default function AdminFlammeClient({ communityStats, recentDraws, topMembers, pot }: Props) {
  const [drawLoading, setDrawLoading] = useState(false)
  const [drawAmount, setDrawAmount] = useState('')
  const [drawResult, setDrawResult] = useState<{ winnerName: string; amountWonFcfa: number } | null>(null)
  const [drawError, setDrawError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'tirage' | 'membres'>('overview')

  async function handleTriggerDraw() {
    setDrawLoading(true)
    setDrawError(null)
    setDrawResult(null)

    const amount = drawAmount ? Number(drawAmount) : undefined
    const res = await fetch('/api/cagnotte/draw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amountFcfa: amount }),
    })
    const data = await res.json()
    setDrawLoading(false)

    if (!res.ok || !data.success) {
      setDrawError(data.error ?? 'Erreur lors du tirage')
    } else {
      setDrawResult({ winnerName: data.result.winnerName, amountWonFcfa: data.result.amountWonFcfa })
    }
  }

  const stats = communityStats ?? {
    count_etincelle: 0, count_flamme: 0, count_brasier: 0,
    count_etoile: 0, count_soleil: 0, total_members: 0,
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🔥 Flamme + Rang</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tableau de bord communautaire</p>
        </div>
        <Link href="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Admin</Link>
      </div>

      {/* ── TABS ── */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl">
        {[
          { id: 'overview', label: 'Vue d\'ensemble' },
          { id: 'tirage', label: 'Cagnotte & Tirage' },
          { id: 'membres', label: 'Top membres' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors
              ${activeTab === tab.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── ONGLET VUE D'ENSEMBLE ── */}
      {activeTab === 'overview' && (
        <div className="space-y-4">
          {/* Distribution des rangs */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <h2 className="font-semibold text-gray-800 mb-4">Distribution des rangs</h2>
            <div className="space-y-3">
              {[
                { key: 'count_soleil', rang: 'soleil' },
                { key: 'count_etoile', rang: 'étoile' },
                { key: 'count_brasier', rang: 'brasier' },
                { key: 'count_flamme', rang: 'flamme' },
                { key: 'count_etincelle', rang: 'étincelle' },
              ].map(({ key, rang }) => {
                const count = stats[key as keyof typeof stats] as number
                const total = stats.total_members || 1
                const pct = Math.round((count / total) * 100)
                const display = RANG_DISPLAY[rang]

                return (
                  <div key={rang} className="flex items-center gap-3">
                    <span className="text-lg w-7">{display.emoji}</span>
                    <div className="flex-1">
                      <div className="flex justify-between text-sm mb-1">
                        <span className={`font-medium ${display.color}`}>{display.label}</span>
                        <span className="text-gray-500">{count} membres ({pct}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div
                          className="h-2 rounded-full bg-brand-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <p className="text-xs text-gray-400 mt-4 text-center">
              Total : {stats.total_members} membres dans le système Flamme
            </p>
          </div>

          {/* Highlights célébration */}
          {(stats.count_soleil > 0 || stats.count_etoile > 0) && (
            <div className="bg-gradient-to-r from-yellow-50 to-amber-50 rounded-2xl border border-yellow-200 p-4">
              <h3 className="font-semibold text-amber-800 mb-2">🎉 Membres à célébrer</h3>
              <div className="flex gap-4">
                {stats.count_soleil > 0 && (
                  <div className="text-center">
                    <p className="text-3xl">☀️</p>
                    <p className="text-2xl font-bold text-amber-600">{stats.count_soleil}</p>
                    <p className="text-xs text-gray-500">Soleil{stats.count_soleil > 1 ? 's' : ''}</p>
                  </div>
                )}
                {stats.count_etoile > 0 && (
                  <div className="text-center">
                    <p className="text-3xl">⭐</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.count_etoile}</p>
                    <p className="text-xs text-gray-500">Étoile{stats.count_etoile > 1 ? 's' : ''}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ONGLET CAGNOTTE & TIRAGE ── */}
      {activeTab === 'tirage' && (
        <div className="space-y-4">
          {/* État de la cagnotte */}
          <div className="bg-green-50 rounded-2xl border border-green-200 p-5">
            <h2 className="font-semibold text-green-800 mb-4">💰 État de la Cagnotte</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                <p className="text-xs text-gray-500">Balance disponible</p>
                <p className="text-2xl font-bold text-green-700">{formatFcfa(pot?.current_balance_fcfa ?? 0)}</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                <p className="text-xs text-gray-500">Contributeurs actifs</p>
                <p className="text-2xl font-bold text-gray-700">{pot?.active_contributors ?? 0}</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                <p className="text-xs text-gray-500">Total collecté</p>
                <p className="text-lg font-bold text-gray-700">{formatFcfa(pot?.total_contributed_fcfa ?? 0)}</p>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-gray-100">
                <p className="text-xs text-gray-500">Total distribué</p>
                <p className="text-lg font-bold text-gray-700">{formatFcfa(pot?.total_drawn_fcfa ?? 0)}</p>
              </div>
            </div>
          </div>

          {/* Déclenchement du tirage */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
            <h2 className="font-semibold text-gray-800">🎰 Déclencher un Tirage</h2>
            <p className="text-sm text-gray-500">
              Un gagnant sera sélectionné aléatoirement parmi les membres éligibles.
              Les autres membres recevront une consolation digitale.
            </p>

            <div className="flex gap-2">
              <input
                type="number"
                placeholder={`Montant (défaut: ${formatFcfa(pot?.current_balance_fcfa ?? 0)})`}
                value={drawAmount}
                onChange={e => setDrawAmount(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
              <button
                onClick={handleTriggerDraw}
                disabled={drawLoading || (pot?.current_balance_fcfa ?? 0) === 0}
                className={`px-4 py-2 rounded-xl font-semibold text-sm text-white transition-colors
                  ${drawLoading || (pot?.current_balance_fcfa ?? 0) === 0
                    ? 'bg-gray-300 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700'
                  }`}
              >
                {drawLoading ? '⏳' : '🎰 Tirer'}
              </button>
            </div>

            {drawError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                {drawError}
              </div>
            )}

            {drawResult && (
              <div className="bg-green-50 border border-green-300 rounded-xl p-4 text-center space-y-1">
                <p className="text-2xl">🎉</p>
                <p className="font-bold text-green-700 text-lg">{drawResult.winnerName}</p>
                <p className="text-green-600 font-semibold">{formatFcfa(drawResult.amountWonFcfa)}</p>
                <p className="text-xs text-gray-500">Re-éligible dans 6 mois</p>
              </div>
            )}
          </div>

          {/* Historique des tirages */}
          {recentDraws.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold text-gray-800 mb-3">Historique des tirages</h2>
              <div className="space-y-2">
                {recentDraws.map(draw => {
                  const winner = draw.pot_winners?.[0]
                  return (
                    <div key={draw.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                      <div>
                        <p className="text-sm font-medium text-gray-800">
                          {winner?.users?.full_name ?? 'En attente…'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {draw.drawn_at
                            ? new Date(draw.drawn_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
                            : 'Non tiré'
                          }
                          {' · '}{draw.eligible_count} éligibles
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-green-700">{formatFcfa(draw.amount_drawn_fcfa)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          draw.status === 'drawn' || draw.status === 'distributed'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {draw.status}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ONGLET TOP MEMBRES ── */}
      {activeTab === 'membres' && (
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-800">Top 20 membres par score Flamme</h2>
          </div>
          <div className="divide-y divide-gray-50">
            {topMembers.map((m, idx) => {
              const display = RANG_DISPLAY[m.rang] ?? RANG_DISPLAY['étincelle']
              return (
                <div key={m.user_id} className="flex items-center gap-3 px-4 py-3">
                  <span className="text-sm font-bold text-gray-400 w-6">{idx + 1}</span>
                  <div className="text-lg">{display.emoji}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{m.full_name}</p>
                    <p className="text-xs text-gray-400">{m.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-bold ${display.color}`}>{m.score_flamme.toFixed(1)} pts</p>
                    <p className="text-xs text-gray-400">
                      🔥{m.flammes_activite} ⭐{m.flammes_autonomie} — {m.life_goals_covered} obj.
                    </p>
                  </div>
                </div>
              )
            })}
            {topMembers.length === 0 && (
              <div className="text-center py-10 text-gray-400">
                <p className="text-3xl mb-2">✨</p>
                <p className="text-sm">Aucun membre dans le système Flamme pour l'instant.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
