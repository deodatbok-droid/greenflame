'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatExactAmount, commissionCode } from '@/lib/utils/format'

interface Props {
  merchantId: string
  initialRate: number
  initialActive: boolean
  initialVerified: boolean
}

export default function MerchantAdminPanel({ merchantId, initialRate, initialActive, initialVerified }: Props) {
  const [rate, setRate] = useState(String(initialRate * 100))
  const [isActive, setIsActive] = useState(initialActive)
  const [isVerified, setIsVerified] = useState(initialVerified)
  const [saving, setSaving] = useState(false)
  const [editRate, setEditRate] = useState(false)

  async function patch(body: Record<string, unknown>) {
    setSaving(true)
    const res = await fetch(`/api/admin/merchants/${merchantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { toast.error(data.error ?? 'Erreur'); return false }
    return true
  }

  async function saveRate() {
    const rateNum = parseFloat(rate)
    if (isNaN(rateNum) || rateNum < 0 || rateNum > 50) {
      toast.error('Taux invalide (entre 0% et 50%)')
      return
    }
    const ok = await patch({ commission_rate: rateNum / 100 })
    if (ok) { toast.success(`Taux mis a jour : ${rateNum}%`); setEditRate(false) }
  }

  async function toggleActive() {
    const next = !isActive
    const ok = await patch({ is_active: next })
    if (ok) { setIsActive(next); toast.success(next ? 'Marchand reactive' : 'Marchand suspendu') }
  }

  async function toggleVerified() {
    const next = !isVerified
    const ok = await patch({ is_verified: next })
    if (ok) { setIsVerified(next); toast.success(next ? 'Marchand verifie ✓' : 'Vérification retiree') }
  }

  const rateNum = parseFloat(rate) || 0
  const breakdown = {
    merchant: 100 - rateNum,
    platform: rateNum * 0.45,
    cashback: rateNum * 0.12,
    rewards:  rateNum * 0.03,
    network:  rateNum * 0.40,
  }
  const fmt1000 = (pct: number) => formatExactAmount(1000 * pct / 100)
  const fmtPct  = (pct: number) => pct.toLocaleString('fr-FR', { maximumFractionDigits: 4 }) + '%'

  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-5">
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">
        Parametres admin
      </h2>

      {/* Commission rate */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium text-sm">Taux de commission GreenFlame</p>
            <p className="text-gray-500 text-xs">% preleve sur chaque transaction de ce marchand</p>
          </div>
          {!editRate ? (
            <div className="flex items-center gap-3">
              <span className="text-2xl font-bold text-brand-400">{commissionCode(rateNum / 100)}</span>
              <span className="text-gray-500 text-sm ml-1">({fmtPct(rateNum)})</span>
              <button
                onClick={() => setEditRate(true)}
                className="text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                Modifier
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="50"
                  step="0.5"
                  value={rate}
                  onChange={e => setRate(e.target.value)}
                  className="w-20 bg-gray-700 text-white px-3 py-1.5 rounded-lg border border-brand-500 focus:outline-none text-sm text-right"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs pointer-events-none">%</span>
              </div>
              <button
                onClick={saveRate}
                disabled={saving}
                className="text-xs bg-brand-600 hover:bg-brand-700 text-white px-3 py-1.5 rounded-lg transition-colors font-medium"
              >
                {saving ? '...' : 'OK'}
              </button>
              <button
                onClick={() => { setRate(String(initialRate * 100)); setEditRate(false) }}
                className="text-xs bg-gray-700 text-gray-400 px-3 py-1.5 rounded-lg"
              >
                Annuler
              </button>
            </div>
          )}
        </div>

        {/* Distribution breakdown */}
        <div className="bg-gray-900/50 rounded-xl p-3 space-y-2">
          <p className="text-xs text-gray-500 font-medium mb-2">Repartition pour une transaction de 1 000 FCFA</p>
          <div className="space-y-1.5">
            {[
              { label: 'Marchand reçoit',                    val: fmt1000(breakdown.merchant), color: 'text-green-400',   pct: fmtPct(breakdown.merchant) },
              { label: 'Plateforme GreenFlame (45%)',         val: fmt1000(breakdown.platform), color: 'text-brand-400',  pct: fmtPct(breakdown.platform) },
              { label: 'Cashback acheteur (12%)',             val: fmt1000(breakdown.cashback), color: 'text-blue-400',   pct: fmtPct(breakdown.cashback) },
              { label: 'Pool Récompenses (3%)',               val: fmt1000(breakdown.rewards),  color: 'text-amber-400',  pct: fmtPct(breakdown.rewards)  },
              { label: 'Dividendes communauté N1-N5 (40%)',  val: fmt1000(breakdown.network),  color: 'text-indigo-400', pct: fmtPct(breakdown.network)  },
            ].map(row => (
              <div key={row.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${row.color.replace('text-', 'bg-')}`} />
                  <span className="text-gray-400">{row.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">{row.pct}</span>
                  <span className={`font-semibold ${row.color}`}>{row.val}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="border-t border-gray-700 pt-1.5 mt-1.5">
            <p className="text-xs text-gray-600">
              Code {commissionCode(rateNum / 100)} · <span className="text-gray-400 font-medium">{fmtPct(rateNum)}</span> prélevés sur chaque transaction
            </p>
          </div>
        </div>
      </div>

      {/* Statut */}
      <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-700">
        <button
          onClick={toggleActive}
          disabled={saving}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            isActive
              ? 'bg-red-900/30 text-red-300 hover:bg-red-900/50 border border-red-800/50'
              : 'bg-green-900/30 text-green-300 hover:bg-green-900/50 border border-green-800/50'
          }`}
        >
          {isActive ? '⏸ Suspendre' : '▶ Reactiver'}
        </button>
        <button
          onClick={toggleVerified}
          disabled={saving}
          className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-colors ${
            isVerified
              ? 'bg-gray-700/50 text-gray-400 hover:bg-gray-700 border border-gray-600'
              : 'bg-blue-900/30 text-blue-300 hover:bg-blue-900/50 border border-blue-800/50'
          }`}
        >
          {isVerified ? '✓ Verifie — retirer' : '✓ Marquer verifie'}
        </button>
      </div>

      <p className="text-xs text-gray-600">
        Modifications immediates — le nouveau taux s&apos;applique aux prochaines transactions.
        Les transactions existantes ne sont pas modifiees.
      </p>
    </div>
  )
}
