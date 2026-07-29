'use client'

import { useState } from 'react'
import type { PlatformSetting } from '@/lib/settings'

interface AuditLog {
  key: string
  old_value: unknown
  new_value: unknown
  changed_at: string
  users: { full_name: string } | null
}

interface Props {
  settingsByCategory: Record<string, PlatformSetting[]>
  categoryMeta: Record<string, { label: string; icon: string; desc: string }>
  auditLogs: AuditLog[]
}

function formatValue(v: unknown): string {
  if (typeof v === 'string') return v.replace(/^"|"$/g, '')
  if (typeof v === 'number') return String(v)
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non'
  return JSON.stringify(v)
}

function isPercentage(key: string) {
  return key.startsWith('commission_')
}

function isBoolean(key: string) {
  return key.startsWith('banner_enabled')
}

function isSelect(key: string) {
  return key === 'banner_type'
}

export default function SettingsClient({ settingsByCategory, categoryMeta, auditLogs }: Props) {
  const [settings, setSettings] = useState(settingsByCategory)
  const [editing, setEditing]   = useState<Record<string, string>>({})
  const [saving, setSaving]     = useState<Record<string, boolean>>({})
  const [saved, setSaved]       = useState<Record<string, boolean>>({})
  const [showAudit, setShowAudit] = useState(false)

  function startEdit(key: string, currentValue: unknown) {
    const raw = formatValue(currentValue)
    setEditing(prev => ({ ...prev, [key]: raw }))
  }

  function cancelEdit(key: string) {
    setEditing(prev => { const n = { ...prev }; delete n[key]; return n })
  }

  async function saveSetting(key: string, category: string) {
    const raw = editing[key]
    if (raw === undefined) return

    let value: unknown = raw
    if (isPercentage(key) || key === 'gfp_cash_min_threshold' || key === 'gfp_min_withdrawal' ||
        key === 'gfp_validity_months' || key === 'inactivity_spillover_days') {
      value = parseFloat(raw)
      if (isNaN(value as number)) return
    } else if (isBoolean(key)) {
      value = raw === 'true'
    } else {
      value = JSON.stringify(raw)
    }

    setSaving(prev => ({ ...prev, [key]: true }))
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })

    if (res.ok) {
      setSettings(prev => ({
        ...prev,
        [category]: prev[category].map(s => s.key === key ? { ...s, value } : s),
      }))
      setEditing(prev => { const n = { ...prev }; delete n[key]; return n })
      setSaved(prev => ({ ...prev, [key]: true }))
      setTimeout(() => setSaved(prev => { const n = { ...prev }; delete n[key]; return n }), 2000)
    }
    setSaving(prev => ({ ...prev, [key]: false }))
  }

  async function toggleBoolean(key: string, category: string, currentValue: unknown) {
    const current = Boolean(currentValue)
    const value = !current

    setSaving(prev => ({ ...prev, [key]: true }))
    const res = await fetch('/api/admin/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    })
    if (res.ok) {
      setSettings(prev => ({
        ...prev,
        [category]: prev[category].map(s => s.key === key ? { ...s, value } : s),
      }))
      setSaved(prev => ({ ...prev, [key]: true }))
      setTimeout(() => setSaved(prev => { const n = { ...prev }; delete n[key]; return n }), 2000)
    }
    setSaving(prev => ({ ...prev, [key]: false }))
  }

  return (
    <>
      {Object.entries(settings).map(([cat, items]) => {
        const meta = categoryMeta[cat]
        return (
          <section key={cat} className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
            {/* Header */}
            <div className="px-5 py-4 border-b border-gray-700 flex items-center gap-3">
              <span className="text-xl">{meta?.icon}</span>
              <div>
                <h2 className="font-semibold text-white text-sm">{meta?.label ?? cat}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{meta?.desc}</p>
              </div>
            </div>

            <ul className="divide-y divide-gray-700/50">
              {items.map(setting => {
                const isEditing = editing[setting.key] !== undefined
                const isSaving  = saving[setting.key]
                const justSaved = saved[setting.key]
                const raw       = formatValue(setting.value)

                return (
                  <li key={setting.key} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{setting.label}</p>
                        {setting.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{setting.description}</p>
                        )}
                      </div>

                      {/* Valeur + contrôles */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {isBoolean(setting.key) ? (
                          // Toggle pour les booléens
                          <button
                            onClick={() => toggleBoolean(setting.key, cat, setting.value)}
                            disabled={isSaving}
                            className="relative w-11 h-6 rounded-full transition-colors focus:outline-none disabled:opacity-60"
                            style={{ background: setting.value ? '#22c55e' : '#374151' }}
                          >
                            <span
                              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                              style={{ transform: setting.value ? 'translateX(20px)' : 'translateX(0)' }}
                            />
                          </button>
                        ) : isSelect(setting.key) ? (
                          // Select pour banner_type
                          <select
                            value={isEditing ? editing[setting.key] : raw}
                            onChange={e => setEditing(prev => ({ ...prev, [setting.key]: e.target.value }))}
                            onBlur={() => saveSetting(setting.key, cat)}
                            className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-green-500"
                          >
                            <option value="info">Info (bleu)</option>
                            <option value="warning">Avertissement (jaune)</option>
                            <option value="success">Succès (vert)</option>
                            <option value="error">Erreur (rouge)</option>
                          </select>
                        ) : isEditing ? (
                          // Champ texte/nombre en édition
                          <div className="flex items-center gap-2">
                            <input
                              autoFocus
                              value={editing[setting.key]}
                              onChange={e => setEditing(prev => ({ ...prev, [setting.key]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter') saveSetting(setting.key, cat); if (e.key === 'Escape') cancelEdit(setting.key) }}
                              className="w-28 bg-gray-900 border border-green-500 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
                              type={isPercentage(setting.key) || setting.key.includes('days') || setting.key.includes('months') || setting.key.includes('threshold') || setting.key.includes('withdrawal') ? 'number' : 'text'}
                              step={isPercentage(setting.key) ? '0.01' : undefined}
                              min={0}
                            />
                            {isPercentage(setting.key) && <span className="text-gray-400 text-xs">%×100</span>}
                            <button
                              onClick={() => saveSetting(setting.key, cat)}
                              disabled={isSaving}
                              className="text-xs px-3 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white rounded-lg transition-colors"
                            >
                              {isSaving ? '…' : 'Sauv.'}
                            </button>
                            <button onClick={() => cancelEdit(setting.key)} className="text-xs text-gray-500 hover:text-gray-300">✕</button>
                          </div>
                        ) : (
                          // Valeur affichée + bouton éditer
                          <div className="flex items-center gap-2">
                            {justSaved && <span className="text-xs text-green-400">✓ Sauvegardé</span>}
                            <span className="text-sm font-mono text-green-400">
                              {isPercentage(setting.key)
                                ? `${(Number(setting.value) * 100).toFixed(0)}%`
                                : raw}
                            </span>
                            {setting.editable && (
                              <button
                                onClick={() => startEdit(setting.key, setting.value)}
                                className="text-xs text-gray-600 hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-gray-700"
                              >
                                Modifier
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Champ texte long pour banner_message */}
                    {setting.key === 'banner_message' && (
                      <div className="mt-3">
                        <textarea
                          value={isEditing ? editing[setting.key] : raw}
                          onChange={e => setEditing(prev => ({ ...prev, [setting.key]: e.target.value }))}
                          onFocus={() => { if (!isEditing) startEdit(setting.key, setting.value) }}
                          onBlur={() => { if (isEditing) saveSetting(setting.key, cat) }}
                          rows={2}
                          placeholder="Ex. Maintenance prévue demain de 2h à 4h du matin."
                          className="w-full bg-gray-900 border border-gray-600 focus:border-green-500 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 focus:outline-none resize-none"
                        />
                        <p className="text-xs text-gray-600 mt-1">Appuyez sur Tab ou cliquez en dehors pour sauvegarder automatiquement</p>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}

      {/* Note gouvernance */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 flex items-start gap-3">
        <span className="text-lg flex-shrink-0">🔒</span>
        <div>
          <p className="text-sm font-medium text-gray-300">Invariants de gouvernance — hors de portée</p>
          <p className="text-xs text-gray-500 mt-1">
            Les constantes PLATFORM_SHARE (45%), NETWORK_POOL_SHARE (40%), CASHBACK_SHARE (12%) et REWARDS_FUND_SHARE (3%)
            sont verrouillées dans le code source et ne peuvent pas être modifiées depuis l'interface.
            Toute tentative est loggée dans <code className="text-gray-400">governance_audit</code>.
          </p>
        </div>
      </div>

      {/* Journal d'audit */}
      <section className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden">
        <button
          className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-700/20 transition-colors"
          onClick={() => setShowAudit(v => !v)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">📋</span>
            <div className="text-left">
              <h2 className="font-semibold text-white text-sm">Historique des modifications</h2>
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
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-500 font-medium">
                      <th className="text-left px-5 py-3">Date</th>
                      <th className="text-left px-4 py-3">Paramètre</th>
                      <th className="text-right px-4 py-3">Avant</th>
                      <th className="text-right px-4 py-3">Après</th>
                      <th className="text-left px-4 py-3">Par</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/50">
                    {auditLogs.map((log, i) => (
                      <tr key={i} className="hover:bg-gray-700/20">
                        <td className="px-5 py-2.5 text-gray-500 tabular-nums whitespace-nowrap">
                          {new Date(log.changed_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-gray-400">{log.key}</td>
                        <td className="px-4 py-2.5 text-right text-red-400 font-mono">
                          {formatValue(log.old_value)}
                        </td>
                        <td className="px-4 py-2.5 text-right text-green-400 font-mono">
                          {formatValue(log.new_value)}
                        </td>
                        <td className="px-4 py-2.5 text-gray-500">{log.users?.full_name ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>
    </>
  )
}
