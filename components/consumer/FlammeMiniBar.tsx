'use client'

/**
 * components/consumer/FlammeMiniBar.tsx
 *
 * Barre de progression Flamme compacte pour le dashboard.
 * Affiche : rang actuel + progress bar + "encore X pts pour rang suivant".
 * Les données viennent du même endpoint /api/flamme que le FlammeWidget complet.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface FlammeBar {
  scoreFlamme: number
  rang: string
  rangInfo: { label: string; emoji: string; minScore: number }
  nextRang: { label: string; emoji?: string; minScore: number; scoreNeeded: number } | null
}

const RANG_PROGRESS: Record<string, string> = {
  étincelle: 'bg-gray-400',
  flamme:    'bg-orange-500',
  brasier:   'bg-red-500',
  étoile:    'bg-yellow-500',
  soleil:    'bg-amber-500',
}

export default function FlammeMiniBar() {
  const [data, setData] = useState<FlammeBar | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/flamme')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-3 animate-pulse">
        <div className="flex justify-between items-center mb-2">
          <div className="h-3 bg-gray-200 rounded-full w-24" />
          <div className="h-3 bg-gray-200 rounded-full w-20" />
        </div>
        <div className="h-2 bg-gray-200 rounded-full w-full" />
      </div>
    )
  }

  if (!data) return null

  const progressColor = RANG_PROGRESS[data.rang] ?? 'bg-gray-400'
  const scoreNext = data.nextRang?.minScore ?? data.rangInfo.minScore
  const scorePrev = data.rangInfo.minScore
  const progressPct = scoreNext > scorePrev
    ? Math.min(((data.scoreFlamme - scorePrev) / (scoreNext - scorePrev)) * 100, 100)
    : 100

  return (
    <Link href="/profile#flamme">
      <div className="bg-white rounded-2xl border border-gray-100 hover:border-orange-200 transition-colors p-3.5 cursor-pointer">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <span className="text-base leading-none">{data.rangInfo.emoji}</span>
            <span className="text-xs font-semibold text-gray-700">
              Rang {data.rangInfo.label}
            </span>
            <span className="text-xs text-gray-400 ml-1">· {data.scoreFlamme.toFixed(0)} pts</span>
          </div>
          {data.nextRang ? (
            <span className="text-xs text-orange-600 font-medium">
              encore {data.nextRang.scoreNeeded.toFixed(0)} pts → {data.nextRang.label}
            </span>
          ) : (
            <span className="text-xs text-amber-600 font-semibold">🏆 Rang max !</span>
          )}
        </div>
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${progressColor}`}
            style={{ width: `${Math.max(progressPct, progressPct > 0 ? 3 : 0)}%` }}
          />
        </div>
      </div>
    </Link>
  )
}
