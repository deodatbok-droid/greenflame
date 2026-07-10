'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'

const REASONS = [
  { value: 'deposit_cash',  label: '💵 Dépôt espèces (reçu en main propre)' },
  { value: 'deposit_momo',  label: '📱 Dépôt Mobile Money (MoMo reçu, confirmé)' },
  { value: 'test',          label: '🧪 Test / démonstration' },
  { value: 'bonus',         label: '🎁 Bonus offert' },
  { value: 'correction',    label: '🔧 Correction erreur' },
  { value: 'compensation',  label: '🤝 Compensation client' },
  { value: 'admin_credit',  label: '⚙️ Autre (admin)' },
]

export default function WalletCreditPanel({ userId }: { userId: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [amountFcfa, setAmountFcfa] = useState('')
  const [amountGfp, setAmountPgf] = useState('')
  const [reason, setReason] = useState('test')
  const [loading, setLoading] = useState(false)

  const fcfaNum = parseInt(amountFcfa.replace(/\D/g, '')) || 0
  const gfpNum  = parseInt(amountGfp.replace(/\D/g, ''))  || 0

  async function handleCredit() {
    if (fcfaNum === 0 && gfpNum === 0) {
      toast.error('Entrez au moins un montant')
      return
    }
    setLoading(true)
    const res = await fetch('/api/admin/credit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId, amountFcfa: fcfaNum, amountGfp: gfpNum, reason }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      toast.error(data.error ?? 'Erreur lors du crédit')
      return
    }
    toast.success(`Wallet crédité : ${fcfaNum > 0 ? `${formatFcfa(fcfaNum)} FCFA` : ''}${fcfaNum > 0 && gfpNum > 0 ? ' + ' : ''}${gfpNum > 0 ? `${gfpNum.toLocaleString()} GFP` : ''}`)
    setAmountFcfa('')
    setAmountPgf('')
    setOpen(false)
    router.refresh()
  }

  return (
    <div className="mt-3 border border-amber-600/60 bg-amber-950/30 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-amber-400">💳 Créditer le wallet</p>
        <button
          onClick={() => setOpen(!open)}
          className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
        >
          {open ? 'Réduire ▲' : 'Ouvrir ▼'}
        </button>
      </div>

    {open && (<>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">FCFA</label>
          <input
            type="text"
            inputMode="numeric"
            value={amountFcfa}
            onChange={e => setAmountFcfa(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            className="w-full bg-gray-700 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-right"
          />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">GFP</label>
          <input
            type="text"
            inputMode="numeric"
            value={amountGfp}
            onChange={e => setAmountPgf(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            className="w-full bg-gray-700 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none text-right"
          />
        </div>
      </div>

      <div>
        <label className="text-xs text-gray-400 block mb-1">Motif</label>
        <select
          value={reason}
          onChange={e => setReason(e.target.value)}
          className="w-full bg-gray-700 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:border-amber-500 focus:outline-none"
        >
          {REASONS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {(fcfaNum > 0 || gfpNum > 0) && (
        <div className="bg-amber-900/30 border border-amber-700/40 rounded-lg px-3 py-2 text-xs text-amber-300">
          Crédit : {fcfaNum > 0 && `${formatFcfa(fcfaNum)} FCFA`}{fcfaNum > 0 && gfpNum > 0 && ' + '}{gfpNum > 0 && `${gfpNum.toLocaleString()} GFP`}
          {' '}— motif : {REASONS.find(r => r.value === reason)?.label}
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={handleCredit}
          disabled={loading || (fcfaNum === 0 && gfpNum === 0)}
          className="flex-1 bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 rounded-lg transition-colors"
        >
          {loading ? 'Crédit en cours...' : '✓ Confirmer le crédit'}
        </button>
        <button
          onClick={() => { setAmountFcfa(''); setAmountPgf('') }}
          className="px-3 bg-gray-700 text-gray-400 text-xs py-2 rounded-lg hover:bg-gray-600"
        >
          Réinitialiser
        </button>
      </div>
      </>)}
    </div>
  )
}
