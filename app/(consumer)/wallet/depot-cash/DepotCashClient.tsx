'use client'

import { useState } from 'react'
import Link from 'next/link'
import { formatFcfa } from '@/lib/utils/format'

const QUICK_AMOUNTS = [1000, 2000, 5000, 10000, 20000, 50000]

export default function DepotCashClient({
  phone,
  name,
}: {
  phone: string
  name: string
}) {
  const [amount, setAmount] = useState('')
  const [showCard, setShowCard] = useState(false)

  const amountNum = parseInt(amount.replace(/\D/g, ''), 10) || 0
  const ready = amountNum >= 500

  function openCard() {
    if (ready) setShowCard(true)
  }

  // ── Carte "Présenter à l'agent" ──────────────────────────────────
  if (showCard) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
        <div className="max-w-sm w-full space-y-4">

          <div className="text-center">
            <p className="text-gray-400 text-sm">Montrez cet écran à l'agent GreenFlame</p>
          </div>

          {/* Grande carte à présenter */}
          <div className="bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="bg-brand-600 px-6 py-5 flex items-center gap-3">
              <span className="text-3xl">💵</span>
              <div>
                <p className="text-white font-bold text-lg">Dépôt cash</p>
                <p className="text-brand-200 text-sm">GreenFlame</p>
              </div>
            </div>

            <div className="px-6 py-6 space-y-5">
              <div className="text-center">
                <p className="text-gray-400 text-xs uppercase tracking-wide font-medium mb-1">
                  Montant à déposer
                </p>
                <p className="text-4xl font-bold text-gray-900">
                  {formatFcfa(amountNum)}
                </p>
                <p className="text-gray-500 text-sm">FCFA</p>
              </div>

              <div className="h-px bg-gray-100" />

              <div>
                <p className="text-gray-400 text-xs uppercase tracking-wide font-medium mb-2">
                  Compte à créditer
                </p>
                <p className="text-xl font-bold text-gray-900 tracking-widest">
                  {phone}
                </p>
                <p className="text-gray-500 text-sm">{name}</p>
              </div>
            </div>

            <div className="bg-brand-50 px-6 py-3 flex items-center gap-2">
              <span className="text-brand-600 text-xs">🔒</span>
              <p className="text-brand-700 text-xs font-medium">
                L'agent entre votre numéro pour valider le dépôt
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowCard(false)}
            className="w-full py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold rounded-xl transition-colors text-sm"
          >
            ← Modifier le montant
          </button>

        </div>
      </div>
    )
  }

  // ── Formulaire ────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-6">

        {/* En-tête */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Déposer du cash</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              Convertir du cash en solde GreenFlame via un agent
            </p>
          </div>
          <Link href="/wallet" className="text-sm text-gray-400 hover:text-white transition-colors">
            ← Wallet
          </Link>
        </div>

        {/* Explication */}
        <div className="bg-brand-900/40 border border-brand-800 rounded-2xl p-4 space-y-2">
          <p className="text-brand-300 text-sm font-semibold">Comment ça marche ?</p>
          <ol className="text-brand-200 text-sm space-y-1 list-decimal list-inside">
            <li>Entrez le montant que vous souhaitez déposer</li>
            <li>Trouvez un agent GreenFlame agréé près de vous</li>
            <li>Montrez l'écran de confirmation à l'agent</li>
            <li>Remettez le cash — votre wallet est crédité immédiatement</li>
          </ol>
        </div>

        {/* Montant */}
        <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
          <div>
            <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-2">
              Montant à déposer (FCFA) *
            </label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="Ex : 5 000"
              min="500"
              className="w-full bg-gray-700 text-white text-2xl font-bold rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-brand-500 transition placeholder:text-gray-600"
              inputMode="numeric"
            />
            <p className="text-xs text-gray-500 mt-1.5">Minimum : 500 FCFA</p>
          </div>

          {/* Montants rapides */}
          <div className="flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map(a => (
              <button
                key={a}
                type="button"
                onClick={() => setAmount(String(a))}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  amount === String(a)
                    ? 'bg-brand-600 text-white'
                    : 'bg-gray-700 text-gray-300 hover:text-white hover:bg-gray-600'
                }`}
              >
                {a >= 1000 ? `${a / 1000}k` : a}
              </button>
            ))}
          </div>
        </div>

        {/* Compte destinataire */}
        <div className="bg-gray-800 rounded-2xl p-5">
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wide mb-3">
            Votre compte
          </p>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-white text-lg font-bold">
                {name.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-white font-semibold">{name}</p>
              <p className="text-gray-400 text-sm tracking-wide">{phone}</p>
            </div>
          </div>
        </div>

        {/* Bouton principal */}
        <button
          onClick={openCard}
          disabled={!ready}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-4 rounded-xl transition-colors text-base"
        >
          {ready
            ? `Générer la carte · ${formatFcfa(amountNum)} FCFA`
            : 'Entrez un montant (min 500 FCFA)'}
        </button>

      </div>
    </div>
  )
}
