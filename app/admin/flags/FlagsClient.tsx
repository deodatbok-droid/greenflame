'use client'

import { useState, useTransition } from 'react'
import type { FeatureFlag } from '@/lib/flags'

interface Override {
  user_id: string
  allowed: boolean
  note: string | null
  created_at: string
  users: { full_name: string; phone: string } | null
}

interface AuditLog {
  key: string
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  changed_at: string
  users: { full_name: string } | null
}

interface Props {
  flagsByCategory: Record<string, FeatureFlag[]>
  categoryMeta: Record<string, { label: string; icon: string; desc: string }>
  auditLogs: AuditLog[]
}

const MODE_LABELS: Record<string, string> = {
  all:       'Tous',
  whitelist: 'Whitelist',
  blacklist: 'Blacklist',
}

const MODE_COLORS: Record<string, string> = {
  all:       'bg-gray-700 text-gray-300',
  whitelist: 'bg-blue-900/40 text-blue-300',
  blacklist: 'bg-orange-900/40 text-orange-300',
}

const CATEGORY_ORDER = ['maintenance', 'module', 'feature', 'market']

export default function FlagsClient({ flagsByCategory, categoryMeta, auditLogs }: Props) {
  const [flags, setFlags]         = useState(flagsByCategory)
  const [activeTab, setActiveTab] = useState<string>('audit_hidden')
  const [overrideModal, setOverrideModal] = useState<FeatureFlag | null>(null)
  const [overrides, setOverrides] = useState<Override[]>([])
  const [newUserId, setNewUserId] = useState('')
  const [newAllowed, setNewAllowed] = useState(true)
  const [newNote, setNewNote]     = useState('')
  const [loadingOverrides, setLoadingOverrides] = useState(false)
  const [showAudit, setShowAudit] = useState(false)
  const [newCountryName, setNewCountryName] = useState('')
  const [addingCountry, setAddingCountry] = useState(false)
  const [addCountryError, setAddCountryError] = useState('')
  const [, startTransition] = useTransition()

  async function toggleFlag(key: string, currentEnabled: boolean) {
    // Optimistic update
    setFlags(prev => {
      const next = { ...prev }
      for (const cat of Object.keys(next)) {
        next[cat] = next[cat].map(f => f.key === key ? { ...f, enabled: !currentEnabled } : f)
      }
      return next
    })

    const res = await fetch('/api/admin/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, enabled: !currentEnabled }),
    })

    if (!res.ok) {
      // Rollback
      setFlags(prev => {
        const next = { ...prev }
        for (const cat of Object.keys(next)) {
          next[cat] = next[cat].map(f => f.key === key ? { ...f, enabled: currentEnabled } : f)
        }
        return next
      })
    }
  }

  async function cycleMode(key: string, currentMode: string) {
    const next = currentMode === 'all' ? 'whitelist' : currentMode === 'whitelist' ? 'blacklist' : 'all'
    setFlags(prev => {
      const updated = { ...prev }
      for (const cat of Object.keys(updated)) {
        updated[cat] = updated[cat].map(f => f.key === key ? { ...f, mode: next as FeatureFlag['mode'] } : f)
      }
      return updated
    })
    await fetch('/api/admin/flags', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, mode: next }),
    })
  }

  async function openOverrides(flag: FeatureFlag) {
    setOverrideModal(flag)
    setLoadingOverrides(true)
    setNewUserId(''); setNewNote(''); setNewAllowed(true)
    const res = await fetch(`/api/admin/flags/${flag.key}/overrides`)
    if (res.ok) setOverrides(await res.json())
    setLoadingOverrides(false)
  }

  async function addOverride() {
    if (!overrideModal || !newUserId.trim()) return
    await fetch(`/api/admin/flags/${overrideModal.key}/overrides`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: newUserId.trim(), allowed: newAllowed, note: newNote || null }),
    })
    startTransition(() => { openOverrides(overrideModal) })
    setNewUserId(''); setNewNote('')
  }

  function slugify(name: string) {
    return name.toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  }

  async function addCountry() {
    const name = newCountryName.trim()
    if (!name) return
    const key = `market_${slugify(name)}`
    setAddingCountry(true)
    setAddCountryError('')

    const res = await fetch('/api/admin/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, label: name, category: 'market', description: `Marché ${name}`, enabled: false }),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      setAddCountryError((json as { error?: string }).error ?? 'Erreur lors de l\'ajout')
    } else {
      const newFlag: FeatureFlag = { key, label: name, description: `Marché ${name}`, category: 'market', enabled: false, mode: 'all', updated_at: new Date().toISOString(), updated_by: null }
      setFlags(prev => ({ ...prev, market: [...(prev.market ?? []), newFlag] }))
      setNewCountryName('')
    }
    setAddingCountry(false)
  }

  async function removeOverride(userId: string) {
    if (!overrideModal) return
    await fetch(`/api/admin/flags/${overrideModal.key}/overrides?user_id=${userId}`, { method: 'DELETE' })
    setOverrides(prev => prev.filter(o => o.user_id !== userId))
  }

  const allFlatFlags = Object.values(flags).flat()

  return (
    <>
      {/* Catégories */}
      {CATEGORY_ORDER.filter(cat => (flags[cat]?.length ?? 0) > 0 || cat === 'market').map(cat => {
        const meta = categoryMeta[cat]
        const catFlags = flags[cat] ?? []
        const activeCount = catFlags.filter(f => f.enabled).length

        return (
          <section key={cat} className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
            {/* Header catégorie */}
            <div className="px-5 py-4 border-b border-gray-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xl">{meta?.icon}</span>
                <div>
                  <h2 className="font-semibold text-white text-sm">{meta?.label ?? cat}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{meta?.desc}</p>
                </div>
              </div>
              <span className="text-xs text-gray-500">{activeCount}/{catFlags.length} actifs</span>
            </div>

            {/* Flags de la catégorie */}
            <ul className="divide-y divide-gray-700/50">
              {catFlags.sort((a, b) => a.label.localeCompare(b.label)).map(flag => (
                <li key={flag.key} className="px-5 py-4 flex items-center gap-4 hover:bg-gray-700/20 transition-colors">
                  {/* Toggle */}
                  <button
                    onClick={() => toggleFlag(flag.key, flag.enabled)}
                    className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500/50"
                    style={{ background: flag.enabled ? '#22c55e' : '#374151' }}
                    aria-label={`${flag.enabled ? 'Désactiver' : 'Activer'} ${flag.label}`}
                  >
                    <span
                      className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                      style={{ transform: flag.enabled ? 'translateX(20px)' : 'translateX(0)' }}
                    />
                  </button>

                  {/* Infos */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white">{flag.label}</span>
                      <span className="text-xs text-gray-600 font-mono">{flag.key}</span>
                    </div>
                    {flag.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{flag.description}</p>
                    )}
                  </div>

                  {/* Mode badge */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => cycleMode(flag.key, flag.mode)}
                      className={`text-xs px-2.5 py-1 rounded-full font-medium transition-opacity hover:opacity-80 ${MODE_COLORS[flag.mode]}`}
                      title="Cliquer pour changer le mode (Tous → Whitelist → Blacklist)"
                    >
                      {MODE_LABELS[flag.mode]}
                    </button>

                    {flag.mode !== 'all' && (
                      <button
                        onClick={() => openOverrides(flag)}
                        className="text-xs px-2.5 py-1 rounded-full bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                      >
                        Gérer liste
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {/* Formulaire ajout pays (section market uniquement) */}
            {cat === 'market' && (
              <div className="px-5 py-4 border-t border-gray-700/60">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-3">Ajouter un marché</p>
                <div className="flex gap-2">
                  <input
                    value={newCountryName}
                    onChange={e => { setNewCountryName(e.target.value); setAddCountryError('') }}
                    onKeyDown={e => e.key === 'Enter' && addCountry()}
                    placeholder="Nom du pays (ex : Côte d'Ivoire)"
                    className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-green-500 transition-colors"
                  />
                  <button
                    onClick={addCountry}
                    disabled={!newCountryName.trim() || addingCountry}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors flex-shrink-0"
                  >
                    {addingCountry ? '…' : 'Ajouter'}
                  </button>
                </div>
                {newCountryName.trim() && !addCountryError && (
                  <p className="text-xs text-gray-600 mt-1.5 font-mono">
                    clé : market_{slugify(newCountryName)}
                  </p>
                )}
                {addCountryError && (
                  <p className="text-xs text-red-400 mt-1.5">{addCountryError}</p>
                )}
              </div>
            )}
          </section>
        )
      })}

      {/* Journal d'audit */}
      <section className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <button
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-700/20 transition-colors"
          onClick={() => setShowAudit(v => !v)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <div className="text-left">
              <h2 className="font-semibold text-white text-sm">Journal des modifications</h2>
              <p className="text-xs text-gray-500">{auditLogs.length} dernières modifications</p>
            </div>
          </div>
          <span className="text-gray-500 text-sm">{showAudit ? '▲' : '▼'}</span>
        </button>

        {showAudit && (
          <div className="border-t border-gray-700">
            {auditLogs.length === 0 ? (
              <p className="px-5 py-6 text-center text-gray-500 text-sm">Aucune modification enregistrée</p>
            ) : (
              <ul className="divide-y divide-gray-700/50">
                {auditLogs.map((log, i) => {
                  const flagLabel = allFlatFlags.find(f => f.key === log.key)?.label ?? log.key
                  const was = log.old_value?.enabled
                  const now = log.new_value?.enabled
                  const modeWas = log.old_value?.mode as string | undefined
                  const modeNow = log.new_value?.mode as string | undefined

                  return (
                    <li key={i} className="px-5 py-3 flex items-center gap-4 text-xs">
                      <span className="text-gray-500 font-mono tabular-nums flex-shrink-0">
                        {new Date(log.changed_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-white font-medium flex-shrink-0">{flagLabel}</span>
                      <span className="text-gray-400 flex-1">
                        {was !== undefined && now !== undefined && was !== now && (
                          <>
                            {was ? <span className="text-green-400">ON</span> : <span className="text-gray-500">OFF</span>}
                            {' → '}
                            {now ? <span className="text-green-400">ON</span> : <span className="text-gray-500">OFF</span>}
                          </>
                        )}
                        {modeWas && modeNow && modeWas !== modeNow && (
                          <span className="ml-2 text-gray-400">
                            mode {modeWas} → {modeNow}
                          </span>
                        )}
                      </span>
                      <span className="text-gray-600 flex-shrink-0">{log.users?.full_name ?? '—'}</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Modal whitelist/blacklist */}
      {overrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="bg-gray-800 rounded-2xl border border-gray-700 w-full max-w-lg overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-white">{overrideModal.label}</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Mode : <span className={`font-medium ${MODE_COLORS[overrideModal.mode]} px-1.5 py-0.5 rounded`}>{MODE_LABELS[overrideModal.mode]}</span>
                  {overrideModal.mode === 'whitelist' && ' — seulement les listés y ont accès'}
                  {overrideModal.mode === 'blacklist' && ' — tout le monde sauf les listés'}
                </p>
              </div>
              <button onClick={() => setOverrideModal(null)} className="text-gray-500 hover:text-white text-xl">✕</button>
            </div>

            {/* Ajouter un utilisateur */}
            <div className="px-6 py-4 border-b border-gray-700">
              <p className="text-xs text-gray-400 mb-3 font-medium uppercase tracking-wide">Ajouter un utilisateur</p>
              <div className="flex gap-2">
                <input
                  value={newUserId}
                  onChange={e => setNewUserId(e.target.value)}
                  placeholder="UUID utilisateur"
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
                />
                <select
                  value={newAllowed ? 'allow' : 'deny'}
                  onChange={e => setNewAllowed(e.target.value === 'allow')}
                  className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-green-500"
                >
                  <option value="allow">Autoriser</option>
                  <option value="deny">Bloquer</option>
                </select>
              </div>
              <input
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Note (optionnel)"
                className="mt-2 w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-green-500"
              />
              <button
                onClick={addOverride}
                disabled={!newUserId.trim()}
                className="mt-3 w-full py-2 rounded-lg text-xs font-medium bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors"
              >
                Ajouter
              </button>
            </div>

            {/* Liste des overrides */}
            <div className="max-h-72 overflow-y-auto">
              {loadingOverrides ? (
                <p className="px-6 py-6 text-center text-gray-500 text-sm">Chargement…</p>
              ) : overrides.length === 0 ? (
                <p className="px-6 py-6 text-center text-gray-500 text-sm">Aucun override configuré</p>
              ) : (
                <ul className="divide-y divide-gray-700/50">
                  {overrides.map(o => (
                    <li key={o.user_id} className="px-6 py-3 flex items-center gap-3">
                      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${o.allowed ? 'bg-green-400' : 'bg-red-400'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white truncate">{o.users?.full_name ?? o.user_id}</p>
                        <p className="text-xs text-gray-500">{o.users?.phone ?? ''}{o.note ? ` · ${o.note}` : ''}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${o.allowed ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                        {o.allowed ? 'Autorisé' : 'Bloqué'}
                      </span>
                      <button
                        onClick={() => removeOverride(o.user_id)}
                        className="text-gray-600 hover:text-red-400 transition-colors text-sm ml-1"
                        aria-label="Supprimer override"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="px-6 py-3 border-t border-gray-700">
              <button onClick={() => setOverrideModal(null)} className="text-xs text-gray-500 hover:text-gray-300">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
