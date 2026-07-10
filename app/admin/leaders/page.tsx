'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const RANK_CONFIG: Record<number, { name: string; color: string; bg: string }> = {
  0: { name: 'Starter',        color: '#7A7875', bg: '#f3f4f6' },
  1: { name: 'Étincelle',      color: '#D9A43A', bg: '#fffbeb' },
  2: { name: 'Créateur',       color: '#E87040', bg: '#fff7ed' },
  3: { name: 'Builder',        color: '#5BAD24', bg: '#f0fdf4' },
  4: { name: 'Leader Flamme',  color: '#4A9DEA', bg: '#eff6ff' },
  5: { name: 'Leader Brasier', color: '#8270D4', bg: '#f5f3ff' },
  6: { name: 'Ambassadeur',    color: '#20B08A', bg: '#f0fdfa' },
  7: { name: 'Kingmaker',      color: '#D94545', bg: '#fff1f2' },
  8: { name: 'Elder',          color: '#C49B1A', bg: '#fefce8' },
}

type LeaderRow = {
  user_id: string
  full_name: string | null
  phone: string | null
  current_rank: number
  verrou_structure_pct: number
  verrou_volume_pct: number
  verrou_marchands_pct: number
  rank_achieved_at: string | null
  direct_affiliates_count: number
  last_evaluated_at: string
}

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-gray-700 rounded-full h-1.5">
      <div
        className="h-1.5 rounded-full transition-all"
        style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
      />
    </div>
  )
}

function RankBadge({ rank }: { rank: number }) {
  const cfg = RANK_CONFIG[rank] ?? RANK_CONFIG[0]
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: cfg.bg, color: cfg.color, border: `1px solid ${cfg.color}33` }}
    >
      R{rank} — {cfg.name}
    </span>
  )
}

function fmtDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function AdminLeadersPage() {
  const supabase = createClient()
  const [leaders, setLeaders] = useState<LeaderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filterRank, setFilterRank] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('leader_career_ranks')
        .select(`
          user_id,
          current_rank,
          verrou_structure_pct,
          verrou_volume_pct,
          verrou_marchands_pct,
          rank_achieved_at,
          direct_affiliates_count,
          last_evaluated_at,
          users!leader_career_ranks_user_id_fkey(full_name, phone)
        `)
        .order('current_rank', { ascending: false })
        .order('verrou_structure_pct', { ascending: false })

      if (data) {
        setLeaders(data.map((d: any) => ({
          user_id: d.user_id,
          full_name: d.users?.full_name ?? null,
          phone: d.users?.phone ?? null,
          current_rank: d.current_rank,
          verrou_structure_pct: d.verrou_structure_pct,
          verrou_volume_pct: d.verrou_volume_pct,
          verrou_marchands_pct: d.verrou_marchands_pct,
          rank_achieved_at: d.rank_achieved_at,
          direct_affiliates_count: d.direct_affiliates_count,
          last_evaluated_at: d.last_evaluated_at,
        })))
      }
      setLoading(false)
    }
    load()
  }, [])

  const filtered = leaders.filter(l => {
    if (filterRank !== null && l.current_rank !== filterRank) return false
    if (search) {
      const q = search.toLowerCase()
      return (l.full_name ?? '').toLowerCase().includes(q) || (l.phone ?? '').includes(q)
    }
    return true
  })

  // Stats rapides
  const rankCounts: Record<number, number> = {}
  for (const l of leaders) rankCounts[l.current_rank] = (rankCounts[l.current_rank] ?? 0) + 1
  const kingmakers = leaders.filter(l => l.current_rank >= 7).length
  const closeToNext = leaders.filter(l =>
    l.current_rank < 8 &&
    Math.min(l.verrou_structure_pct, l.verrou_volume_pct, l.verrou_marchands_pct) >= 75
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Réseau Leaders</h1>
          <p className="text-gray-400 text-sm mt-1">Plan de carrière — R0 Starter → R8 Elder</p>
        </div>
        <div className="text-right text-sm text-gray-400">
          {leaders.length} leaders au total
        </div>
      </div>

      {/* Stats rapides */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-2xl font-bold text-white">{leaders.length}</div>
          <div className="text-xs text-gray-400 mt-1">Leaders inscrits</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-2xl font-bold text-red-400">{kingmakers}</div>
          <div className="text-xs text-gray-400 mt-1">Kingmakers & Elders</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-2xl font-bold text-amber-400">{closeToNext}</div>
          <div className="text-xs text-gray-400 mt-1">Proches du prochain rang (≥75%)</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
          <div className="text-2xl font-bold text-green-400">{rankCounts[3] ?? 0}</div>
          <div className="text-xs text-gray-400 mt-1">Builders (R3)</div>
        </div>
      </div>

      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Rechercher par nom ou téléphone…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-400 flex-1 focus:outline-none focus:border-brand-500"
        />
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setFilterRank(null)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterRank === null ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
          >
            Tous
          </button>
          {[8, 7, 6, 5, 4, 3, 2, 1].map(r => (
            <button
              key={r}
              onClick={() => setFilterRank(filterRank === r ? null : r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filterRank === r ? 'bg-brand-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
              style={filterRank === r ? {} : { borderLeft: `3px solid ${RANK_CONFIG[r].color}` }}
            >
              R{r} {RANK_CONFIG[r].name}
              {rankCounts[r] ? <span className="ml-1 opacity-70">({rankCounts[r]})</span> : null}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Chargement…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Aucun leader trouvé.</div>
      ) : (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 border-b border-gray-700 uppercase tracking-wide">
                <th className="text-left px-4 py-3">Leader</th>
                <th className="text-left px-4 py-3">Rang actuel</th>
                <th className="text-left px-4 py-3 min-w-[180px]">Progression → rang suivant</th>
                <th className="text-center px-4 py-3">Affiliés directs</th>
                <th className="text-left px-4 py-3">Rang obtenu le</th>
                <th className="text-left px-4 py-3">Évalué le</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filtered.map(l => {
                const cfg = RANK_CONFIG[l.current_rank] ?? RANK_CONFIG[0]
                const isMaxRank = l.current_rank >= 8
                const minVerrou = Math.min(l.verrou_structure_pct, l.verrou_volume_pct, l.verrou_marchands_pct)
                return (
                  <tr key={l.user_id} className="hover:bg-gray-750 transition-colors">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{l.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-400">{l.phone ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <RankBadge rank={l.current_rank} />
                    </td>
                    <td className="px-4 py-3">
                      {isMaxRank ? (
                        <span className="text-xs text-amber-400 font-medium">Rang maximum</span>
                      ) : (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-20 shrink-0">Structure</span>
                            <ProgressBar value={l.verrou_structure_pct} color={cfg.color} />
                            <span className="text-xs text-gray-300 w-8 text-right">{l.verrou_structure_pct}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-20 shrink-0">Volume</span>
                            <ProgressBar value={l.verrou_volume_pct} color={cfg.color} />
                            <span className="text-xs text-gray-300 w-8 text-right">{l.verrou_volume_pct}%</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400 w-20 shrink-0">Marchands</span>
                            <ProgressBar value={l.verrou_marchands_pct} color={cfg.color} />
                            <span className="text-xs text-gray-300 w-8 text-right">{l.verrou_marchands_pct}%</span>
                          </div>
                          {minVerrou >= 75 && (
                            <div className="text-xs text-amber-400 font-medium">🔥 Proche du prochain rang</div>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="text-white font-medium">{l.direct_affiliates_count}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-300 text-xs">{fmtDate(l.rank_achieved_at)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{fmtDate(l.last_evaluated_at)}</td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/users/${l.user_id}`}
                        className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
                      >
                        Voir →
                      </Link>
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
