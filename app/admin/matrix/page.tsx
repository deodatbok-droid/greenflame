'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// ── Types ─────────────────────────────────────────────────────────────────

type NodeRow = {
  id: string
  full_name: string
  phone: string
  max_direct_slots: number
  used_slots: number
  available_slots: number
  enrolled_count: number
  last_active_at: string | null
  career_rank: number | null
}

type QueueEntry = {
  id: string
  created_at: string
  reason: string
  new_user: { id: string; full_name: string; phone: string }
  enroller: { id: string; full_name: string; phone: string }
}

const RANK_NAMES: Record<number, string> = {
  0: 'Starter', 1: 'Étincelle', 2: 'Créateur', 3: 'Builder',
  4: 'Leader Flamme', 5: 'Leader Brasier', 6: 'Ambassadeur', 7: 'Kingmaker', 8: 'Elder',
}

const SLOT_COLORS: Record<number, string> = { 5: '#16a34a', 6: '#2563eb', 8: '#7c3aed', 10: '#dc2626' }

// ── Helpers ────────────────────────────────────────────────────────────────

function isAlive(row: NodeRow): boolean {
  if (!row.last_active_at) return false
  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  return row.last_active_at >= since30d && row.enrolled_count >= 2
}

function SlotBar({ used, max }: { used: number; max: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <div
          key={i}
          className={`h-3 flex-1 rounded-sm ${i < used ? 'bg-green-500' : 'bg-gray-600'}`}
        />
      ))}
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function AdminMatrixPage() {
  const supabase = createClient()
  const [nodes,   setNodes]   = useState<NodeRow[]>([])
  const [queue,   setQueue]   = useState<QueueEntry[]>([])
  const [search,  setSearch]  = useState('')
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState<'slots' | 'queue'>('slots')
  const [resolving, setResolving] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    const [nodesRes, queueRes] = await Promise.all([
      supabase
        .from('matrix_slot_view')
        .select('*')
        .order('used_slots', { ascending: false })
        .limit(200),
      supabase
        .from('spillover_queue')
        .select(`
          id, created_at, reason,
          new_user:new_user_id(id, full_name, phone),
          enroller:enrolled_by_id(id, full_name, phone)
        `)
        .is('resolved_at', null)
        .order('created_at', { ascending: false }),
    ])
    setNodes((nodesRes.data ?? []) as NodeRow[])
    setQueue((queueRes.data ?? []) as unknown as QueueEntry[])
    setLoading(false)
  }

  async function resolveQueueEntry(queueId: string, placedUnderId: string) {
    setResolving(queueId)
    await fetch('/api/admin/matrix/resolve-queue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId, placedUnderId }),
    })
    await fetchData()
    setResolving(null)
  }

  const filteredNodes = nodes.filter(n =>
    n.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    n.phone?.includes(search)
  )

  // Stats
  const aliveCount    = nodes.filter(isAlive).length
  const fullNodes     = nodes.filter(n => n.available_slots === 0).length
  const queueCount    = queue.length
  const slotDist: Record<number, number> = {}
  for (const n of nodes) slotDist[n.max_direct_slots] = (slotDist[n.max_direct_slots] ?? 0) + 1

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Chargement de la matrice…</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Matrice réseau 5×5</h1>
          <p className="text-gray-400 text-sm mt-0.5">Forced Matrix Anti-extractif — placement BFS conditionnel</p>
        </div>
        <button
          onClick={fetchData}
          className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors"
        >
          Rafraîchir
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-green-400">{nodes.length}</div>
          <div className="text-gray-400 text-xs mt-1">Nœuds total</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-emerald-400">{aliveCount}</div>
          <div className="text-gray-400 text-xs mt-1">Nœuds vivants (actif + ≥2 recrues)</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className="text-2xl font-bold text-orange-400">{fullNodes}</div>
          <div className="text-gray-400 text-xs mt-1">Nœuds complets (0 slot libre)</div>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <div className={`text-2xl font-bold ${queueCount > 0 ? 'text-red-400' : 'text-gray-400'}`}>{queueCount}</div>
          <div className="text-gray-400 text-xs mt-1">En file d&apos;attente</div>
        </div>
      </div>

      {/* Distribution des tiers de slots */}
      <div className="bg-gray-800 rounded-xl p-4">
        <div className="text-sm font-medium text-gray-300 mb-3">Distribution des tiers de slots</div>
        <div className="flex gap-4 flex-wrap">
          {Object.entries(slotDist).map(([slots, count]) => (
            <div key={slots} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: SLOT_COLORS[Number(slots)] ?? '#6b7280' }}
              />
              <span className="text-sm">{slots} slots</span>
              <span className="text-gray-400 text-sm">({count} utilisateurs)</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button
          onClick={() => setTab('slots')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === 'slots' ? 'bg-green-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          Disponibilité des slots
        </button>
        <button
          onClick={() => setTab('queue')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'queue' ? 'bg-red-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
        >
          File d&apos;attente
          {queueCount > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {queueCount}
            </span>
          )}
        </button>
      </div>

      {/* ── Tab : Slots ───────────────────────────────────────────────── */}
      {tab === 'slots' && (
        <div className="space-y-4">
          <input
            type="text"
            placeholder="Chercher par nom ou téléphone…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
          />

          <div className="bg-gray-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs border-b border-gray-700">
                  <th className="text-left px-4 py-3 font-medium">Utilisateur</th>
                  <th className="text-left px-4 py-3 font-medium">Rang</th>
                  <th className="text-left px-4 py-3 font-medium">Slots utilisés</th>
                  <th className="text-left px-4 py-3 font-medium">Recrues perso</th>
                  <th className="text-left px-4 py-3 font-medium">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredNodes.map(node => {
                  const alive = isAlive(node)
                  return (
                    <tr key={node.id} className="hover:bg-gray-750">
                      <td className="px-4 py-3">
                        <div className="font-medium text-white">{node.full_name}</div>
                        <div className="text-gray-500 text-xs">{node.phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-xs text-gray-300">
                          R{node.career_rank ?? 0} — {RANK_NAMES[node.career_rank ?? 0]}
                        </span>
                      </td>
                      <td className="px-4 py-3 w-40">
                        <div className="mb-1">
                          <SlotBar used={node.used_slots} max={node.max_direct_slots} />
                        </div>
                        <div className="text-xs text-gray-400">
                          {node.used_slots}/{node.max_direct_slots}
                          {node.available_slots > 0 && (
                            <span className="text-green-400 ml-1">({node.available_slots} libre{node.available_slots > 1 ? 's' : ''})</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-medium ${node.enrolled_count >= 2 ? 'text-green-400' : 'text-gray-400'}`}>
                          {node.enrolled_count}
                        </span>
                        <span className="text-gray-500 text-xs ml-1">/ 2 min</span>
                      </td>
                      <td className="px-4 py-3">
                        {alive ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-900/40 text-green-400 px-2 py-0.5 rounded-full">
                            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                            Vivant
                          </span>
                        ) : node.used_slots >= node.max_direct_slots ? (
                          <span className="inline-flex items-center gap-1 text-xs bg-orange-900/40 text-orange-400 px-2 py-0.5 rounded-full">
                            Complet
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">
                            Inactif
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {filteredNodes.length === 0 && (
              <div className="text-center text-gray-500 py-8 text-sm">Aucun résultat</div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab : File d'attente ──────────────────────────────────────── */}
      {tab === 'queue' && (
        <div className="space-y-3">
          {queue.length === 0 ? (
            <div className="bg-gray-800 rounded-xl p-8 text-center text-gray-500 text-sm">
              Aucune recrue en attente de placement
            </div>
          ) : (
            queue.map(entry => (
              <div key={entry.id} className="bg-gray-800 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-white">{entry.new_user?.full_name}</div>
                    <div className="text-gray-400 text-xs mt-0.5">{entry.new_user?.phone}</div>
                    <div className="text-gray-500 text-xs mt-1">
                      Enrolleur : <span className="text-gray-300">{entry.enroller?.full_name}</span>
                      {' '}({entry.enroller?.phone})
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-orange-400 bg-orange-900/30 px-2 py-0.5 rounded">
                      {entry.reason === 'no_eligible_slot' ? 'Aucun slot éligible' : entry.reason}
                    </div>
                    <div className="text-gray-500 text-xs mt-1">
                      {new Date(entry.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                </div>

                {/* Action manuelle : placer sous l'enrolleur forcé */}
                <div className="border-t border-gray-700 pt-3 flex items-center gap-2">
                  <span className="text-xs text-gray-400">Placer sous :</span>
                  <button
                    disabled={resolving === entry.id}
                    onClick={() => resolveQueueEntry(entry.id, entry.enroller?.id)}
                    className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 px-3 py-1 rounded-lg transition-colors"
                  >
                    {resolving === entry.id ? 'Traitement…' : `Forcer sous ${entry.enroller?.full_name}`}
                  </button>
                  <span className="text-xs text-gray-500">(bypass conditions)</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
