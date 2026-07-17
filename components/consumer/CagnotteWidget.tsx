'use client'

import { useEffect, useState } from 'react'

interface PotState {
  current_balance_fcfa: number
  total_contributed_fcfa: number
  total_drawn_fcfa: number
  active_contributors: number
  last_draw_at: string | null
}

interface Eligibility {
  isEligible: boolean
  contributedThisMonth: boolean
  blockedUntil: string | null
}

interface Consolation {
  id: string
  item_key: string
  delivered: boolean
  created_at: string
}

interface Contributor {
  userId: string
  initials: string
  name: string
}

interface CagnotteData {
  pot: PotState
  eligibility: Eligibility
  consolations: Consolation[]
  contributors: Contributor[]
}

const CONSOLATION_LABELS: Record<string, string> = {
  academie_module_unlock: '📚 Module Académie offert',
  pack_mystere_bronze:    '🎁 Pack Mystère Bronze offert',
  boost_cashback_7d:      '⚡ Boost cashback ×1.5 – 7 jours',
  fa_bonus_5:             '🔥 5 Flammes bonus',
  gfp_bonus_100:          '💎 100 GFP bonus',
}

function formatFcfa(n: number) {
  if (!Number.isFinite(n)) return '0 F'
  return new Intl.NumberFormat('fr-FR').format(n) + ' F'
}

function nextMilestone(balance: number): number {
  const steps = [5000, 10000, 25000, 50000, 100000, 250000, 500000]
  return steps.find(s => s > balance) ?? balance * 2
}

const AVATAR_COLORS = [
  'bg-orange-400', 'bg-green-500', 'bg-blue-500', 'bg-purple-500',
  'bg-pink-500', 'bg-teal-500', 'bg-indigo-500', 'bg-yellow-500',
]

export default function CagnotteWidget() {
  const [data, setData] = useState<CagnotteData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/cagnotte')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4 animate-pulse space-y-3">
        <div className="h-4 bg-gray-200 rounded w-1/3" />
        <div className="h-8 bg-gray-200 rounded w-1/2" />
        <div className="h-3 bg-gray-200 rounded-full w-full" />
        <div className="flex gap-2">
          {[1,2,3,4].map(i => <div key={i} className="w-9 h-9 rounded-full bg-gray-200" />)}
        </div>
      </div>
    )
  }

  if (!data) return null

  const { pot, eligibility, consolations, contributors } = data
  const undelivered = consolations.filter(c => !c.delivered)
  const balance = pot.current_balance_fcfa ?? 0
  const milestone = nextMilestone(balance)
  const progress = Math.min((balance / milestone) * 100, 100)

  return (
    <div className="card-tinted rounded-2xl border border-green-200 bg-green-50 p-4 space-y-4">

      {/* ── EN-TÊTE ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">💰</span>
          <div>
            <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">
              Cagnotte Communautaire
            </p>
            <p className="font-bold text-xl text-green-700 leading-tight">
              {formatFcfa(balance)}
            </p>
          </div>
        </div>
        {eligibility.isEligible && (
          <span className="text-[10px] bg-green-200 text-green-800 rounded-full px-2 py-0.5 font-semibold">
            ✓ Éligible
          </span>
        )}
      </div>

      {/* ── BARRE DE PROGRESSION ── */}
      <div className="space-y-1">
        <div className="flex justify-between text-[10px] text-gray-500">
          <span>0 F</span>
          <span className="text-green-700 font-semibold">Objectif : {formatFcfa(milestone)}</span>
        </div>
        <div className="w-full h-3 bg-white rounded-full border border-green-200 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-[10px] text-gray-400 text-right">{progress.toFixed(1)}% remplie</p>
      </div>

      {/* ── CONTRIBUTEURS ACTIFS (liste défilante horizontale) ── */}
      {contributors.length > 0 && (
        <div className="space-y-1">
          <p className="text-[10px] text-gray-500 font-medium">
            {contributors.length} contributeur{contributors.length > 1 ? 's' : ''} actif{contributors.length > 1 ? 's' : ''} ce mois
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {contributors.map((c, i) => (
              <div key={c.userId} className="flex-shrink-0 flex flex-col items-center gap-0.5">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}>
                  {c.initials}
                </div>
                <p className="text-[9px] text-gray-500 w-10 text-center truncate">{c.name.split(' ')[0]}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── ÉLIGIBILITÉ ── */}
      <div className={`rounded-xl p-3 border text-xs ${eligibility.isEligible ? 'bg-white border-green-200' : 'bg-orange-50 border-orange-200'}`}>
        <div className="flex items-center gap-2">
          <span className="text-base">{eligibility.isEligible ? '🎯' : '⏳'}</span>
          <p className="font-semibold text-gray-700">
            {eligibility.isEligible
              ? 'Tu participes au prochain tirage'
              : eligibility.contributedThisMonth
                ? 'Contribution reçue — tirage à venir'
                : 'Pas encore éligible ce mois-ci'}
          </p>
        </div>
        {!eligibility.contributedThisMonth && (
          <p className="text-orange-600 mt-1">
            50 F seront retenus de ton prochain cashback pour rejoindre la cagnotte.
          </p>
        )}
        {eligibility.blockedUntil && (
          <p className="text-gray-500 mt-1">
            Re-éligible le {new Date(eligibility.blockedUntil).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
          </p>
        )}
      </div>

      {/* ── CONSOLATIONS ── */}
      {undelivered.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
          <p className="text-xs font-semibold text-amber-700">
            🎁 {undelivered.length} cadeau{undelivered.length > 1 ? 'x' : ''} à récupérer
          </p>
          {undelivered.map(c => (
            <p key={c.id} className="text-xs text-amber-800">
              {CONSOLATION_LABELS[c.item_key] ?? c.item_key}
            </p>
          ))}
        </div>
      )}

      {/* ── FOOTER ── */}
      <p className="text-[10px] text-gray-400 text-center">
        50 F de ton premier cashback chaque mois · Tirage surprise · Tu peux gagner la cagnotte entière !
      </p>
    </div>
  )
}
