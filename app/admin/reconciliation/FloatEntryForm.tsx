'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export interface MerchantOption {
  id: string
  business_name: string
}

const ENTRY_TYPES = [
  { value: 'cash_collected',   label: '💵 Cash collecté',    desc: "Espèces reçues d'un marchand" },
  { value: 'mtn_momo',         label: '📱 MTN MoMo',         desc: 'Dépôt reçu sur compte MTN Business' },
  { value: 'moov_money',       label: '📱 Moov Money',        desc: 'Dépôt reçu sur compte Moov Business' },
  { value: 'celtiis',          label: '📱 Celtiis',           desc: 'Dépôt reçu sur compte Celtiis Business' },
  { value: 'adjustment_plus',  label: '➕ Ajustement +',     desc: 'Correction positive du float' },
  { value: 'adjustment_minus', label: '➖ Ajustement −',     desc: 'Correction négative du float' },
]

const TYPE_COLOR: Record<string, string> = {
  cash_collected:   'border-amber-500 bg-amber-900/20',
  mtn_momo:         'border-yellow-500 bg-yellow-900/20',
  moov_money:       'border-blue-500 bg-blue-900/20',
  celtiis:          'border-purple-500 bg-purple-900/20',
  adjustment_plus:  'border-green-500 bg-green-900/20',
  adjustment_minus: 'border-red-500 bg-red-900/20',
}

export default function FloatEntryForm({ merchants }: { merchants: MerchantOption[] }) {
  const router = useRouter()
  const [type, setType]           = useState('')
  const [amount, setAmount]       = useState('')
  const [merchantId, setMerchantId] = useState('')
  const [ref, setRef]             = useState('')
  const [notes, setNotes]         = useState('')
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState(false)

  const isCash = type === 'cash_collected'
  const isMomo = ['mtn_momo', 'moov_money', 'celtiis'].includes(type)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const parsed = parseInt(amount)
    if (!type || !parsed || parsed <= 0) return
    setLoading(true)
    setError(null)
    setSuccess(false)

    try {
      const res = await fetch('/api/admin/float/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry_type:   type,
          amount_fcfa:  parsed,
          operator_ref: ref        || null,
          merchant_id:  merchantId || null,
          notes:        notes      || null,
          entry_date:   date,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(true)
      setAmount('')
      setRef('')
      setNotes('')
      router.refresh()
      setTimeout(() => setSuccess(false), 4000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-gray-800 rounded-2xl p-5 border border-gray-700">
      <h2 className="text-white font-semibold mb-1">➕ Saisir un encaissement</h2>
      <p className="text-gray-500 text-xs mb-4">
        Pour les paiements Momo déjà automatisés sur la plateforme, utilisez ce formulaire
        uniquement pour réconcilier votre solde Business réel.
      </p>

      <form onSubmit={handleSubmit} className="space-y-5">

        {/* Sélection du type */}
        <div>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-2">Type de réception</p>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
            {ENTRY_TYPES.map(et => (
              <button
                key={et.value}
                type="button"
                onClick={() => { setType(et.value); if (!isCash) setMerchantId('') }}
                className={`text-left p-3 rounded-xl border-2 transition-all text-sm ${
                  type === et.value
                    ? TYPE_COLOR[et.value] + ' text-white'
                    : 'border-gray-600 bg-gray-700/30 text-gray-400 hover:border-gray-500 hover:text-gray-300'
                }`}
              >
                <span className="font-medium block leading-tight">{et.label}</span>
                <span className="text-[11px] opacity-60 leading-tight mt-0.5 block">{et.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {type && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Montant */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Montant (FCFA) *</label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                min="1"
                required
                placeholder="50 000"
                className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 border border-gray-600 focus:border-brand-500 focus:outline-none text-sm"
              />
            </div>

            {/* Date */}
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">Date de réception *</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                required
                className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 border border-gray-600 focus:border-brand-500 focus:outline-none text-sm"
              />
            </div>

            {/* Marchand — uniquement pour cash */}
            {isCash && (
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Marchand</label>
                <select
                  value={merchantId}
                  onChange={e => setMerchantId(e.target.value)}
                  className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 border border-gray-600 focus:border-brand-500 focus:outline-none text-sm"
                >
                  <option value="">— Sélectionner un marchand —</option>
                  {merchants.map(m => (
                    <option key={m.id} value={m.id}>{m.business_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Référence — pour les Momo */}
            {isMomo && (
              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">Référence transaction</label>
                <input
                  type="text"
                  value={ref}
                  onChange={e => setRef(e.target.value)}
                  placeholder="Ex : 1234567890"
                  className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 border border-gray-600 focus:border-brand-500 focus:outline-none text-sm font-mono"
                />
              </div>
            )}

            {/* Notes */}
            <div className={(!isCash && !isMomo) ? 'sm:col-span-2' : ''}>
              <label className="text-xs text-gray-400 mb-1.5 block">Notes (optionnel)</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Contexte, remarques…"
                className="w-full bg-gray-700 text-white rounded-xl px-4 py-2.5 border border-gray-600 focus:border-brand-500 focus:outline-none text-sm"
              />
            </div>
          </div>
        )}

        {error   && <p className="text-red-400 text-sm">{error}</p>}
        {success && <p className="text-green-400 text-sm font-medium">✓ Entrée enregistrée avec succès</p>}

        {type && (
          <button
            type="submit"
            disabled={loading || !amount || parseInt(amount) <= 0}
            className="bg-brand-600 hover:bg-brand-500 disabled:opacity-40 text-white font-semibold text-sm px-6 py-2.5 rounded-xl transition-colors"
          >
            {loading ? 'Enregistrement…' : "Enregistrer l'encaissement"}
          </button>
        )}
      </form>
    </div>
  )
}
