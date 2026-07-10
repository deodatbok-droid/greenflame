'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'

interface Props {
  merchantId:   string
  isActive:     boolean
  monthlyGmv:   number   // GMV du mois en cours (pour la projection)
}

// Estimation du volume agent potentiel (≈ 30% du GMV marchand)
function computeProjection(monthlyGmv: number) {
  const agentVolume        = Math.round(monthlyGmv * 0.30)  // hypothèse conservatrice
  const merchantCommission = Math.round(agentVolume * 0.005) // 0,5%
  const gfCommission       = Math.round(agentVolume * 0.005) // 0,5%
  return { agentVolume, merchantCommission, gfCommission }
}

export default function AgentServicePanel({ merchantId, isActive, monthlyGmv }: Props) {
  const [active,  setActive]  = useState(isActive)
  const [saving,  setSaving]  = useState(false)
  const [showPrj, setShowPrj] = useState(false)

  const proj = computeProjection(monthlyGmv)

  async function toggleAgent() {
    setSaving(true)
    const next = !active
    const res  = await fetch(`/api/admin/merchants/${merchantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent_service_active: next }),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error ?? 'Erreur'); return }
    setActive(next)
    toast.success(next ? '✅ Service agent activé' : '⏸ Service agent désactivé')
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
          🏦 Service Agent GreenFlame
        </h2>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          active
            ? 'bg-green-900/40 text-green-300 border border-green-700/50'
            : 'bg-gray-700 text-gray-400'
        }`}>
          {active ? 'Actif' : 'Inactif'}
        </span>
      </div>

      <p className="text-xs text-gray-500 leading-relaxed">
        Permet au marchand de faire des dépôts et retraits cash pour les clients GreenFlame.
        Le marchand gagne <strong className="text-brand-400">0,5% de commission</strong> sur chaque retrait.
      </p>

      {/* Toggle */}
      <button
        onClick={toggleAgent}
        disabled={saving}
        className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
          active
            ? 'bg-red-900/30 text-red-300 hover:bg-red-900/50 border border-red-800/50'
            : 'bg-green-900/30 text-green-300 hover:bg-green-900/50 border border-green-800/50'
        }`}
      >
        {saving ? '...' : active ? '⏸ Désactiver le service agent' : '▶ Activer le service agent'}
      </button>

      {/* Projection revenus */}
      <div>
        <button
          onClick={() => setShowPrj(v => !v)}
          className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
        >
          {showPrj ? '▲ Masquer' : '▼ Voir projection revenus'}
        </button>

        {showPrj && (
          <div className="mt-3 bg-gray-900/50 rounded-xl p-4 space-y-3">
            <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
              Projection mensuelle (basée sur GMV actuel)
            </p>

            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">GMV mensuel marchand</span>
                <span className="text-gray-300 font-medium">
                  {monthlyGmv.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Volume agent estimé (30% GMV)</span>
                <span className="text-gray-300 font-medium">
                  {proj.agentVolume.toLocaleString('fr-FR')} FCFA
                </span>
              </div>
            </div>

            <div className="border-t border-gray-700 pt-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Commission marchand (0,5%)</span>
                <span className="text-green-400 font-bold">
                  +{proj.merchantCommission.toLocaleString('fr-FR')} FCFA/mois
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Commission GreenFlame (0,5%)</span>
                <span className="text-brand-400 font-bold">
                  +{proj.gfCommission.toLocaleString('fr-FR')} FCFA/mois
                </span>
              </div>
            </div>

            <p className="text-[10px] text-gray-600">
              * Projection basée sur 30% du GMV actuel converti en volume agent. Variable selon adoption.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
