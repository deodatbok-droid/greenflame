'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Digest {
  id:              string
  period_date:     string
  generated_at:    string
  generated_by:    string
  summary:         string
  findings:        string[]
  recommendations: string[]
  risk_level:      'normal' | 'attention' | 'alert'
}

interface Props {
  digest: Digest | null
}

function formatPeriodDate(periodDate: string): string {
  // Parse YYYY-MM-DD en date locale pour éviter le décalage UTC → UTC+1
  const [y, m, d] = periodDate.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long',
  })
}

function formatGeneratedAt(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

export default function DigestCard({ digest }: Props) {
  const router             = useRouter()
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  async function triggerDigest() {
    setLoading(true)
    const res = await fetch('/api/admin/trigger-digest', { method: 'POST' })
    setLoading(false)

    if (!res.ok) {
      const d = await res.json()
      toast.error(d.error ?? 'Erreur lors de la génération')
      return
    }

    toast.success('Rapport IA généré ✓')
    router.refresh()
  }

  const riskConfig = {
    normal:    { bg: 'bg-emerald-900/20', border: 'border-emerald-800/40', badge: 'bg-emerald-900/40 text-emerald-400', label: 'Tout va bien',    icon: '✅' },
    attention: { bg: 'bg-yellow-900/20',  border: 'border-yellow-800/40',  badge: 'bg-yellow-900/40 text-yellow-400',  label: 'Points à suivre', icon: '⚠️' },
    alert:     { bg: 'bg-red-900/20',     border: 'border-red-800/40',     badge: 'bg-red-900/40 text-red-400',        label: 'Action requise',  icon: '🚨' },
  }

  const cfg = digest ? riskConfig[digest.risk_level] : null

  return (
    <div className={`rounded-xl border p-5 space-y-4 ${
      cfg ? `${cfg.bg} ${cfg.border}` : 'bg-gray-800/50 border-gray-700'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">🤖</span>
          <div className="min-w-0">
            <p className="font-semibold text-white text-sm">Rapport IA quotidien</p>
            {digest ? (
              <p className="text-xs text-gray-400">
                {mounted ? formatPeriodDate(digest.period_date) : digest.period_date}
                {' · '}
                {digest.generated_by === 'manual' ? 'Déclenché manuellement' : 'Généré automatiquement'}
                {mounted ? ` · ${formatGeneratedAt(digest.generated_at)}` : ''}
              </p>
            ) : (
              <p className="text-xs text-gray-500">Aucun rapport généré aujourd'hui</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {digest && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg!.badge}`}>
              {cfg!.icon} {cfg!.label}
            </span>
          )}
          <button
            onClick={triggerDigest}
            disabled={loading}
            className="text-xs px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors disabled:opacity-50 flex items-center gap-1"
          >
            {loading ? (
              <>
                <span className="animate-spin text-base">⏳</span> Génération…
              </>
            ) : (
              '↻ Actualiser'
            )}
          </button>
        </div>
      </div>

      {digest ? (
        <>
          {/* Résumé exécutif */}
          <p className="text-gray-200 text-sm leading-relaxed">{digest.summary}</p>

          {/* Points clés */}
          {digest.findings.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Points clés</p>
              <ul className="space-y-1.5">
                {digest.findings.map((f, i) => (
                  <li key={i} className="text-sm text-gray-300 flex items-start gap-2">
                    <span className="flex-shrink-0 mt-0.5 text-gray-500">·</span>
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommandations */}
          {digest.recommendations.length > 0 && (
            <div className="bg-black/20 rounded-lg p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">Actions suggérées</p>
              <ul className="space-y-1.5">
                {digest.recommendations.map((r, i) => (
                  <li key={i} className="text-sm text-gray-200 flex items-start gap-2">
                    <span className="text-brand-400 flex-shrink-0 font-bold">{i + 1}.</span>
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-4">
          <p className="text-gray-400 text-sm mb-3">
            Le rapport automatique est généré à 8h chaque matin.
          </p>
          <button
            onClick={triggerDigest}
            disabled={loading}
            className="text-sm px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 text-white transition-colors disabled:opacity-50"
          >
            {loading ? 'Génération en cours…' : '🤖 Générer maintenant'}
          </button>
        </div>
      )}
    </div>
  )
}
