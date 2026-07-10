'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'
import PhoneInput from '@/components/ui/PhoneInput'
import { useLocale } from '@/components/providers/LocaleProvider'

type Mode = 'deposit' | 'withdraw'
type Step = 'form' | 'confirm' | 'done'

interface Preview {
  amount: number
  agentFee: number
  totalUserDebit: number
  merchantCommission: number
  clientName: string
  clientPhone: string
}

export default function AgentPage() {
  const router   = useRouter()
  const supabase = createClient()
  const { t }   = useLocale()

  const [merchant, setMerchant] = useState<{ business_name: string; agent_service_active: boolean; balance: number } | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [mode,     setMode]     = useState<Mode>('deposit')
  const [step,     setStep]     = useState<Step>('form')
  const [phone,    setPhone]    = useState('')
  const [amount,   setAmount]   = useState('')
  const [preview,  setPreview]  = useState<Preview | null>(null)
  const [busy,     setBusy]     = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: m } = await supabase
        .from('merchants')
        .select('id, business_name, agent_service_active, is_active')
        .eq('user_id', user.id)
        .single()

      if (!m?.is_active) { router.push('/merchant/dashboard'); return }

      const { data: mw } = await supabase
        .from('merchant_wallets')
        .select('balance_fcfa')
        .eq('merchant_id', m.id)
        .single()

      setMerchant({
        business_name:        m.business_name,
        agent_service_active: m.agent_service_active ?? false,
        balance:              mw?.balance_fcfa ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [])

  const amountNum = parseInt(amount.replace(/\D/g, '')) || 0
  const agentFee  = mode === 'withdraw' ? Math.round(amountNum * 0.01) : 0

  async function handleSubmit() {
    if (!phone.trim()) { toast.error(t('merchant.agent.phoneRequired')); return }
    if (amountNum < 500) { toast.error(t('merchant.agent.minAmount')); return }
    if (amountNum > 300_000) { toast.error(t('merchant.agent.maxAmount')); return }
    if (mode === 'deposit' && amountNum > (merchant?.balance ?? 0)) {
      toast.error(t('merchant.agent.insufficientBalance'))
      return
    }

    setBusy(true)
    const endpoint = mode === 'deposit' ? '/api/agent/deposit' : '/api/agent/withdraw'
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userPhone: phone, amount: amountNum }),
    })
    const data = await res.json()
    setBusy(false)

    if (!res.ok) { toast.error(data.error ?? t('common.error')); return }

    setPreview({
      amount:              amountNum,
      agentFee:            data.agentFee ?? 0,
      totalUserDebit:      data.totalUserDebit ?? amountNum,
      merchantCommission:  data.merchantCommission ?? 0,
      clientName:          data.clientName,
      clientPhone:         data.clientPhone,
    })

    if (merchant) {
      setMerchant(prev => prev ? { ...prev, balance: data.agentNewBalance } : null)
    }

    setStep('done')
    toast.success(data.message)
  }

  function reset() {
    setStep('form')
    setPhone('')
    setAmount('')
    setPreview(null)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!merchant?.agent_service_active) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-5 mt-12">
        <div className="text-6xl">🏦</div>
        <h1 className="text-2xl font-bold text-gray-900">{t('merchant.agent.title')}</h1>
        <p className="text-gray-500">{t('merchant.agent.notActiveDesc')}</p>
        <div className="bg-brand-50 rounded-2xl p-4 text-left space-y-2">
          <p className="text-sm font-semibold text-brand-700">{t('merchant.agent.unlock')}</p>
          <ul className="text-sm text-brand-600 space-y-1">
            <li>{t('merchant.agent.perk1')}</li>
            <li>{t('merchant.agent.perk2')}</li>
            <li>{t('merchant.agent.perk3')}</li>
            <li>{t('merchant.agent.perk4')}</li>
          </ul>
        </div>
        <Link href="/merchant/dashboard" className="btn-primary block">
          {t('merchant.agent.backToDashboard')}
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-5 pb-28">

      {/* En-tête */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">{t('merchant.agent.title')}</h1>
          <p className="text-sm text-gray-500">{merchant.business_name}</p>
        </div>
        <Link href="/merchant/dashboard" className="text-brand-600 text-sm">
          {t('merchant.agent.dashboard')}
        </Link>
      </div>

      {/* Solde agent */}
      <div className="bg-gradient-to-r from-brand-700 to-brand-600 rounded-2xl p-4 text-white">
        <p className="text-brand-200 text-xs font-medium mb-1">{t('merchant.agent.agentBalance')}</p>
        <p className="text-3xl font-bold">{merchant.balance.toLocaleString()} FCFA</p>
        <p className="text-brand-200 text-xs mt-1">{t('merchant.agent.agentBalanceHint')}</p>
      </div>

      {step === 'form' && (
        <>
          {/* Sélecteur de mode */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setMode('deposit')}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                mode === 'deposit'
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 bg-white hover:border-brand-200'
              }`}
            >
              <span className="text-2xl">💵</span>
              <p className={`text-sm font-semibold ${mode === 'deposit' ? 'text-brand-700' : 'text-gray-600'}`}>
                {t('merchant.agent.depositTitle')}
              </p>
              <p className="text-xs text-gray-400 text-center">{t('merchant.agent.depositDesc')}</p>
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                {t('merchant.agent.depositFree')}
              </span>
            </button>

            <button
              onClick={() => setMode('withdraw')}
              className={`flex flex-col items-center gap-2 p-4 rounded-2xl border-2 transition-all ${
                mode === 'withdraw'
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-gray-200 bg-white hover:border-brand-200'
              }`}
            >
              <span className="text-2xl">💸</span>
              <p className={`text-sm font-semibold ${mode === 'withdraw' ? 'text-brand-700' : 'text-gray-600'}`}>
                {t('merchant.agent.withdrawTitle')}
              </p>
              <p className="text-xs text-gray-400 text-center">{t('merchant.agent.withdrawDesc')}</p>
              <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
                {t('merchant.agent.withdrawCommission')}
              </span>
            </button>
          </div>

          {/* Formulaire */}
          <div className="card space-y-4">
            <div>
              <label className="label">{t('merchant.agent.clientPhone')}</label>
              <PhoneInput value={phone} onChange={setPhone} placeholder="97 00 00 00" />
            </div>

            <div>
              <label className="label">{t('merchant.agent.amount')}</label>
              <input
                type="text"
                value={amount}
                onChange={e => setAmount(e.target.value.replace(/\D/g, ''))}
                placeholder="0"
                className="input text-right text-2xl font-bold"
                inputMode="numeric"
              />
            </div>

            {/* Récapitulatif */}
            {amountNum >= 500 && (
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                {mode === 'withdraw' ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('merchant.agent.withdrawFee')}</span>
                      <span className="font-semibold text-gray-800">{agentFee.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('merchant.agent.totalDebit')}</span>
                      <span className="font-semibold text-gray-800">{(amountNum + agentFee).toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                      <span className="text-gray-500">{t('merchant.agent.yourCommission')}</span>
                      <span className="font-semibold text-brand-600">+{Math.round(amountNum * 0.005).toLocaleString()} FCFA</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('merchant.agent.creditedClient')}</span>
                      <span className="font-semibold text-brand-600">{amountNum.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{t('merchant.agent.debitedBalance')}</span>
                      <span className="font-semibold text-gray-800">{amountNum.toLocaleString()} FCFA</span>
                    </div>
                    <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                      <span className="text-gray-500">{t('merchant.agent.withdrawFee').replace('(1%)', '').trim()}</span>
                      <span className="font-semibold text-green-600">{t('merchant.agent.freeLabel')}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={busy || amountNum < 500}
              className="btn-primary disabled:opacity-40"
            >
              {busy
                ? t('merchant.agent.processing')
                : mode === 'deposit'
                ? t('merchant.agent.confirmDeposit')
                : t('merchant.agent.confirmWithdraw')}
            </button>
          </div>
        </>
      )}

      {/* Écran de confirmation finale */}
      {step === 'done' && preview && (
        <div className="card text-center space-y-5">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-3xl">✓</span>
          </div>

          <div>
            <p className="text-xl font-bold text-gray-900">{t('merchant.agent.successTitle')}</p>
            <p className="text-gray-500 text-sm mt-1">
              {mode === 'deposit' ? t('merchant.agent.depositDone') : t('merchant.agent.withdrawDone')}
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-4 text-left space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('merchant.agent.clientLabel')}</span>
              <span className="font-semibold text-gray-900">{preview.clientName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('merchant.agent.phoneLabel')}</span>
              <span className="text-gray-700">{preview.clientPhone}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('merchant.agent.amountLabel')}</span>
              <span className="font-bold text-gray-900">{preview.amount.toLocaleString()} FCFA</span>
            </div>
            {mode === 'withdraw' && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">{t('merchant.agent.feesPaid')}</span>
                  <span className="text-gray-700">{preview.agentFee.toLocaleString()} FCFA</span>
                </div>
                <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                  <span className="text-gray-500">{t('merchant.agent.yourCommissionLabel')}</span>
                  <span className="font-semibold text-brand-600">+{preview.merchantCommission.toLocaleString()} FCFA</span>
                </div>
              </>
            )}
            <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
              <span className="text-gray-500">{t('merchant.agent.agentBalanceLabel')}</span>
              <span className="font-bold text-gray-900">{merchant?.balance.toLocaleString()} FCFA</span>
            </div>
          </div>

          {mode === 'withdraw' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-amber-800 text-sm font-semibold">
                {t('merchant.agent.handover')
                  .replace('{amount}', preview.amount.toLocaleString())
                  .replace('{name}', preview.clientName)}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button onClick={reset} className="btn-primary">
              {t('merchant.agent.newOperation')}
            </button>
            <Link href="/merchant/dashboard" className="btn-secondary text-center">
              {t('merchant.agent.dashboard')}
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
