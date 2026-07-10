'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { formatFcfa } from '@/lib/utils/format'
import PhoneInput from '@/components/ui/PhoneInput'
import { speak } from '@/lib/hooks/useVoice'

type Step = 'form' | 'proxy_pin' | 'success'

type ClientInfo = {
  found: boolean
  name?: string
  balance_fcfa?: number
}

export default function CashinPage() {
  const router = useRouter()
  const supabase = createClient()

  const [agentActive,   setAgentActive]   = useState<boolean | null>(null)
  const [merchantName,  setMerchantName]  = useState('')
  const [walletBalance, setWalletBalance] = useState<number | null>(null)

  const [clientPhone,  setClientPhone]  = useState('')
  const [clientInfo,   setClientInfo]   = useState<ClientInfo | null>(null)
  const [lookingUp,    setLookingUp]    = useState(false)
  const [amount,       setAmount]       = useState('')
  const [clientPin,    setClientPin]    = useState('')
  const [processing,   setProcessing]   = useState(false)
  const [step,         setStep]         = useState<Step>('form')
  const [resultBalance, setResultBalance] = useState(0)

  const amountNum = parseInt(amount.replace(/\D/g, '')) || 0

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: m } = await supabase
        .from('merchants')
        .select('business_name, agent_service_active, is_active')
        .eq('user_id', user.id)
        .single()

      if (!m?.is_active) { router.push('/merchant/dashboard'); return }
      setAgentActive(m.agent_service_active ?? false)
      setMerchantName(m.business_name)

      const { data: w } = await supabase
        .from('wallets')
        .select('balance_fcfa')
        .eq('user_id', user.id)
        .single()
      setWalletBalance(w?.balance_fcfa ?? 0)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lookupClient = useCallback(async (phone: string) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 8) { setClientInfo(null); return }
    setLookingUp(true)
    try {
      // /api/referral accepte un numéro de téléphone depuis la session précédente
      const r = await fetch(`/api/referral?code=${encodeURIComponent(digits)}`)
      const d = await r.json()
      setClientInfo(d.valid ? { found: true, name: d.name } : { found: false })
    } finally {
      setLookingUp(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => lookupClient(clientPhone), 600)
    return () => clearTimeout(timer)
  }, [clientPhone, lookupClient])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!clientInfo?.found || amountNum < 100) return
    setStep('proxy_pin')
  }

  async function handleConfirm() {
    if (clientPin.length < 4) return
    setProcessing(true)

    const phoneNorm = clientPhone.startsWith('+') ? clientPhone : '+' + clientPhone.replace(/\D/g, '')
    const res = await fetch('/api/wallets/agent-cashin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientPhone: phoneNorm, amountFcfa: amountNum, clientPin }),
    })
    const data = await res.json()
    setProcessing(false)
    setClientPin('')

    if (!res.ok) {
      toast.error(data.error ?? 'Erreur lors du cash-in')
      return
    }

    setResultBalance(data.clientNewBalance)
    setWalletBalance(data.merchantNewBalance)
    setStep('success')
    toast.success('✅ Wallet rechargé !')
    speak(`Recharge effectuée. ${clientInfo?.name ?? 'Le client'} dispose maintenant de ${data.clientNewBalance} francs sur son wallet.`)
  }

  if (agentActive === null) {
    return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full" /></div>
  }

  if (!agentActive) {
    return (
      <div className="max-w-sm mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-4xl">🔒</p>
        <h1 className="text-xl font-bold text-gray-900">Service Agent non activé</h1>
        <p className="text-sm text-gray-500">Activez le service Agent dans les paramètres de votre boutique pour offrir des recharges wallet à vos clients.</p>
        <button onClick={() => router.push('/merchant/agent')} className="btn-primary">
          Activer le service Agent
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-6 space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-gray-600 hover:text-gray-800 text-xl">‹</button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Recharge wallet client</h1>
          <p className="text-xs text-gray-500">Service Agent — cash contre wallet GreenFlame</p>
        </div>
      </div>

      {/* Solde float marchand */}
      {walletBalance !== null && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-amber-600 font-semibold">Votre float disponible</p>
            <p className="text-lg font-black text-amber-900">{formatFcfa(walletBalance)}</p>
          </div>
          <span className="text-2xl">💳</span>
        </div>
      )}

      {/* ── STEP : FORMULAIRE ── */}
      {step === 'form' && (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="label mb-1.5 block">Numéro du client</label>
            <PhoneInput
              value={clientPhone}
              onChange={setClientPhone}
              placeholder="97 00 00 00"
            />
            {lookingUp && <p className="text-xs text-gray-400 mt-1">Recherche…</p>}
            {clientInfo && !lookingUp && (
              <div className={`mt-2 px-3 py-2 rounded-lg text-sm font-medium ${
                clientInfo.found ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
              }`}>
                {clientInfo.found
                  ? `✅ ${clientInfo.name}`
                  : '❌ Aucun compte GreenFlame trouvé'}
              </div>
            )}
          </div>

          <div>
            <label className="label mb-1.5 block">Montant à recharger (FCFA)</label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
              placeholder="Ex : 5000"
              className="input text-center text-2xl font-bold tracking-wide"
            />
            {amountNum > 0 && walletBalance !== null && amountNum > walletBalance && (
              <p className="text-xs text-red-500 mt-1">⚠️ Montant supérieur à votre float disponible</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-xs text-blue-700 space-y-1">
            <p className="font-semibold">Comment ça fonctionne :</p>
            <p>1. Le client vous remet <strong>les espèces</strong></p>
            <p>2. Votre wallet GreenFlame est <strong>débité</strong></p>
            <p>3. Le client reçoit les FCFA sur <strong>son wallet</strong></p>
            <p>4. Son PIN valide son consentement</p>
          </div>

          <button
            type="submit"
            disabled={!clientInfo?.found || amountNum < 100 || (walletBalance !== null && amountNum > walletBalance)}
            className="btn-primary"
          >
            Continuer — {amountNum > 0 ? formatFcfa(amountNum) : '—'}
          </button>
        </form>
      )}

      {/* ── STEP : PROXY PIN (client consent) ── */}
      {step === 'proxy_pin' && (
        <div className="space-y-5">
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-center">
            <p className="text-2xl mb-1">📱</p>
            <p className="font-bold text-amber-800">Passez le téléphone à {clientInfo?.name ?? 'votre client'}</p>
            <p className="text-xs text-amber-600 mt-0.5">Il confirme avec son PIN la remise des espèces</p>
          </div>

          <div className="bg-brand-50 border-2 border-brand-200 rounded-2xl p-5 text-center space-y-1">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">Recharge wallet chez</p>
            <p className="text-lg font-bold text-gray-900">{merchantName}</p>
            <p className="text-4xl font-black text-gray-900 mt-2">{formatFcfa(amountNum)}</p>
            <p className="text-xs text-gray-500 mt-1">Vous remettez les espèces au marchand</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
              🔒 Entrez votre code PIN pour confirmer
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={clientPin}
              onChange={e => setClientPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              autoFocus
              className="w-full text-center text-3xl tracking-[0.5em] font-bold border-2 border-gray-300 focus:border-brand-500 rounded-2xl px-4 py-4 bg-white outline-none transition-colors"
            />
          </div>

          <button
            onClick={handleConfirm}
            disabled={processing || clientPin.length < 4}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-base transition-colors active:scale-95"
          >
            {processing ? 'Traitement…' : `Recharger — ${formatFcfa(amountNum)}`}
          </button>

          <button
            onClick={() => { setStep('form'); setClientPin('') }}
            disabled={processing}
            className="btn-secondary"
          >
            ← Annuler
          </button>
        </div>
      )}

      {/* ── STEP : SUCCÈS ── */}
      {step === 'success' && (
        <div className="text-center space-y-5 py-4">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto text-4xl">
            ✅
          </div>
          <div>
            <h2 className="text-xl font-black text-gray-900">Recharge effectuée !</h2>
            <p className="text-sm text-gray-500 mt-1">{clientInfo?.name} a reçu {formatFcfa(amountNum)}</p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Nouveau solde client</span>
              <span className="font-black text-green-700">{formatFcfa(resultBalance)}</span>
            </div>
            <div className="flex items-center justify-between text-sm border-t border-green-200 pt-2">
              <span className="text-gray-600">Votre float restant</span>
              <span className="font-bold text-amber-700">{formatFcfa(walletBalance ?? 0)}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setStep('form'); setClientPhone(''); setClientInfo(null); setAmount('') }}
              className="btn-secondary flex-1"
            >
              Nouvelle recharge
            </button>
            <button onClick={() => router.push('/merchant/dashboard')} className="btn-primary flex-1">
              Tableau de bord
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
