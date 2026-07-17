'use client'

/**
 * /tontines — Page découverte tontines (fondation)
 *
 * - Mes tontines actives (depuis l'API existante /api/tontines)
 * - Section "Tontines communautaires ouvertes" (placeholder — paramètres à définir)
 * - Filtre depuis les objectifs d'épargne (?amount=X&category=Y)
 */

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { formatFcfa } from '@/lib/utils/format'
import { GOAL_CATEGORIES } from '@/lib/budget/categories'

type FreqLabel = 'hebdomadaire' | 'bimensuel' | 'mensuel'

interface MyTontine {
  id: string
  name: string
  description: string | null
  contribution_amount_fcfa: number
  frequency: FreqLabel
  status: 'actif' | 'pause' | 'termine'
  tontine_membres: { id: string; full_name: string; is_admin: boolean; user_id: string | null }[]
}

const FREQ_LABELS: Record<FreqLabel, string> = {
  hebdomadaire: 'Hebdomadaire',
  bimensuel:    '2× / mois',
  mensuel:      'Mensuel',
}

export default function TontinesPage() {
  const [myTontines, setMyTontines] = useState<MyTontine[]>([])
  const [loading,    setLoading]    = useState(true)

  // Filtres depuis redirect objectif épargne
  const [filterAmount,   setFilterAmount]   = useState('')
  const [filterCategory, setFilterCategory] = useState('')

  useEffect(() => {
    // Lire les params URL côté client
    const params = new URLSearchParams(window.location.search)
    if (params.get('amount'))   setFilterAmount(params.get('amount')!)
    if (params.get('category')) setFilterCategory(params.get('category')!)

    fetch('/api/tontines')
      .then(r => r.json())
      .then(data => {
        setMyTontines(Array.isArray(data) ? data.filter((t: MyTontine) => t.status !== 'termine') : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const categoryLabel = useMemo(
    () => GOAL_CATEGORIES.find(c => c.key === filterCategory)?.label ?? '',
    [filterCategory]
  )

  return (
    <div className="min-h-screen bg-gray-50 pb-24">

      {/* HEADER */}
      <div className="bg-white border-b border-gray-100 px-4 pt-12 pb-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard" className="p-2 -ml-2 text-gray-500">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex-1">
            <h1 className="text-lg font-bold text-gray-900">Tontines</h1>
            <p className="text-xs text-gray-400">Épargner ensemble</p>
          </div>
          <Link
            href="/tontine"
            className="px-3 py-2 bg-brand-600 text-white text-sm rounded-xl font-semibold"
          >
            + Créer
          </Link>
        </div>

        {/* Filtre depuis objectif épargne */}
        {(filterAmount || filterCategory) && (
          <div className="mt-3 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2.5 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-amber-700">Filtré depuis ton objectif d'épargne</p>
              <p className="text-xs text-amber-600">
                {filterAmount && `~${formatFcfa(Number(filterAmount))}/mois`}
                {filterAmount && filterCategory && ' · '}
                {categoryLabel}
              </p>
            </div>
            <button
              onClick={() => { setFilterAmount(''); setFilterCategory('') }}
              className="text-amber-400 hover:text-amber-700 text-xs"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      <div className="px-4 pt-4 space-y-6">

        {/* MES TONTINES */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Mes tontines</h2>

          {loading && (
            <div className="space-y-3">
              {[1, 2].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-3 bg-gray-200 rounded w-1/3" />
                </div>
              ))}
            </div>
          )}

          {!loading && myTontines.length === 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center">
              <p className="text-3xl mb-3">🤝</p>
              <p className="text-sm font-bold text-gray-800">Aucune tontine active</p>
              <p className="text-xs text-gray-400 mt-1.5 mb-5 max-w-xs mx-auto leading-relaxed">
                Une tontine, c'est un groupe d'épargne rotatif : tous les membres versent une cotisation fixe, et chaque mois un membre reçoit la mise collective. Crée le tien ou invite des membres existants à te rejoindre.
              </p>
              <Link
                href="/tontine"
                className="inline-block px-5 py-2.5 bg-brand-600 text-white text-sm rounded-xl font-semibold hover:bg-brand-700 transition-colors"
              >
                Créer ma première tontine
              </Link>
            </div>
          )}

          {!loading && myTontines.length > 0 && (
            <div className="space-y-3">
              {myTontines.map(t => {
                const memberCount = t.tontine_membres?.length ?? 0
                const isAdmin = t.tontine_membres?.some(m => m.is_admin && m.user_id)
                return (
                  <Link key={t.id} href="/tontine" className="block">
                    <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-brand-200 transition-colors">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-gray-900 truncate">{t.name}</h3>
                            {isAdmin && (
                              <span className="text-xs bg-brand-50 text-brand-600 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">Admin</span>
                            )}
                          </div>
                          {t.description && (
                            <p className="text-xs text-gray-400 mt-0.5 truncate">{t.description}</p>
                          )}
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ml-2 ${
                          t.status === 'actif' ? 'bg-green-50 text-green-600' : 'bg-yellow-50 text-yellow-600'
                        }`}>
                          {t.status === 'actif' ? 'Active' : 'Pause'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="font-semibold text-gray-700">{formatFcfa(t.contribution_amount_fcfa)}</span>
                        <span>{FREQ_LABELS[t.frequency]}</span>
                        <span>👥 {memberCount} membre{memberCount > 1 ? 's' : ''}</span>
                      </div>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* TONTINES COMMUNAUTAIRES — PLACEHOLDER */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tontines ouvertes</h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Bientôt</span>
          </div>

          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-6 text-center">
            <p className="text-3xl mb-2">🔍</p>
            <p className="text-sm font-semibold text-gray-700">Tontines communautaires</p>
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">
              Bientôt, tu pourras trouver et rejoindre des tontines ouvertes organisées par d'autres membres GreenFlame,
              filtrées par montant de cotisation et catégorie.
            </p>
            {(filterAmount || filterCategory) && (
              <div className="mt-3 bg-amber-50 rounded-xl px-3 py-2 text-xs text-amber-700">
                Ton filtre sera actif dès l'ouverture de cette fonctionnalité :<br />
                {filterAmount && `≈ ${formatFcfa(Number(filterAmount))}/mois`}
                {filterAmount && filterCategory && ' · '}
                {categoryLabel}
              </div>
            )}
          </div>
        </section>

        {/* COMMENT ÇA MARCHE */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Comment fonctionne une tontine ?</h3>
          <div className="space-y-3">
            {[
              { icon: '👥', t: 'Un groupe épargne ensemble', d: 'Chaque membre verse une cotisation fixe à intervalles réguliers.' },
              { icon: '🔄', t: 'Rotation du pot', d: 'À chaque tour, un membre reçoit la totalité des cotisations du groupe.' },
              { icon: '🎁', t: 'Produit ou cash', d: 'Sur GreenFlame, le pot peut financer directement un achat chez un marchand.' },
            ].map(step => (
              <div key={step.t} className="flex gap-3">
                <span className="text-xl leading-none mt-0.5">{step.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700">{step.t}</p>
                  <p className="text-xs text-gray-400">{step.d}</p>
                </div>
              </div>
            ))}
          </div>
          <Link href="/tontine" className="mt-4 flex items-center justify-center gap-2 w-full py-2.5 bg-brand-600 text-white text-sm rounded-xl font-semibold">
            Gérer mes tontines
          </Link>
        </section>
      </div>
    </div>
  )
}
