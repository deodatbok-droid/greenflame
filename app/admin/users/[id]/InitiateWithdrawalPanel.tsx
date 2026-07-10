'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import PhoneInput from '@/components/ui/PhoneInput'

interface Props {
  targetUserId: string
  balanceFcfa: number
}

export default function InitiateWithdrawalPanel({ targetUserId, balanceFcfa }: Props) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({
    amountFcfa: '',
    operator: 'mtn_momo' as 'mtn_momo' | 'moov_money',
    phone: '',
    note: '',
  })
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseInt(form.amountFcfa, 10)
    if (!amount || amount <= 0) { toast.error('Montant invalide'); return }
    if (amount > balanceFcfa) { toast.error(`Solde insuffisant (${balanceFcfa.toLocaleString('fr-FR')} FCFA disponible)`); return }
    if (!form.phone.trim()) { toast.error('Numéro de téléphone requis'); return }

    setLoading(true)
    const res = await fetch('/api/admin/withdrawals/initiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetUserId,
        amountFcfa: amount,
        operator: form.operator,
        phone: form.phone.trim(),
        note: form.note.trim() || null,
      }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      toast.error(data.error ?? 'Erreur lors de l\'initiation du retrait')
      return
    }

    toast.success(`Demande envoyée à l'utilisateur pour validation (ID: ${data.requestId?.slice(0, 8)}…)`)
    setOpen(false)
    setForm({ amountFcfa: '', operator: 'mtn_momo', phone: '', note: '' })
  }

  return (
    <div className="bg-gray-800 rounded-xl p-5 border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Retrait admin</h2>
          <p className="text-xs text-gray-500 mt-0.5">L&apos;utilisateur devra valider avec son PIN</p>
        </div>
        <button
          onClick={() => setOpen(v => !v)}
          className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors"
        >
          {open ? 'Annuler' : 'Initier le retrait'}
        </button>
      </div>

      {open && (
        <form onSubmit={handleSubmit} className="space-y-3 mt-4 border-t border-gray-700 pt-4">
          {/* Montant */}
          <div>
            <label className="text-gray-300 text-xs block mb-1">Montant (FCFA)</label>
            <input
              type="number"
              value={form.amountFcfa}
              onChange={e => setForm(f => ({ ...f, amountFcfa: e.target.value }))}
              placeholder={`Max : ${balanceFcfa.toLocaleString('fr-FR')}`}
              min={1}
              max={balanceFcfa}
              className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-xl border border-gray-600 focus:border-green-500 focus:outline-none text-sm"
              required
            />
          </div>

          {/* Opérateur */}
          <div>
            <label className="text-gray-300 text-xs block mb-1">Opérateur Mobile Money</label>
            <div className="flex gap-2">
              {([
                { value: 'mtn_momo',   label: 'MTN MoMo' },
                { value: 'moov_money', label: 'Moov Flooz' },
              ] as const).map(op => (
                <button
                  key={op.value}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, operator: op.value }))}
                  className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 transition-colors ${
                    form.operator === op.value
                      ? 'border-green-500 bg-green-900/30 text-green-300'
                      : 'border-gray-600 text-gray-400'
                  }`}
                >
                  {op.label}
                </button>
              ))}
            </div>
          </div>

          {/* Numéro de téléphone */}
          <div>
            <label className="text-gray-300 text-xs block mb-1">Numéro de téléphone</label>
            <PhoneInput
              value={form.phone}
              onChange={v => setForm(f => ({ ...f, phone: v }))}
              placeholder="97 00 00 00"
            />
          </div>

          {/* Note admin */}
          <div>
            <label className="text-gray-300 text-xs block mb-1">Note (optionnel)</label>
            <input
              type="text"
              value={form.note}
              onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
              placeholder="Raison du retrait admin..."
              className="w-full bg-gray-700 text-white px-4 py-2.5 rounded-xl border border-gray-600 focus:border-green-500 focus:outline-none text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white py-3 rounded-xl font-semibold text-sm transition-colors"
          >
            {loading ? 'Initiation en cours…' : 'Initier le retrait'}
          </button>
          <p className="text-xs text-gray-500 text-center">
            L&apos;utilisateur recevra une notification et devra confirmer avec son PIN de transaction.
          </p>
        </form>
      )}
    </div>
  )
}
