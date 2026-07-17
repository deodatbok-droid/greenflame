'use client'

import { Suspense, useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { formatFcfa, formatCashback } from '@/lib/utils/format'
import { GOVERNANCE } from '@/lib/commission-engine/constants'
import VoiceAmountInput from '@/components/VoiceAmountInput'
import { speak } from '@/lib/hooks/useVoice'
import Logo from '@/components/Logo'
import PhoneInput from '@/components/ui/PhoneInput'
import { useLocale } from '@/components/providers/LocaleProvider'
import { useTrack } from '@/lib/hooks/useTrack'

type Step = 'method' | 'amount' | 'merchant' | 'pin' | 'confirm' | 'processing' | 'success'
type PayMethod = 'mtn_momo' | 'moov_money' | 'celtiis' | 'wallet_gf' | 'cash_confirmed'

interface MerchantInfo {
  id: string
  business_name: string
  commission_rate: number
}

interface ProductInfo {
  id: string
  name: string
  price_fcfa: number | null
  commission_rate: number | null  // override du taux marchand si défini
}

// Codes marchands USSD — base sans le montant ni le #
// Format final : {base}*{montant}# → ex: *880*41*739394*5000#
const USSD_CODES: Partial<Record<PayMethod, string>> = {
  mtn_momo:   '*880*41*739394',  // ✅ Code marchand MTN GreenFlame
  moov_money: '',                // 🔜 À renseigner (code Moov)
  celtiis:    '',                // 🔜 À renseigner (code Celtiis)
}

function ussdTelLink(method: PayMethod, amount: number): string | null {
  const base = USSD_CODES[method]
  if (!base) return null
  return `tel:${base}*${amount}%23`
}

function ussdDisplayCode(method: PayMethod, amount: number): string | null {
  const base = USSD_CODES[method]
  if (!base) return null
  return `${base}*${amount}#`
}

const IS_MOBILE_MONEY: PayMethod[] = ['mtn_momo', 'moov_money', 'celtiis']

function PayForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const { t } = useLocale()

  const MOBILE_OPERATORS: { value: PayMethod; label: string; icon: string }[] = [
    { value: 'mtn_momo',   label: t('pay.mtn'),     icon: '🟡' },
    { value: 'moov_money', label: t('pay.moov'),    icon: '💚' },
    { value: 'celtiis',    label: t('pay.celtiis'), icon: '🔵' },
  ]

  const STEP_LABELS: Partial<Record<Step, string>> = {
    method:   t('pay.chooseMethod'),
    amount:   t('pay.amountTitle'),
    merchant: t('pay.merchantTitle'),
    pin:      t('pay.pinTitle'),
    confirm:  t('pay.confirmTitle'),
  }

  const merchantIdFromUrl = searchParams.get('merchant_id')
  const amountFromUrl = searchParams.get('amount') ?? ''
  const productIdFromUrl = searchParams.get('product_id') ?? undefined

  const track = useTrack()

  const [step, setStep] = useState<Step>('method')
  const [paymentMethod, setPaymentMethod] = useState<PayMethod>('wallet_gf')
  const [payerMsisdn, setPayerMsisdn] = useState('')
  const [merchant, setMerchant] = useState<MerchantInfo | null>(null)
  const [amount, setAmount] = useState(amountFromUrl)
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [walletBalance, setWalletBalance] = useState<number | null>(null)
  const [scannerReady, setScannerReady] = useState(false)
  const [manualId, setManualId] = useState('')
  const [searchResults, setSearchResults] = useState<MerchantInfo[]>([])
  const [searching, setSearching] = useState(false)
  const [product, setProduct] = useState<ProductInfo | null>(null)
  const [resultTx, setResultTx] = useState<{ cashback: number; isGfp: boolean } | null>(null)

  const scannerRef = useRef<{ stop: () => Promise<void> } | null>(null)
  const scannerActiveRef = useRef(false)

  type PayCategory = 'wallet_gf' | 'mobile_money' | 'cash_confirmed'
  const isMobileMoney = IS_MOBILE_MONEY.includes(paymentMethod)
  const payCategory: PayCategory = isMobileMoney ? 'mobile_money' : paymentMethod as PayCategory
  const PAYMENT_CATEGORIES: { value: PayCategory; label: string; icon: string; desc: string }[] = [
    { value: 'wallet_gf',      label: t('pay.wallet'),   icon: '🔥', desc: t('pay.wallet')  },
    { value: 'mobile_money',   label: 'Paiement Mobile', icon: '📱', desc: 'MTN MoMo · Moov Money · Celtiis' },
    { value: 'cash_confirmed', label: t('pay.cash'),     icon: '💵', desc: t('pay.cash')    },
  ]

  const amountNum = parseInt(amount.replace(/\D/g, '')) || 0
  // Taux effectif : produit > marchand > défaut (10%)
  const effectiveRate = product?.commission_rate ?? merchant?.commission_rate ?? GOVERNANCE.DEFAULT_COMMISSION_RATE
  const commissionTotal = Math.floor(amountNum * effectiveRate)
  const cashback = Math.floor(commissionTotal * GOVERNANCE.CASHBACK_SHARE)
  const cashbackIsGfp = cashback < GOVERNANCE.GFP_CASH_MIN_THRESHOLD
  // Montants exacts pour l'affichage (sans arrondi)
  const exactCashback = amountNum * effectiveRate * GOVERNANCE.CASHBACK_SHARE
  const cashbackDisplay = formatCashback(exactCashback)
  const ALL_OPTIONS: { value: PayMethod; label: string; icon: string; needsPhone: boolean }[] = [
    { value: 'wallet_gf',      label: t('pay.wallet'),   icon: '🔥', needsPhone: false },
    { value: 'mtn_momo',       label: t('pay.mtn'),      icon: '🟡', needsPhone: true  },
    { value: 'moov_money',     label: t('pay.moov'),     icon: '💚', needsPhone: true  },
    { value: 'celtiis',        label: t('pay.celtiis'),  icon: '🔵', needsPhone: true  },
    { value: 'cash_confirmed', label: t('pay.cash'),     icon: '💵', needsPhone: false },
  ]
  const selectedOption = ALL_OPTIONS.find(o => o.value === paymentMethod)!
  const insufficient = paymentMethod === 'wallet_gf' && walletBalance !== null && walletBalance < amountNum

  // Tracking page vue
  useEffect(() => { track('page_viewed', { page: 'pay' }) }, []) // eslint-disable-line

  // Init: load wallet balance + pre-load merchant from URL
  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: w } = await supabase.from('wallets').select('balance_fcfa').eq('user_id', user.id).single()
      if (w) setWalletBalance(w.balance_fcfa)

      // Pré-remplir le numéro avec celui du compte (modifiable si autre téléphone)
      const { data: profile } = await supabase.from('users').select('phone').eq('id', user.id).single()
      if (profile?.phone) setPayerMsisdn(profile.phone)

      if (merchantIdFromUrl) {
        const { data: m } = await supabase
          .from('merchants')
          .select('id, business_name, commission_rate, is_active')
          .eq('id', merchantIdFromUrl)
          .single()
        if (m?.is_active) setMerchant(m)
      }

      // Charger le produit si fourni dans l'URL (son taux prime sur celui du marchand)
      if (productIdFromUrl) {
        const { data: p } = await supabase
          .from('products')
          .select('id, name, price_fcfa, commission_rate')
          .eq('id', productIdFromUrl)
          .single()
        if (p) setProduct(p as ProductInfo)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // QR scanner (only on 'merchant' step)
  useEffect(() => {
    if (step !== 'merchant') return

    scannerActiveRef.current = true

    const startScanner = async () => {
      try {
        const { Html5Qrcode } = await import('html5-qrcode')
        const qr = new Html5Qrcode('qr-reader')
        scannerRef.current = qr as unknown as { stop: () => Promise<void> }

        await qr.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: 250 },
          async (decoded) => {
            if (!scannerActiveRef.current) return
            try {
              const url = new URL(decoded.replace('greenflame://', 'https://greenflame.app/'))
              const mid = url.searchParams.get('merchant_id')
              if (mid) {
                await stopScanner()
                track('merchant_qr_scanned', { merchantId: mid })
                await loadMerchant(mid)
              }
            } catch { /* ignore parse errors */ }
          },
          () => {}
        )
        if (scannerActiveRef.current) setScannerReady(true)
      } catch {
        toast.error(t('pay.cameraAccessDenied'))
      }
    }

    startScanner()

    return () => {
      scannerActiveRef.current = false
      stopScanner()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  async function stopScanner() {
    setScannerReady(false)
    if (scannerRef.current) {
      try { await scannerRef.current.stop() } catch { /* already stopped */ }
      scannerRef.current = null
    }
  }

  async function searchMerchants(query: string) {
    if (query.trim().length < 2) { setSearchResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/merchants/lookup?q=${encodeURIComponent(query.trim())}`)
      const data = await res.json()
      const results = (data.results ?? []) as MerchantInfo[]
      setSearchResults(results)
      if (results.length > 0) track('merchant_searched', { query: query.trim(), resultCount: results.length })
    } catch {
      setSearchResults([])
    }
    setSearching(false)
  }

  async function loadMerchant(merchantId: string) {
    const { data, error } = await supabase
      .from('merchants')
      .select('id, business_name, commission_rate, is_active')
      .eq('id', merchantId)
      .single()

    if (error || !data || !data.is_active) {
      toast.error(t('pay.merchantNotFound'))
      return
    }
    setMerchant(data)
    setStep(paymentMethod === 'wallet_gf' ? 'pin' : 'confirm')
  }

  async function handleBack() {
    if (step === 'method') {
      await stopScanner()
      router.back()
    } else if (step === 'amount') {
      setStep('method')
    } else if (step === 'merchant') {
      await stopScanner()
      setStep('amount')
    } else if (step === 'pin') {
      setStep(merchantIdFromUrl ? 'amount' : 'merchant')
    } else if (step === 'confirm') {
      if (paymentMethod === 'wallet_gf') setStep('pin')
      else if (!merchantIdFromUrl) setStep('merchant')
      else setStep('amount')
    }
  }

  async function handlePay() {
    if (!merchant || amountNum <= 0) return
    setLoading(true)
    setStep('processing')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { toast.error(t('pay.notConnected')); setLoading(false); return }

    try {
      const idempotencyKey = `${user.id}-${merchant.id}-${Date.now()}`

      // cash_confirmed + mobile money USSD = transaction PENDING (confirmation manuelle)
      // wallet_gf = transaction immédiate via Edge Function
      const isPendingMethod = paymentMethod === 'cash_confirmed' || IS_MOBILE_MONEY.includes(paymentMethod)
      const apiUrl = isPendingMethod ? '/api/transactions/pending' : '/api/transactions'

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId:     merchant.id,
          amountFcfa:     amountNum,
          paymentMethod,
          payerMsisdn:    payerMsisdn || undefined,
          idempotencyKey,
          transactionPin: paymentMethod === 'wallet_gf' ? pin : undefined,
          productId:      productIdFromUrl,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error ?? t('pay.paymentFailed'))
        setStep('confirm')
        setLoading(false)
        return
      }

      if (paymentMethod === 'wallet_gf') {
        setWalletBalance(prev => prev !== null ? prev - amountNum : null)
      }
      // For cash_confirmed: cashback will be credited once merchant confirms
      const finalCashback = paymentMethod === 'cash_confirmed' ? cashback : (data.cashback?.amount ?? cashback)
      const finalIsGfp    = paymentMethod === 'cash_confirmed' ? cashbackIsGfp : (data.cashback?.isGfp ?? cashbackIsGfp)
      setResultTx({ cashback: finalCashback, isGfp: finalIsGfp })
      setStep('success')
      // Retour vocal sur le succès
      if (paymentMethod === 'cash_confirmed' || IS_MOBILE_MONEY.includes(paymentMethod)) {
        speak(`Transaction enregistrée. En attente de vérification.`)
      } else {
        speak(`Paiement réussi ! Vous avez gagné ${finalCashback} ${finalIsGfp ? 'points GreenFlame' : 'francs'} de cashback.`)
      }
    } catch {
      toast.error(t('pay.connectionError'))
      setStep('confirm')
    }
    setLoading(false)
  }

  function reset() {
    setStep('method')
    setAmount(amountFromUrl)
    setPayerMsisdn('')
    setPin('')
    if (!merchantIdFromUrl) setMerchant(null)
    setResultTx(null)
    setManualId('')
  }

  // Step progress bar steps
  const progressSteps: Step[] = [
    'method',
    'amount',
    ...(merchantIdFromUrl ? [] : ['merchant' as Step]),
    ...(paymentMethod === 'wallet_gf' ? ['pin' as Step] : []),
    'confirm',
  ]
  const progressIdx = progressSteps.indexOf(step)

  return (
    <div className="max-w-4xl mx-auto min-h-screen bg-gray-50">

      {/* ── ÉTATS PLEIN ÉCRAN : processing + success ── */}
      {step === 'processing' && (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
          <div className="relative">
            <div className="w-24 h-24 rounded-full bg-brand-100 flex items-center justify-center">
              <Logo size={48} className="w-12 h-12" />
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-brand-400 border-t-transparent animate-spin" />
          </div>
          <div className="text-center">
            <p className="font-bold text-xl text-gray-900">{t('pay.processing')}</p>
            <p className="text-gray-400 text-sm mt-1">
              {merchant ? `${t('pay.payingAt')} ${merchant.business_name}` : ''}
            </p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 px-6 py-4 text-center">
            <p className="text-3xl font-black text-gray-900">{formatFcfa(amountNum)}</p>
            <p className="text-gray-400 text-sm mt-0.5">FCFA</p>
          </div>
        </div>
      )}

      {step === 'success' && (
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-6">
          {/* Cercle succès animé */}
          <div className="relative">
            <div className="w-28 h-28 rounded-full bg-green-100 flex items-center justify-center">
              <span className="text-5xl">✅</span>
            </div>
            <div className="absolute inset-0 rounded-full border-4 border-green-400 animate-ping opacity-20" />
          </div>

          <div className="text-center">
            <h1 className="font-black text-2xl text-gray-900">{t('pay.successTitle')}</h1>
            {merchant && (
              <p className="text-gray-400 text-sm mt-1">{t('pay.payingAt')} <span className="font-semibold text-gray-600">{merchant.business_name}</span></p>
            )}
          </div>

          {/* Reçu */}
          <div className="w-full max-w-sm bg-white rounded-3xl border border-gray-100 overflow-hidden shadow-sm">
            {/* Montant */}
            <div className="bg-gradient-to-br from-brand-700 to-brand-600 px-6 py-5 text-center">
              <p className="text-brand-200 text-xs font-semibold uppercase tracking-widest mb-1">Montant payé</p>
              <p className="text-white text-4xl font-black">{formatFcfa(amountNum)}</p>
              <p className="text-brand-300 text-sm mt-0.5">FCFA</p>
            </div>

            {/* Détails */}
            <div className="divide-y divide-gray-50">
              <div className="px-5 py-3 flex justify-between items-center">
                <span className="text-sm text-gray-500">Mode</span>
                <span className="text-sm font-semibold">{selectedOption.icon} {selectedOption.label}</span>
              </div>
              {merchant && (
                <div className="px-5 py-3 flex justify-between items-center">
                  <span className="text-sm text-gray-500">Marchand</span>
                  <span className="text-sm font-semibold">{merchant.business_name}</span>
                </div>
              )}
              {resultTx && resultTx.cashback > 0 && (
                <div className="px-5 py-3 flex justify-between items-center bg-brand-50">
                  <span className="text-sm font-semibold text-brand-700">🔥 Cashback gagné</span>
                  <span className="text-sm font-bold text-brand-600">
                    +{formatFcfa(resultTx.cashback)} {resultTx.isGfp ? 'GFP' : 'FCFA'}
                  </span>
                </div>
              )}
            </div>

            {/* Séparateur découpe ticket */}
            <div className="flex items-center gap-1 px-2">
              <div className="w-4 h-4 rounded-full bg-gray-50 border border-gray-100 -ml-2 flex-shrink-0" />
              <div className="flex-1 border-t border-dashed border-gray-200" />
              <div className="w-4 h-4 rounded-full bg-gray-50 border border-gray-100 -mr-2 flex-shrink-0" />
            </div>

            <div className="px-5 py-3 text-center">
              <p className="text-xs text-gray-400">{new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="w-full max-w-sm space-y-3">
            <button
              onClick={reset}
              className="w-full py-3.5 bg-brand-600 text-white rounded-2xl font-bold text-sm"
            >
              Nouveau paiement
            </button>
            <button
              onClick={() => window.history.back()}
              className="w-full py-3 text-gray-500 text-sm font-medium"
            >
              Retour
            </button>
          </div>
        </div>
      )}

      {/* ── CONTENU NORMAL (toutes les autres étapes) ── */}
      {!['processing', 'success'].includes(step) && (
        <>
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-4 pt-12 flex items-center gap-3 sticky top-0 z-10">
        <button
          onClick={handleBack}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-600 flex-shrink-0"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg leading-none">
            {STEP_LABELS[step] ?? t('pay.title')}
          </h1>
          {merchant && (
            <p className="text-xs text-gray-400 mt-0.5 truncate">{t('pay.payingAt')} <span className="font-medium text-gray-600">{merchant.business_name}</span></p>
          )}
        </div>
        {amountNum > 0 && !['method'].includes(step) && (
          <span className="font-bold text-brand-600 flex-shrink-0 bg-brand-50 px-3 py-1 rounded-xl text-sm">{formatFcfa(amountNum)}</span>
        )}
        <Logo size={36} className="w-9 h-9 flex-shrink-0 ml-1" />
      </div>

      {/* Progress bar */}
      {progressIdx >= 0 && (
        <div className="flex gap-1 px-4 pt-3 pb-1">
          {progressSteps.map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= progressIdx ? 'bg-brand-600' : 'bg-gray-200'}`}
            />
          ))}
        </div>
      )}

      {/* ── Image contextuelle (étape méthode) ── */}
      {step === 'method' && (
        <button
          onClick={() => setStep('amount')}
          className="relative w-full h-32 overflow-hidden block cursor-pointer group mt-2"
        >
          <img
            src="/images/Chargement%20cam%C3%A9ra.png"
            alt=""
            className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-brand-900/20 via-brand-800/50 to-brand-900/85" />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5">
            <span className="text-3xl drop-shadow-lg">📷</span>
            <p className="text-white font-semibold text-sm drop-shadow-md">{t('pay.scanQrBanner')}</p>
            <span className="text-white/70 text-xs">{t('pay.scanQrBannerStart')}</span>
          </div>
        </button>
      )}

      <div className="p-4 space-y-4">

        {/* ── STEP: METHOD ── */}
        {step === 'method' && (
          <div className="space-y-3">
            <p className="text-gray-500 text-sm">
              {merchant ? `${t('pay.payingAt')} ${merchant.business_name}` : t('pay.chooseMethod')}
            </p>

            <div className="space-y-2">
              {PAYMENT_CATEGORIES.map(({ value, label, icon, desc }) => {
                const isSelected = payCategory === value
                return (
                  <div key={value}>
                    <button
                      onClick={() => {
                        if (value === 'mobile_money') {
                          if (!isMobileMoney) setPaymentMethod('mtn_momo')
                        } else {
                          setPaymentMethod(value as PayMethod)
                        }
                      }}
                      className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
                        isSelected
                          ? 'border-brand-500 bg-brand-50 shadow-sm'
                          : 'border-gray-100 bg-white hover:border-gray-200'
                      }`}
                    >
                      <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0 transition-colors ${
                        isSelected ? 'bg-brand-100' : 'bg-gray-50'
                      }`}>
                        {icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${isSelected ? 'text-brand-800' : 'text-gray-900'}`}>{label}</p>
                        {value === 'wallet_gf' && walletBalance !== null ? (
                          <p className="text-xs text-brand-600 font-medium mt-0.5">{formatFcfa(walletBalance)} disponibles</p>
                        ) : (
                          <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                        )}
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected ? 'border-brand-500 bg-brand-500' : 'border-gray-200'
                      }`}>
                        {isSelected && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                    </button>

                    {/* Sous-opérateurs mobiles */}
                    {value === 'mobile_money' && isSelected && (
                      <div className="ml-4 mt-2 flex gap-2">
                        {MOBILE_OPERATORS.map(op => (
                          <button
                            key={op.value}
                            onClick={() => setPaymentMethod(op.value)}
                            className={`flex-1 flex flex-col items-center gap-1 py-2 px-1 rounded-xl border-2 text-xs font-semibold transition-all ${
                              paymentMethod === op.value
                                ? 'border-brand-500 bg-brand-50 text-brand-800'
                                : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
                            }`}
                          >
                            <span className="text-lg">{op.icon}</span>
                            <span>{op.label}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {isMobileMoney && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {t('pay.mobileNumberDebit').replace('{method}', selectedOption.label)}
                </label>
                <PhoneInput
                  value={payerMsisdn}
                  onChange={setPayerMsisdn}
                  placeholder="97 00 00 00"
                />
                <p className="text-xs text-gray-400">{t('pay.ussdNote')}</p>
              </div>
            )}

            <button
              onClick={() => setStep('amount')}
              disabled={selectedOption.needsPhone && !payerMsisdn}
              className="btn-primary"
            >
              {t('pay.next')}
            </button>
          </div>
        )}

        {/* ── STEP: AMOUNT ── */}
        {step === 'amount' && (
          <div className="space-y-4">
            {merchant && (
              <div className="card">
                <p className="text-xs text-gray-500">{t('pay.payingAt')}</p>
                <p className="font-bold text-lg">{merchant.business_name}</p>
              </div>
            )}

            <div>
              <label className="label">
                {t('pay.amountLabel')}
                <span className="text-gray-400 text-xs ml-1 font-normal">{t('pay.voiceHint')}</span>
              </label>
              <VoiceAmountInput
                value={amount}
                onChange={setAmount}
                autoFocus
              />
            </div>

            {amountNum > 0 && merchant && (
              <div className="bg-brand-50 border border-brand-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-brand-800">{t('pay.estimatedCashback')}</p>
                <p className="text-2xl font-bold text-brand-600 mt-1">
                  {cashbackDisplay.label} 🔥
                </p>
                <p className="text-xs text-brand-500 mt-0.5">
                  {product?.commission_rate
                    ? t('pay.specificRate')
                    : t('pay.merchantRate').replace('{merchant}', merchant.business_name)
                  } · {t('pay.gfpFractionNote')}
                </p>
              </div>
            )}

            {insufficient && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                {t('pay.insufficientFunds').replace('{amount}', formatFcfa(walletBalance ?? 0))}
              </div>
            )}

            <button
              onClick={() => {
                if (merchant) {
                  setStep(paymentMethod === 'wallet_gf' ? 'pin' : 'confirm')
                } else {
                  setStep('merchant')
                }
              }}
              disabled={amountNum <= 0 || insufficient}
              className="btn-primary"
            >
              {merchant ? t('pay.confirmWithMerchant') : t('pay.identifyMerchant')}
            </button>
            <button onClick={() => setStep('method')} className="btn-secondary">{t('pay.back')}</button>
          </div>
        )}

        {/* ── STEP: MERCHANT ── */}
        {step === 'merchant' && (
          <div className="space-y-4">
            <p className="text-gray-500 text-sm text-center">
              {t('pay.scanInstruction')}
            </p>
            <div className="rounded-2xl overflow-hidden bg-black aspect-square max-w-sm mx-auto">
              <div id="qr-reader" className="w-full h-full" />
            </div>
            {!scannerReady && (
              <div className="flex flex-col items-center gap-3">
                {/* Photo pendant le chargement camera */}
                <div className="relative w-full max-w-sm h-20 rounded-xl overflow-hidden">
                  <img
                    src="/images/Chargement%20cam%C3%A9ra.png"
                    alt=""
                    className="w-full h-full object-cover opacity-50"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <p className="text-gray-600 text-sm font-medium animate-pulse">{t('pay.cameraLoading')}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="relative flex items-center gap-3">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">{t('pay.orSearch')}</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="text"
                  value={manualId}
                  onChange={async e => {
                    setManualId(e.target.value)
                    await searchMerchants(e.target.value)
                  }}
                  placeholder="Numéro, nom ou code du marchand"
                  className="input flex-1 text-sm"
                />
                {searching && <span className="text-xs text-gray-400 self-center">…</span>}
              </div>
              <p className="text-xs text-gray-400 text-center">
                📱 Numéro Mobile Money · 🏪 Nom de boutique · 🔗 Code
              </p>

              {/* Résultats de recherche */}
              {searchResults.length > 0 && (
                <div className="border border-gray-200 rounded-xl overflow-hidden">
                  {(searchResults as (MerchantInfo & { match_type?: string })[]).map(m => (
                    <button
                      key={m.id}
                      onClick={async () => {
                        await stopScanner()
                        setMerchant(m)
                        setManualId('')
                        setSearchResults([])
                        setStep('amount')
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-brand-50 transition-colors border-b border-gray-100 last:border-b-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm text-gray-900">{m.business_name}</p>
                        {(m as MerchantInfo & { match_type?: string }).match_type === 'phone' && (
                          <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium flex-shrink-0">📱 Tél.</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">Frais GreenFlame : {(m.commission_rate * 100).toFixed(0)}%</p>
                    </button>
                  ))}
                </div>
              )}

              {manualId.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-xs text-gray-400 text-center py-2">{t('pay.noMerchantFound').replace('{query}', manualId)}</p>
              )}
            </div>
            <button onClick={async () => { await stopScanner(); setStep('amount') }} className="btn-secondary">
              {t('pay.back')}
            </button>
          </div>
        )}

        {/* ── STEP: PIN ── */}
        {step === 'pin' && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="w-16 h-16 bg-brand-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-3xl">🔐</span>
              </div>
              <h2 className="font-bold text-xl">{t('pay.pinWalletTitle')}</h2>
              <p className="text-gray-500 text-sm mt-1">{t('pay.pinWalletSubtitle')}</p>
            </div>

            <div className="card bg-brand-50 border-brand-200 text-center">
              <p className="text-brand-700 text-sm">{t('pay.availableBalance')}</p>
              <p className="text-2xl font-bold text-brand-600">{formatFcfa(walletBalance ?? 0)} FCFA</p>
              <p className="text-brand-500 text-xs mt-0.5">
                {t('pay.afterPayment').replace('{amount}', formatFcfa((walletBalance ?? 0) - amountNum))}
              </p>
            </div>

            <div>
              <label className="label">{t('pay.pinInputLabel')}</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="••••••"
                className="input text-center text-2xl font-bold tracking-widest"
                autoFocus
              />
            </div>

            <button onClick={() => setStep('confirm')} disabled={pin.length < 6} className="btn-primary">
              {t('pay.confirmWithMerchant')}
            </button>
            <button onClick={() => setStep(merchantIdFromUrl ? 'amount' : 'merchant')} className="btn-secondary">
              {t('pay.back')}
            </button>
          </div>
        )}

        {/* ── STEP: CONFIRM ── */}
        {step === 'confirm' && merchant && (
          <div className="space-y-4">
            <div className="card space-y-3">
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">{t('pay.merchant')}</span>
                <span className="font-medium text-sm">{merchant.business_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">{t('pay.amount')}</span>
                <span className="font-bold text-lg">{formatFcfa(amountNum)} FCFA</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 text-sm">{t('pay.method')}</span>
                <span className="font-medium text-sm">{selectedOption.icon} {selectedOption.label}</span>
              </div>
              {payerMsisdn && (
                <div className="flex justify-between">
                  <span className="text-gray-500 text-sm">{t('pay.payerPhone')}</span>
                  <span className="font-medium text-sm">{payerMsisdn}</span>
                </div>
              )}
              {merchant && (
              <div className="border-t border-gray-100 pt-3 flex justify-between">
                <span className="text-brand-600 font-semibold text-sm">{t('pay.cashback')}</span>
                <span className="font-bold text-brand-600">{cashbackDisplay.label} 🔥</span>
              </div>
              )}
            </div>

            {/* ── USSD mobile money ── */}
            {IS_MOBILE_MONEY.includes(paymentMethod) && (() => {
              const code = ussdDisplayCode(paymentMethod, amountNum)
              const link = ussdTelLink(paymentMethod, amountNum)
              return (
                <div className="space-y-3">
                  {code ? (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">
                      <p className="text-blue-800 font-semibold text-sm">
                        {selectedOption.icon} {t('pay.ussdDialCode')}
                      </p>
                      <div className="bg-white border border-blue-200 rounded-xl px-4 py-3 text-center">
                        <p className="font-mono font-bold text-lg text-gray-900 tracking-wider">{code}</p>
                      </div>
                      {link && (
                        <a
                          href={link}
                          className="flex items-center justify-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
                        >
                          {t('pay.ussdOpenDialer')}
                        </a>
                      )}
                      <p className="text-xs text-blue-600 text-center font-medium">
                        {t('pay.ussdFromNumber').replace('{number}', '')} <span className="font-mono">{payerMsisdn}</span>
                      </p>
                      <p className="text-xs text-blue-400 text-center">
                        {t('pay.ussdIphoneNote')}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
                      <p className="text-blue-800 font-semibold text-sm text-center">
                        {t('pay.ussdFollowInstructions')}
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

            <button
              onClick={handlePay}
              disabled={loading}
              className="btn-primary w-full py-4 text-base"
            >
              {loading ? t('pay.processing') : t('pay.confirmPay')}
            </button>
            <button onClick={() => setStep('pin')} className="btn-secondary">
              {t('pay.back')}
            </button>
          </div>
        )}

      </div>
      </>
      )}
    </div>
  )
}


export default function PayPage() {
  return (
    <Suspense>
      <PayForm />
    </Suspense>
  )
}
