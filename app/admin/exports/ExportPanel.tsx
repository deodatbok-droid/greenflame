'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

const DATASETS = [
  { key: 'transactions',  label: 'Transactions',                  icon: '💳', desc: 'Toutes les ventes avec montants, commissions et modes de paiement' },
  { key: 'commissions',   label: 'Commissions & revenus',         icon: '💰', desc: 'Détail des distributions dans le ledger (cashback, L1–L5, GreenFlame)' },
  { key: 'membres',       label: 'Membres inscrits',              icon: '👥', desc: 'Liste des membres, leur statut et informations de parrainage' },
  { key: 'marchands',     label: 'Marchands',                     icon: '🏪', desc: 'Marchands actifs, plans d\'abonnement et secteurs' },
  { key: 'retraits',      label: 'Retraits',                      icon: '📤', desc: 'Demandes de retrait, statuts et montants traités' },
  { key: 'kyc',           label: 'Soumissions KYC',               icon: '🪪', desc: 'Dossiers KYC, décisions IA et statuts finaux' },
  { key: 'spillover',     label: 'Spillover Fund',                icon: '🔄', desc: 'Commissions redirigées vers le fonds (uplines manquants, inactifs)' },
  { key: 'abonnements',   label: 'Abonnements marchands',         icon: '⭐', desc: 'Historique des souscriptions Pro et VIP' },
] as const

type DatasetKey = typeof DATASETS[number]['key']

const PERIODS = [
  { key: 'month',    label: 'Ce mois',         getDates: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth(), 1).toISOString().slice(0, 10), to: n.toISOString().slice(0, 10) } } },
  { key: '3months',  label: '3 derniers mois', getDates: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth() - 2, 1).toISOString().slice(0, 10), to: n.toISOString().slice(0, 10) } } },
  { key: '6months',  label: '6 derniers mois', getDates: () => { const n = new Date(); return { from: new Date(n.getFullYear(), n.getMonth() - 5, 1).toISOString().slice(0, 10), to: n.toISOString().slice(0, 10) } } },
  { key: 'year',     label: 'Cette année',     getDates: () => { const n = new Date(); return { from: `${n.getFullYear()}-01-01`, to: n.toISOString().slice(0, 10) } } },
  { key: 'lastyear', label: 'Année dernière',  getDates: () => { const n = new Date(); const y = n.getFullYear() - 1; return { from: `${y}-01-01`, to: `${y}-12-31` } } },
  { key: 'custom',   label: 'Personnalisé',    getDates: () => ({ from: '', to: '' }) },
] as const

export default function ExportPanel() {
  const [selected, setSelected]   = useState<Set<DatasetKey>>(new Set())
  const [period, setPeriod]       = useState<string>('month')
  const [customFrom, setFrom]     = useState('')
  const [customTo, setTo]         = useState('')
  const [loading, setLoading]     = useState<'csv' | 'pdf' | null>(null)

  const toggleAll = () => {
    if (selected.size === DATASETS.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(DATASETS.map(d => d.key)))
    }
  }

  const toggle = (key: DatasetKey) => {
    const next = new Set(selected)
    next.has(key) ? next.delete(key) : next.add(key)
    setSelected(next)
  }

  function getDateRange(): { from: string; to: string } {
    if (period === 'custom') return { from: customFrom, to: customTo }
    return PERIODS.find(p => p.key === period)?.getDates() ?? { from: '', to: '' }
  }

  async function doExport(format: 'csv' | 'pdf') {
    if (!selected.size) { toast.error('Sélectionnez au moins un dataset'); return }
    const { from, to } = getDateRange()
    if (!from || !to) { toast.error('Sélectionnez une période valide'); return }

    setLoading(format)
    try {
      const res = await fetch('/api/admin/export', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ datasets: [...selected], format, from, to }),
      })

      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error((d as { error?: string }).error ?? 'Erreur export')
        return
      }

      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = res.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1]
        ?? `greenflame_export_${from}_${to}.${format}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Export ${format.toUpperCase()} téléchargé ✓`)
    } catch {
      toast.error('Erreur lors du téléchargement')
    } finally {
      setLoading(null)
    }
  }

  const { from, to } = getDateRange()
  const allSelected  = selected.size === DATASETS.length
  const noneSelected = selected.size === 0

  return (
    <div className="space-y-6">

      {/* ── Période ─────────────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <h2 className="font-semibold text-gray-900">Période</h2>
        <div className="flex flex-wrap gap-2">
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium transition-colors ${
                period === p.key
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="flex gap-3 flex-wrap">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Du</label>
              <input
                type="date"
                value={customFrom}
                onChange={e => setFrom(e.target.value)}
                className="input text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Au</label>
              <input
                type="date"
                value={customTo}
                onChange={e => setTo(e.target.value)}
                className="input text-sm"
              />
            </div>
          </div>
        )}
        {from && to && (
          <p className="text-xs text-gray-400">
            Période sélectionnée : <span className="font-medium text-gray-600">{new Date(from).toLocaleDateString('fr-FR')} → {new Date(to).toLocaleDateString('fr-FR')}</span>
          </p>
        )}
      </div>

      {/* ── Datasets ────────────────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Données à exporter</h2>
          <button
            onClick={toggleAll}
            className="text-xs text-brand-600 hover:text-brand-700 font-medium"
          >
            {allSelected ? 'Tout désélectionner' : 'Tout sélectionner'}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {DATASETS.map(d => (
            <label
              key={d.key}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                selected.has(d.key)
                  ? 'border-brand-300 bg-brand-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(d.key)}
                onChange={() => toggle(d.key)}
                className="mt-0.5 accent-brand-600 w-4 h-4 flex-shrink-0"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 flex items-center gap-1.5">
                  <span>{d.icon}</span> {d.label}
                </p>
                <p className="text-xs text-gray-400 mt-0.5 leading-snug">{d.desc}</p>
              </div>
            </label>
          ))}
        </div>
        {!noneSelected && (
          <p className="text-xs text-gray-500">
            {selected.size} dataset{selected.size > 1 ? 's' : ''} sélectionné{selected.size > 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Boutons export ──────────────────────────────────────────────── */}
      <div className="card">
        <h2 className="font-semibold text-gray-900 mb-1">Format d'export</h2>
        <p className="text-xs text-gray-400 mb-4">
          CSV : compatible Excel et logiciels comptables. PDF : document formaté prêt à partager.
          {selected.size > 1 && ' Les datasets multiples sont regroupés dans un seul fichier.'}
        </p>
        <div className="flex gap-3 flex-wrap">
          <button
            onClick={() => doExport('csv')}
            disabled={noneSelected || !!loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading === 'csv' ? <span className="animate-spin">⏳</span> : '↓'}
            Exporter CSV
          </button>
          <button
            onClick={() => doExport('pdf')}
            disabled={noneSelected || !!loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-900 text-white font-medium text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading === 'pdf' ? <span className="animate-spin">⏳</span> : '↓'}
            Exporter PDF
          </button>
        </div>
        {noneSelected && (
          <p className="text-xs text-amber-600 mt-3">⚠️ Sélectionnez au moins un dataset pour exporter.</p>
        )}
        <p className="text-xs text-gray-300 mt-3">
          Note : le PDF est limité à 500 lignes par section. Pour les volumes importants, utilisez le CSV.
        </p>
      </div>
    </div>
  )
}
