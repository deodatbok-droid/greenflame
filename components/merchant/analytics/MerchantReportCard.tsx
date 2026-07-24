'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Report {
  id:              string
  period_date:     string
  generated_at:    string
  summary:         string
  highlights:      string[]
  improvements:    string[]
  recommendations: string[]
  risk_level:      'normal' | 'attention' | 'alert'
  metrics_snapshot: Record<string, unknown>
}

interface Props {
  report:     Report | null
  exportFrom: string  // YYYY-MM-DD (1er du mois courant)
  exportTo:   string  // YYYY-MM-DD (aujourd'hui)
}

const RISK_CONFIG = {
  normal:    { bg: 'bg-emerald-50',  border: 'border-emerald-200', badge: 'bg-emerald-100 text-emerald-700', icon: '✅', label: 'Activité normale'    },
  attention: { bg: 'bg-yellow-50',   border: 'border-yellow-200',  badge: 'bg-yellow-100 text-yellow-700',   icon: '⚠️', label: 'Points à surveiller' },
  alert:     { bg: 'bg-red-50',      border: 'border-red-200',     badge: 'bg-red-100 text-red-700',         icon: '🚨', label: 'Attention requise'    },
}

export default function MerchantReportCard({ report, exportFrom, exportTo }: Props) {
  const router                  = useRouter()
  const [generating, setGen]    = useState(false)
  const [downloading, setDl]    = useState<'comptable-csv' | 'comptable-pdf' | 'ia-pdf' | null>(null)

  async function generateReport() {
    setGen(true)
    const res = await fetch('/api/merchant/generate-report', { method: 'POST' })
    setGen(false)
    if (!res.ok) {
      const d = await res.json()
      toast.error(d.error ?? 'Erreur lors de la génération')
      return
    }
    toast.success('Rapport IA généré ✓')
    router.refresh()
  }

  async function download(type: 'comptable' | 'rapport-ia', format: 'csv' | 'pdf') {
    const key = `${type === 'comptable' ? 'comptable' : 'ia'}-${format}` as typeof downloading
    setDl(key)
    const params = new URLSearchParams({ type, format, from: exportFrom, to: exportTo })
    try {
      const res = await fetch(`/api/merchant/export?${params}`)
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        toast.error((d as { error?: string }).error ?? 'Erreur export')
        return
      }
      const blob     = await res.blob()
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      a.href         = url
      a.download     = res.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1] ?? `export.${format}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Erreur lors du téléchargement')
    } finally {
      setDl(null)
    }
  }

  const cfg = report ? RISK_CONFIG[report.risk_level] : null

  return (
    <div className="space-y-4">

      {/* ── Rapport IA ──────────────────────────────────────────────────── */}
      <div className={`rounded-2xl border p-5 space-y-4 ${cfg ? `${cfg.bg} ${cfg.border}` : 'bg-gray-50 border-gray-200'}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg flex-shrink-0">🤖</span>
            <div className="min-w-0">
              <p className="font-semibold text-gray-900 text-sm">Rapport analytique IA</p>
              {report ? (
                <p className="text-xs text-gray-500 mt-0.5">
                  Généré le {new Date(report.generated_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-0.5">Aucun rapport pour ce mois</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {cfg && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.badge}`}>
                {cfg.icon} {cfg.label}
              </span>
            )}
            <button
              onClick={generateReport}
              disabled={generating}
              className="text-xs px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 hover:text-gray-900 transition-colors disabled:opacity-50 flex items-center gap-1 shadow-sm"
            >
              {generating ? <><span className="animate-spin">⏳</span> Génération…</> : '↻ Actualiser'}
            </button>
          </div>
        </div>

        {report ? (
          <>
            {/* Résumé */}
            <p className="text-sm text-gray-700 leading-relaxed">{report.summary}</p>

            {/* Points forts */}
            {report.highlights.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Points forts</p>
                <ul className="space-y-1.5">
                  {report.highlights.map((h, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-gray-500 flex-shrink-0 mt-0.5">·</span>{h}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Axes d'amélioration */}
            {report.improvements.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Axes d'amélioration</p>
                <ul className="space-y-1.5">
                  {report.improvements.map((imp, i) => (
                    <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                      <span className="text-gray-500 flex-shrink-0 mt-0.5">·</span>{imp}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommandations */}
            {report.recommendations.length > 0 && (
              <div className="bg-white/60 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recommandations</p>
                <ul className="space-y-1.5">
                  {report.recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                      <span className="text-brand-600 font-bold flex-shrink-0">{i + 1}.</span>{r}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Export bouton rapport IA */}
            <div className="pt-1 flex gap-2">
              <button
                onClick={() => download('rapport-ia', 'pdf')}
                disabled={downloading === 'ia-pdf'}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-50"
              >
                {downloading === 'ia-pdf' ? '⏳' : '↓'} PDF rapport
              </button>
            </div>
          </>
        ) : (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-3">
              L'IA analyse votre activité du mois et rédige un bilan complet en langage simple.
            </p>
            <button
              onClick={generateReport}
              disabled={generating}
              className="text-sm px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-colors disabled:opacity-50"
            >
              {generating ? '⏳ Génération en cours…' : '🤖 Générer le rapport'}
            </button>
          </div>
        )}
      </div>

      {/* ── Relevé comptable ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="font-semibold text-gray-900 text-sm">Relevé comptable</p>
            <p className="text-xs text-gray-500 mt-0.5">
              Toutes vos transactions du {new Date(exportFrom).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au {new Date(exportTo).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <span className="text-xl flex-shrink-0">📊</span>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => download('comptable', 'csv')}
            disabled={!!downloading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:opacity-50"
          >
            {downloading === 'comptable-csv' ? '⏳' : '↓'} CSV (Excel)
          </button>
          <button
            onClick={() => download('comptable', 'pdf')}
            disabled={!!downloading}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-800 text-white transition-colors disabled:opacity-50"
          >
            {downloading === 'comptable-pdf' ? '⏳' : '↓'} PDF
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Le CSV est compatible avec Excel et les logiciels de comptabilité.
        </p>
      </div>
    </div>
  )
}

