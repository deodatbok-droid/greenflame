'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'

interface PendingRequest {
  id: string
  amount_fcfa: number
  operator: string
  phone: string
  admin_note: string | null
  created_at: string
}

interface Props {
  requests: PendingRequest[]
}

export default function PendingWithdrawValidations({ requests }: Props) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const visible = requests.filter(r => !dismissed.has(r.id))
  if (visible.length === 0) return null

  async function handleValidate(requestId: string) {
    if (!pin.trim()) { toast.error('Entrez votre code PIN'); return }
    setLoading(true)
    const res = await fetch('/api/wallets/withdraw/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId, pin }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      toast.error(data.error ?? 'Erreur lors de la validation')
      return
    }
    toast.success(data.message ?? 'Retrait validé avec succès !')
    setActiveId(null)
    setPin('')
    setDismissed(prev => new Set([...prev, requestId]))
  }

  const activeRequest = requests.find(r => r.id === activeId)

  return (
    <>
      <div className="space-y-3">
        <h2 className="font-semibold text-gray-900">Validations en attente</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1">
          <p className="text-amber-800 text-sm font-medium">
            Un administrateur a initié {visible.length > 1 ? `${visible.length} demandes de retrait` : 'une demande de retrait'} en votre nom.
          </p>
          <p className="text-amber-600 text-xs">Vérifiez les détails et validez avec votre PIN pour confirmer.</p>
        </div>

        {visible.map(r => (
          <div key={r.id} className="bg-white rounded-2xl border border-amber-200 shadow-sm p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-bold text-gray-900 text-lg">{formatFcfa(r.amount_fcfa)} FCFA</p>
                <p className="text-sm text-gray-600">
                  {r.operator === 'mtn_momo' ? 'MTN MoMo' : 'Moov Flooz'} · {r.phone}
                </p>
                {r.admin_note && (
                  <p className="text-xs text-gray-500 mt-1 italic">Note : {r.admin_note}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(r.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={() => { setActiveId(r.id); setPin('') }}
                className="flex-shrink-0 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
              >
                Valider avec mon PIN
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal PIN */}
      {activeRequest && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4 md:items-center">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Confirmer le retrait</h2>
              <button onClick={() => { setActiveId(null); setPin('') }} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="bg-brand-50 rounded-xl p-4 mb-5">
              <p className="text-brand-900 font-bold text-xl">{formatFcfa(activeRequest.amount_fcfa)} FCFA</p>
              <p className="text-brand-700 text-sm">
                vers {activeRequest.operator === 'mtn_momo' ? 'MTN MoMo' : 'Moov Flooz'} · {activeRequest.phone}
              </p>
              {activeRequest.admin_note && (
                <p className="text-brand-600 text-xs mt-1 italic">Note : {activeRequest.admin_note}</p>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="label">Code PIN de transaction</label>
                <input
                  type="password"
                  value={pin}
                  onChange={e => setPin(e.target.value)}
                  placeholder="••••"
                  className="input"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="current-password"
                  autoFocus
                />
              </div>
              <button
                onClick={() => handleValidate(activeRequest.id)}
                disabled={loading || !pin.trim()}
                className="btn-primary w-full"
              >
                {loading ? 'Validation…' : 'Confirmer le retrait'}
              </button>
              <button
                onClick={() => { setActiveId(null); setPin('') }}
                className="w-full text-center text-sm text-gray-500 py-2"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
