'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface PackDef {
  id: string
  tier: 'bronze' | 'argent' | 'or'
  price_fcfa: number
  fa_guaranteed: number
  description_fr: string
  marketplace_product_id: string | null
}

const TIER_CONFIG = {
  bronze: {
    border: 'border-orange-300',
    bg: 'from-orange-50 to-orange-100/60',
    button: 'bg-orange-500 hover:bg-orange-600 text-white',
    badge: 'bg-orange-100 text-orange-700',
    emoji: '🥉',
    label: 'Bronze',
    description: 'Idéal pour débuter — 2 Flammes garanties + un item surprise.',
    raretes: ['Commun', 'Rare'],
  },
  argent: {
    border: 'border-slate-300',
    bg: 'from-slate-50 to-slate-100/60',
    button: 'bg-slate-700 hover:bg-slate-800 text-white',
    badge: 'bg-slate-100 text-slate-700',
    emoji: '🥈',
    label: 'Argent',
    description: 'Le plus populaire — 3 Flammes + surprise de meilleure qualité.',
    raretes: ['Commun', 'Rare', 'Épique'],
  },
  or: {
    border: 'border-yellow-400',
    bg: 'from-yellow-50 to-amber-100/60',
    button: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    badge: 'bg-yellow-100 text-yellow-700',
    emoji: '🥇',
    label: 'Or',
    description: 'L\'expérience premium — 5 Flammes + surprise exclusive légendaire.',
    raretes: ['Commun', 'Rare', 'Épique', 'Légendaire'],
  },
} as const

const RARITY_PILL: Record<string, string> = {
  'Commun':     'bg-gray-100 text-gray-600',
  'Rare':       'bg-blue-100 text-blue-700',
  'Épique':     'bg-purple-100 text-purple-700',
  'Légendaire': 'bg-yellow-100 text-yellow-700',
}

function formatFcfa(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' F'
}

export default function PackMystereClient() {
  const [catalog, setCatalog] = useState<PackDef[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/pack-mystere')
      .then(r => r.json())
      .then(d => { setCatalog(d.catalog ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/dashboard" className="text-sm text-gray-700 hover:text-gray-900 flex items-center gap-1 font-medium">
            ← Retour
          </Link>
        </div>

        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900">🎁 Pack Mystère</h1>
          <p className="text-gray-500">Chaque pack garantit des Flammes + des surprises !</p>
        </div>

        {/* Grille des packs */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-80 bg-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {catalog.map(pack => {
              const cfg = TIER_CONFIG[pack.tier]
              const href = pack.marketplace_product_id
                ? `/marketplace/produit/${pack.marketplace_product_id}`
                : '/marketplace'

              return (
                <div
                  key={pack.id}
                  className={`flex flex-col rounded-2xl border-2 ${cfg.border} bg-gradient-to-b ${cfg.bg} p-6 shadow-sm`}
                >
                  {/* Emoji + label */}
                  <div className="flex items-center gap-3 mb-4">
                    <span className="text-4xl leading-none">{cfg.emoji}</span>
                    <div>
                      <p className="font-bold text-gray-900 text-xl">Pack {cfg.label}</p>
                      <p className="text-3xl font-bold text-gray-900 leading-tight">
                        {formatFcfa(pack.price_fcfa)}
                      </p>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 text-sm leading-relaxed mb-5">
                    {cfg.description}
                  </p>

                  {/* Ce que tu reçois */}
                  <div className="flex flex-wrap gap-2 mb-5">
                    <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700">
                      🔥 +{pack.fa_guaranteed} Flammes
                    </span>
                    <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700">
                      🎲 1 item exclusif
                    </span>
                    <span className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-semibold text-gray-700">
                      ✨ Rareté surprise
                    </span>
                  </div>

                  {/* Raretés disponibles */}
                  <div className="mb-6">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                      Raretés possibles
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {cfg.raretes.map(r => (
                        <span key={r} className={`text-xs px-2.5 py-1 rounded-full font-medium ${RARITY_PILL[r]}`}>
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Bouton — poussé en bas */}
                  <div className="mt-auto">
                    <Link href={href} className="block">
                      <span className={`block w-full py-3 rounded-xl font-bold text-sm text-center transition-all active:scale-95 ${cfg.button}`}>
                        Acheter ce Pack →
                      </span>
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-xs text-gray-400 text-center">
          Paiement sécurisé via GreenFlame Hub · Mobile Money ou portefeuille GF
        </p>
      </div>
    </div>
  )
}
