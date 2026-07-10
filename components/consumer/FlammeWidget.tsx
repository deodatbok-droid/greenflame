'use client'

/**
 * FlammeWidget — Affiche le rang, le score et la progression Flamme
 * de l'utilisateur. Composant client pour actualisation en direct.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'

// ─── TYPES ────────────────────────────────────────────────────────────────────

interface RangInfo {
  label: string
  emoji: string
  minScore: number
  minLifeGoals: number
}

interface NextRang {
  rang: string
  label: string
  minScore: number
  minLifeGoals: number
  scoreNeeded: number
}

interface FauMilestone {
  life_goal_index: number
  fau_granted: number
  granted_at: string
}

interface InactivityStatus {
  daysSinceActive: number | null
  daysUntilDemotion: number | null
  isAtRisk: boolean
  inWarningWindow: boolean
}

interface CommunityStats {
  count_etincelle: number
  count_flamme: number
  count_brasier: number
  count_etoile: number
  count_soleil: number
  total_members: number
}

interface FlammeData {
  flammesActivite: number
  flammesAutonomie: number
  scoreFlamme: number
  rang: string
  lifeGoalsCovered: number
  monthlyIncomeFcfa: number
  rangInfo: RangInfo
  nextRang: NextRang | null
  fauMilestones: FauMilestone[]
  communityStats?: CommunityStats
  inactivityStatus?: InactivityStatus
}

// ─── COULEURS PAR RANG ────────────────────────────────────────────────────────

const RANG_STYLES: Record<string, {
  bg: string
  border: string
  text: string
  badge: string
  progress: string
}> = {
  étincelle: {
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-600',
    progress: 'bg-gray-400',
  },
  flamme: {
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-700',
    progress: 'bg-orange-500',
  },
  brasier: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
    progress: 'bg-red-500',
  },
  étoile: {
    bg: 'bg-yellow-50',
    border: 'border-yellow-200',
    text: 'text-yellow-700',
    badge: 'bg-yellow-100 text-yellow-700',
    progress: 'bg-yellow-500',
  },
  soleil: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700',
    progress: 'bg-amber-500',
  },
}

const LIFE_GOAL_FAU = [10, 20, 30, 40, 50, 60, 70, 80, 100]

// ─── COMPOSANT ───────────────────────────────────────────────────────────────

export default function FlammeWidget() {
  const [data, setData] = useState<FlammeData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/flamme?community=1')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
        <div className="h-8 bg-gray-200 rounded w-1/2 mb-2" />
        <div className="h-2 bg-gray-200 rounded w-full" />
      </div>
    )
  }

  if (!data) return null

  const styles = RANG_STYLES[data.rang] ?? RANG_STYLES['étincelle']
  const scoreNext = data.nextRang?.minScore ?? data.rangInfo.minScore
  const scorePrev = data.rangInfo.minScore
  const progressPct = scoreNext > scorePrev
    ? Math.min(((data.scoreFlamme - scorePrev) / (scoreNext - scorePrev)) * 100, 100)
    : 100

  const fauMilestoneIndexes = new Set(data.fauMilestones.map(m => m.life_goal_index))
  const totalFauPossible = LIFE_GOAL_FAU.reduce((a, b) => a + b, 0) // 460

  return (
    <div className={`rounded-2xl border ${styles.border} ${styles.bg} p-4 space-y-3`}>

      {/* ── EN-TÊTE RANG ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{data.rangInfo.emoji}</span>
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Rang Flamme</p>
            <p className={`font-bold text-lg leading-tight ${styles.text}`}>
              {data.rangInfo.label}
            </p>
          </div>
        </div>

        {/* Score */}
        <div className={`rounded-xl px-3 py-1.5 text-center ${styles.badge}`}>
          <p className="text-xs font-medium opacity-70">Score</p>
          <p className="text-xl font-bold leading-tight">{data.scoreFlamme.toFixed(1)}</p>
        </div>
      </div>

      {/* ── ALERTE INACTIVITÉ ── compte à rebours visible avant la chute de rang
          (60j sans activité FA ni connexion — voir applyInactivityCheck).
          N'apparaît que dans la fenêtre 45-59j, jamais avant : signal
          d'alerte ponctuel, pas une pression permanente. */}
      {data.inactivityStatus?.inWarningWindow && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2.5">
          <span className="text-xl leading-none">⏳</span>
          <div>
            <p className="text-sm font-semibold text-red-700">
              {data.inactivityStatus.daysUntilDemotion} jour{(data.inactivityStatus.daysUntilDemotion ?? 0) > 1 ? 's' : ''} avant de perdre ton rang {data.rangInfo.label}
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              Sans nouvelle activité ou connexion, ton rang redescendra automatiquement.
            </p>
          </div>
        </div>
      )}

      {/* ── BARRE DE PROGRESSION ── */}
      {data.nextRang && (
        <div className="space-y-1">
          <div className="flex justify-between text-xs text-gray-500">
            <span>{data.rangInfo.label}</span>
            <span className="font-medium">
              {data.nextRang.scoreNeeded > 0
                ? `${data.nextRang.scoreNeeded.toFixed(1)} pts pour ${data.nextRang.label} ${data.nextRang && ['étoile', 'soleil'].includes(data.nextRang.rang) ? data.nextRang.rang === 'étoile' ? '⭐' : '☀️' : ''}`
                : `Prêt pour ${data.nextRang.label} !`
              }
            </span>
          </div>
          <div className="w-full bg-white rounded-full h-2 overflow-hidden">
            <div
              className={`h-2 rounded-full transition-all duration-700 ${styles.progress}`}
              style={{ width: `${progressPct}%` }}
            />
          </div>
          {/* Gate spéciale si rang nécessite objectifs de vie */}
          {data.nextRang.minLifeGoals > 0 && data.lifeGoalsCovered < data.nextRang.minLifeGoals && (
            <p className="text-xs text-gray-500">
              Nécessite aussi {data.nextRang.minLifeGoals} objectif{data.nextRang.minLifeGoals > 1 ? 's' : ''} de vie couvert{data.nextRang.minLifeGoals > 1 ? 's' : ''}
              {' '}({data.lifeGoalsCovered}/{data.nextRang.minLifeGoals} atteint{data.lifeGoalsCovered > 1 ? 's' : ''})
            </p>
          )}
        </div>
      )}

      {/* ── FLAMMES (FA + FAU) ── */}
      <div className="flex gap-2">
        <div className="flex-1 bg-white rounded-xl p-2.5 text-center border border-gray-100">
          <p className="text-xs text-gray-500 mb-0.5">Flammes Activité</p>
          <p className="text-xl font-bold text-orange-600">🔥 {data.flammesActivite}</p>
        </div>
        <div className="flex-1 bg-white rounded-xl p-2.5 text-center border border-gray-100">
          <p className="text-xs text-gray-500 mb-0.5">Flammes Autonomie</p>
          <p className="text-xl font-bold text-amber-600">⭐ {data.flammesAutonomie}</p>
          <p className="text-xs text-gray-400">{fauMilestoneIndexes.size}/9 paliers</p>
        </div>
      </div>

      {/* ── PALIERS FAU ── */}
      {LIFE_GOAL_FAU.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">Paliers d'autonomie</p>
          <div className="flex gap-1 flex-wrap">
            {LIFE_GOAL_FAU.map((fau, idx) => {
              const unlocked = fauMilestoneIndexes.has(idx)
              return (
                <div
                  key={idx}
                  title={`Palier ${idx + 1} — ${fau} FAU`}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all
                    ${unlocked
                      ? 'bg-amber-400 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-400'
                    }`}
                >
                  {unlocked ? '⭐' : idx + 1}
                </div>
              )
            })}
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {fauMilestoneIndexes.size * 10 > 0 && `${data.flammesAutonomie} FAU sur ${totalFauPossible} possibles`}
          </p>
        </div>
      )}

      {/* ── COMPTEUR COMMUNAUTAIRE ── */}
      {data.communityStats && (data.communityStats.count_etoile > 0 || data.communityStats.count_soleil > 0) && (
        <div className="bg-white rounded-xl p-3 border border-gray-100">
          <p className="text-xs font-medium text-gray-500 mb-2">Notre communauté</p>
          <div className="flex gap-3 flex-wrap">
            {data.communityStats.count_soleil > 0 && (
              <span className="text-sm font-bold text-amber-600">
                ☀️ {data.communityStats.count_soleil} Soleil{data.communityStats.count_soleil > 1 ? 's' : ''}
              </span>
            )}
            {data.communityStats.count_etoile > 0 && (
              <span className="text-sm font-bold text-yellow-600">
                ⭐ {data.communityStats.count_etoile} Étoile{data.communityStats.count_etoile > 1 ? 's' : ''}
              </span>
            )}
            {data.communityStats.count_brasier > 0 && (
              <span className="text-sm text-red-600">
                🌋 {data.communityStats.count_brasier} Brasier{data.communityStats.count_brasier > 1 ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── LIEN VERS PACK MYSTÈRE ── */}
      <Link
        href="/pack-mystere"
        className={`w-full flex items-center justify-center gap-2 rounded-xl py-2 text-sm font-semibold
          bg-white border ${styles.border} ${styles.text} hover:opacity-80 transition-opacity`}
      >
        🎁 Pack Mystère — booster mes Flammes
      </Link>
    </div>
  )
}
