'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import toast from 'react-hot-toast'
import PhoneInput from '@/components/ui/PhoneInput'
import { formatFcfa } from '@/lib/utils/format'

const QUICK_AMOUNTS = [500, 1000, 2000, 5000, 10000, 20000]

export default function FloatTopupPage() {
  const router = useRouter()
  const [phone, setPhone]       = useState('')
  const [amount, setAmount]     = useState('')
  const [notes, setNotes]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<{ consumerName: string; amountFcfa: number; agentFloatAfter: number } | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    const amt = parseInt(amount, 10)
    if (!phone)        { toast.error('Numéro du consommateur requis'); return }
    if (!amt || amt < 100) { toast.error('Montant minimum : 100 FCFA'); return }

    setSubmitting(true)
    const res  = await fetch('/api/fieldagent/float/topup', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ phone, amount_fcfa: amt, notes: notes.trim() || undefined }),
    })
    const data = await res.json()
    setSubmitting(false)

    if (data.ok) {
      setDone(data)
    } else {
      toast.error(data.error ?? 'Erreur')
    }
  }

  if (done) return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="max-w-sm w-full bg-gray-800 rounded-2xl p-8 text-center space-y-5">
        <div className="w-16 h-16 bg-green-900/40 rounded-full flex items-center justify-center mx-auto">
          <span className="text-3xl">✅</span>
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Crédit effectué</h2>
          <p className="text-gray-400 text-sm mt-2">
            <span className="text-white font-semibold">{formatFcfa(done.amountFcfa)}</span> crédités au wallet de{' '}
            <span className="text-white font-semibold">{done.consumerName}</span>
          </p>
        </div>
        <div className="bg-gray-700 rounded-xl p-3">
          <p className="text-xs text-gray-400">Votre float restant</p>
          <p className="text-xl font-bold text-brand-400 mt-0.5">{formatFcfa(done.agentFloatAfter)}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setDone(null); setPhone(''); setAmount(''); setNotes('') }}
            className="flex-1 bg-gray-700 text-gray-300 font-semibold py-3 rounded-xl hover:bg-gray-600 transition-colors text-sm"
          >
            Nouveau crédit
          </button>
          <button
            onClick={() => router.push('/fieldagent/float')}
            className="flex-1 bg-brand-600 text-white font-semibold py-3 rounded-xl hover:bg-brand-700 transition-colors text-sm"
          >
            Mon float
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-xl mx-auto px-4 py-6 space-y-5">

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">Créditer un consommateur</h1>
            <p className="text-gray-400 text-sm mt-0.5">Convertir du cash en wallet GreenFlame</p>
          </div>
          <Link href="/fieldagent/float" className="text-sm text-gray-400 hover:text-white">← Float</Link>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div className="bg-gray-800 rounded-2xl p-5 space-y-4">
            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">
                Numéro du consommateur *
              </label>
              <PhoneInput value={phone} onChange={setPhone} placeholder="97 00 00 00" />
            </div>

            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">
                Montant (FCFA) *
              </label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Ex : 5000"
                min="100"
                className="input w-full"
              />
              {/* Montants rapides */}
              <div className="flex flex-wrap gap-2 mt-2">
                {QUICK_AMOUNTS.map(a => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setAmount(String(a))}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                      amount === String(a)
                        ? 'bg-brand-600 text-white'
                        : 'bg-gray-700 text-gray-400 hover:text-white'
                    }`}
                  >
                    {(a / 1000).toLocaleString('fr-FR')}k
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide block mb-1.5">
                Notes (optionnel)
              </label>
              <input
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Ex : Achat huile de palme chez Kossou"
                className="input w-full"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !phone || !amount}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-xl transition-colors disabled:opacity-60"
          >
            {submitting ? 'Traitement…' : `Créditer${amount ? ` ${parseInt(amount, 10).toLocaleString('fr-FR')} FCFA` : ''}`}
          </button>
        </form>
      </div>
    </div>
  )
}
