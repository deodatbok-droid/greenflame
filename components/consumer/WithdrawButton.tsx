'use client'

import { useState } from 'react'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'
import PhoneInput from '@/components/ui/PhoneInput'

interface Props {
  balanceFcfa: number
  balanceGfp: number
  canWithdrawFcfa: boolean
  canWithdrawGfp: boolean
  minFcfa: number
  minGfp: number
}

type Mode = 'fcfa' | 'gfp'

export default function WithdrawButton({ balanceFcfa, balanceGfp, canWithdrawFcfa, canWithdrawGfp, minFcfa, minGfp }: Props) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>(canWithdrawFcfa ? 'fcfa' : 'gfp')
  const [phone, setPhone] = useState('')
  const [operator, setOperator] = useState<'mtn_momo' | 'moov_money'>('mtn_momo')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleWithdraw(e: React.FormEvent) {
    e.preventDefault()
    if (!phone.trim()) { toast.error('Entrez votre numero Mobile Money'); return }
    if (!pin.trim()) { toast.error('Entrez votre code PIN de transaction'); return }
    setLoading(true)

    const res = await fetch('/api/wallets/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, operator, phone, pin }),
    })

    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      toast.error(data.error ?? 'Erreur lors du retrait')
      return
    }

    toast.success('Demande de retrait soumise !')
    setOpen(false)
    setPhone('')
    setPin('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-3 rounded-2xl transition-colors text-sm"
      >
        Retirer vers Mobile Money
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end justify-center p-4 md:items-center">
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Retirer mes fonds</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <form onSubmit={handleWithdraw} className="space-y-4">
              {/* Mode toggle */}
              {canWithdrawFcfa && canWithdrawGfp && (
                <div className="flex gap-2">
                  {(['fcfa', 'gfp'] as Mode[]).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMode(m)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        mode === m
                          ? 'bg-brand-600 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {m === 'fcfa' ? `FCFA (${formatFcfa(balanceFcfa)})` : `GFP (${balanceGfp.toLocaleString()})`}
                    </button>
                  ))}
                </div>
              )}

              {/* Amount info */}
              <div className="bg-brand-50 rounded-xl p-3">
                <p className="text-xs text-brand-700">
                  {mode === 'fcfa'
                    ? `Retirer la totalité de votre solde FCFA : ${formatFcfa(balanceFcfa)} FCFA`
                    : `Convertir ${balanceGfp.toLocaleString()} GFP → ${formatFcfa(Math.floor(balanceGfp / 10))} FCFA (taux : 10 GFP = 1 FCFA)`
                  }
                </p>
              </div>

              {/* Operator */}
              <div>
                <label className="label">Operateur Mobile Money</label>
                <div className="flex gap-2">
                  {([
                    { value: 'mtn_momo',   label: 'MTN MoMo',    icon: '📱' },
                    { value: 'moov_money', label: 'Moov (Flooz)', icon: '💚' },
                  ] as const).map(op => (
                    <button
                      key={op.value}
                      type="button"
                      onClick={() => setOperator(op.value)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium border-2 transition-colors ${
                        operator === op.value
                          ? 'border-brand-500 bg-brand-50 text-brand-700'
                          : 'border-gray-200 text-gray-600'
                      }`}
                    >
                      <span>{op.icon}</span>
                      <span>{op.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="label">Votre numero {operator === 'mtn_momo' ? 'MTN' : 'Moov'}</label>
                <PhoneInput value={phone} onChange={setPhone} placeholder="97 00 00 00" />
              </div>

              {/* PIN de transaction */}
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
                />
                <p className="text-xs text-gray-400 mt-1">Code PIN à 4-6 chiffres configuré dans votre profil</p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary"
              >
                {loading ? 'Envoi…' : 'Demander le retrait'}
              </button>
              <p className="text-center text-xs text-gray-400">
                Traite sous 24h · Minimum {mode === 'fcfa' ? `${formatFcfa(minFcfa)} FCFA` : `${minGfp.toLocaleString()} GFP`}
              </p>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
