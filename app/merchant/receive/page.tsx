'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { formatFcfa, formatCashback, commissionCode } from '@/lib/utils/format'
import { GOVERNANCE } from '@/lib/commission-engine/constants'
import PendingTransactionsPanel from '@/components/merchant/PendingTransactionsPanel'
import PhoneInput from '@/components/ui/PhoneInput'
import VoiceAmountInput from '@/components/VoiceAmountInput'
import { speak } from '@/lib/hooks/useVoice'
import { useLocale } from '@/components/providers/LocaleProvider'

type BuyerInfo = {
  found: boolean
  userId?: string
  name?: string
  balance_fcfa?: number
  balance_gfp?: number
}

type SubscriptionProduct = {
  id: string
  name: string
  price_fcfa: number
  subscription_trigger: string
}

type PaymentType =
  | 'sale'           // Vente de produit
  | 'wallet_load'    // Recharge wallet client (0% commission) → redirect cashin
  | 'agent_deposit'  // Encaisser un bon de retrait → redirect vouchers
  | 'subscription'   // Abonnement GreenFlame Hub (revenu plateforme)
  | 'proxy_client'   // Acheter pour un client (sous-choix méthode)
  | 'proxy_purchase' // Achat assisté wallet_gf — le client valide avec son PIN
  | 'proxy_cash'     // Achat assisté espèces — le client consent avec son PIN
  | 'other'          // Paiement libre

export default function ReceivePage() {
  const router = useRouter()
  const { t } = useLocale()
  const supabase = createClient()
  const imgRef = useRef<HTMLImageElement>(null)

  const PAYMENT_TYPES: { type: PaymentType; emoji: string; label: string; sub: string; commissionNote: string }[] = [
    {
      type:           'sale',
      emoji:          '🛍️',
      label:          t('merchant.receive.typeSale'),
      sub:            t('merchant.receive.typeSaleSub'),
      commissionNote: t('merchant.receive.typeSaleNote'),
    },
    {
      type:           'wallet_load',
      emoji:          '💳',
      label:          t('merchant.receive.typeWalletLoad'),
      sub:            t('merchant.receive.typeWalletLoadSub'),
      commissionNote: t('merchant.receive.typeWalletLoadNote'),
    },
    {
      type:           'agent_deposit',
      emoji:          '🏦',
      label:          t('merchant.receive.typeAgent'),
      sub:            t('merchant.receive.typeAgentSub'),
      commissionNote: t('merchant.receive.typeAgentNote'),
    },
    {
      type:           'subscription',
      emoji:          '🔑',
      label:          t('merchant.receive.typeSubscription'),
      sub:            t('merchant.receive.typeSubscriptionSub'),
      commissionNote: t('merchant.receive.typeSubscriptionNote'),
    },
    {
      type:           'proxy_client',
      emoji:          '🤝',
      label:          'Acheter pour un client',
      sub:            'Vous guidez l\'achat — le client valide avec son PIN',
      commissionNote: 'Wallet GF ou espèces · Cashback automatique · PIN client requis',
    },
    {
      type:           'other',
      emoji:          '💰',
      label:          t('merchant.receive.typeOther'),
      sub:            t('merchant.receive.typeOtherSub'),
      commissionNote: t('merchant.receive.typeOtherNote'),
    },
  ]

  const [voiceAmountApplied, setVoiceAmountApplied] = useState(false)
  const [merchantId, setMerchantId] = useState<string | null>(null)
  const [businessName, setBusinessName] = useState('')
  const [commissionRate, setCommissionRate] = useState(0.10)
  const [isHub, setIsHub] = useState(false)
  const [agentActive, setAgentActive] = useState(false)
  const [subscriptionProducts, setSubscriptionProducts] = useState<SubscriptionProduct[]>([])
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)
  const [paymentType, setPaymentType] = useState<PaymentType | null>(null)
  const [amount, setAmount] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [buyerInfo, setBuyerInfo] = useState<BuyerInfo | null>(null)
  const [lookingUp, setLookingUp] = useState(false)
  const [applyCashback, setApplyCashback] = useState(false)
  const [loading, setLoading] = useState(false)
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
  const [step, setStep] = useState<'motif' | 'proxy_method' | 'amount' | 'confirm' | 'cash_pending' | 'proxy_pin' | 'qr' | 'success'>('motif')
  const [merchantPin, setMerchantPin] = useState('')
  const [clientPin, setClientPin] = useState('')
  const [proxyProcessing, setProxyProcessing] = useState(false)
  const [secondsLeft, setSecondsLeft] = useState(300)
  const [resultCashback, setResultCashback] = useState<number | null>(null)
  const [resultDiscount, setResultDiscount] = useState<number>(0)

  const amountNum = parseInt(amount.replace(/\D/g, '')) || 0
  const commissionTotal = Math.floor(amountNum * commissionRate)
  const cashback = Math.floor(commissionTotal * GOVERNANCE.CASHBACK_SHARE)
  const cashbackDisplay = formatCashback(amountNum * commissionRate * GOVERNANCE.CASHBACK_SHARE)

  const availableCashback = buyerInfo?.balance_fcfa ?? 0
  const cashbackApplied = applyCashback ? Math.min(availableCashback, amountNum) : 0
  const effectiveAmount = amountNum - cashbackApplied
  const effectiveCommission = Math.floor(effectiveAmount * commissionRate)
  const merchantReceives = effectiveAmount - effectiveCommission
  const finalAmount = cashbackApplied > 0 ? effectiveAmount : amountNum

  // Pré-remplissage depuis commande vocale (?amount=X)
  useEffect(() => {
    if (voiceAmountApplied) return
    const params = new URLSearchParams(window.location.search)
    const urlAmount = params.get('amount')
    if (urlAmount) {
      const n = parseInt(urlAmount)
      if (n >= 50) {
        setAmount(String(n))
        setPaymentType('sale')
        setStep('amount')
        speak(`Montant ${n.toLocaleString('fr-FR')} francs pré-rempli`)
      }
    }
    setVoiceAmountApplied(true)
  }, [voiceAmountApplied])

  useEffect(() => {
    if (step !== 'cash_pending') return
    setSecondsLeft(300)
    const interval = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) { clearInterval(interval); return 0 }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [step])

  useEffect(() => {
    async function loadMerchant() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('merchants')
        .select('id, commission_rate, business_name, is_platform_hub, agent_service_active')
        .eq('user_id', user.id)
        .single()
      if (data) {
        setMerchantId(data.id)
        setCommissionRate(data.commission_rate)
        setBusinessName(data.business_name)
        setIsHub(data.is_platform_hub ?? false)
        setAgentActive(data.agent_service_active ?? false)

        const { data: subProducts } = await supabase
          .from('products')
          .select('id, name, price_fcfa, subscription_trigger')
          .eq('merchant_id', data.id)
          .not('subscription_trigger', 'is', null)
          .eq('is_available', true)
        setSubscriptionProducts(subProducts ?? [])
      }
    }
    loadMerchant()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const lookupBuyer = useCallback(async (phone: string) => {
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 8) { setBuyerInfo(null); return }
    setLookingUp(true)
    try {
      const res = await fetch(`/api/buyer/lookup?phone=${encodeURIComponent(phone)}`)
      const data = await res.json()
      setBuyerInfo(data)
      setApplyCashback(false)
    } catch {
      setBuyerInfo(null)
    } finally {
      setLookingUp(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => lookupBuyer(buyerPhone), 600)
    return () => clearTimeout(timer)
  }, [buyerPhone, lookupBuyer])

  async function generateQR() {
    if (!merchantId || amountNum <= 0) return
    const qrData = `greenflame://pay?merchant_id=${merchantId}&amount=${amountNum}&v=1`
    const { default: QRCode } = await import('qrcode')
    const dataUrl = await QRCode.toDataURL(qrData, {
      errorCorrectionLevel: 'M',
      width: 400,
      margin: 2,
      color: { dark: '#166534', light: '#FFFFFF' },
    })
    setQrDataUrl(dataUrl)
    setStep('qr')
  }

  function downloadQR() {
    if (!qrDataUrl) return
    const link = document.createElement('a')
    link.href = qrDataUrl
    link.download = `GreenFlame-QR-${businessName}-${amountNum}FCFA.png`
    link.click()
  }

  function printQR() {
    if (!qrDataUrl) return
    const win = window.open('', '_blank')
    if (!win) return
    win.document.write(`
      <html><body style="text-align:center;padding:40px;font-family:sans-serif">
        <h2 style="color:#166534">🔥 ${businessName}</h2>
        <p style="font-size:20px;font-weight:bold">${formatFcfa(amountNum)} FCFA</p>
        <img src="${qrDataUrl}" width="300" style="margin:20px auto;display:block"/>
        <p style="color:#666;font-size:14px">Scan with GreenFlame app to pay</p>
        <p style="color:#166534;font-size:13px">Earn ${cashback} ${cashback < 50 ? 'GFP' : 'FCFA'} cashback!</p>
      </body></html>
    `)
    win.document.close()
    win.print()
  }

  async function handleProxyPurchase() {
    if (!merchantId || !buyerPhone || amountNum <= 0) return
    if (!buyerInfo?.found || !buyerInfo.userId) {
      toast.error(t('merchant.receive.clientNotFound'))
      return
    }
    if (!clientPin.trim() || clientPin.length < 4) {
      toast.error('Le client doit saisir son code PIN')
      return
    }
    setProxyProcessing(true)

    const phoneNorm = buyerPhone.startsWith('+') ? buyerPhone : '+' + buyerPhone.replace(/\D/g, '')
    const idempotencyKey = `proxy-${merchantId}-${buyerInfo.userId}-${Date.now()}`

    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId,
        amountFcfa:     amountNum,
        paymentMethod:  'wallet_gf',
        buyerPhone:     phoneNorm,
        transactionPin: clientPin,
        idempotencyKey,
        ...(selectedProductId ? { productId: selectedProductId } : {}),
      }),
    })

    const data = await res.json()
    setProxyProcessing(false)
    setClientPin('')

    if (!res.ok) {
      toast.error(data.error ?? 'Paiement refusé')
      return
    }

    setResultCashback(data.cashback?.amount ?? 0)
    setResultDiscount(0)
    setStep('success')
    toast.success('✅ Paiement validé par le client !')
    speak(`Achat validé. ${buyerInfo?.name ?? 'Le client'} a gagné ${data.cashback?.amount ?? 0} francs de cashback.`)
  }

  async function handleProxyCash() {
    if (!merchantId || !buyerPhone || amountNum <= 0) return
    if (!buyerInfo?.found || !buyerInfo.userId) {
      toast.error(t('merchant.receive.clientNotFound'))
      return
    }
    if (!clientPin.trim() || clientPin.length < 4) {
      toast.error('Le client doit saisir son code PIN pour consentir')
      return
    }
    setProxyProcessing(true)

    const phoneNorm = buyerPhone.startsWith('+') ? buyerPhone : '+' + buyerPhone.replace(/\D/g, '')
    const idempotencyKey = `proxy-cash-${merchantId}-${buyerInfo.userId}-${Date.now()}`

    // Étape 1 : créer la transaction en attente
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId,
        amountFcfa:    amountNum,
        paymentMethod: 'cash_confirmed',
        buyerPhone:    phoneNorm,
        idempotencyKey,
        ...(selectedProductId ? { productId: selectedProductId } : {}),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setProxyProcessing(false)
      toast.error(data.error ?? 'Erreur lors de la création')
      return
    }

    // Étape 2 : confirmer avec le PIN du client (consentement digital)
    const confirmRes = await fetch('/api/transactions/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: data.transactionId, buyerPin: clientPin }),
    })
    const confirmData = await confirmRes.json()
    setProxyProcessing(false)
    setClientPin('')

    if (!confirmRes.ok) {
      toast.error(confirmData.error ?? 'PIN du client incorrect')
      return
    }

    setResultCashback(confirmData.cashback?.amount ?? 0)
    setResultDiscount(0)
    setStep('success')
    toast.success('✅ Paiement validé par le client !')
    speak(`Achat espèces validé. ${buyerInfo?.name ?? 'Le client'} a gagné ${confirmData.cashback?.amount ?? 0} francs de cashback.`)
  }

  async function handleCashConfirmed() {
    if (!merchantId || !buyerPhone || amountNum <= 0) return
    if (!buyerInfo?.found || !buyerInfo.userId) {
      toast.error(t('merchant.receive.clientNotFound'))
      return
    }
    if (!merchantPin.trim()) {
      toast.error('Code PIN requis pour confirmer')
      return
    }
    setLoading(true)

    const phoneNorm = buyerPhone.startsWith('+') ? buyerPhone : '+' + buyerPhone.replace(/\D/g, '')
    const idempotencyKey = `cash-${merchantId}-${buyerInfo.userId}-${Date.now()}`

    // Étape 1 : créer la transaction en pending
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchantId,
        amountFcfa: amountNum,
        paymentMethod: 'cash_confirmed',
        buyerPhone: phoneNorm,
        idempotencyKey,
        ...(selectedProductId ? { productId: selectedProductId } : {}),
        ...(cashbackApplied > 0 ? { cashbackDiscount: cashbackApplied } : {}),
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setLoading(false)
      toast.error(data.error ?? t('merchant.receive.transactionFailed'))
      return
    }

    // Étape 2 : confirmer immédiatement (distribue cashback + commissions réseau)
    const confirmRes = await fetch('/api/transactions/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: data.transactionId, transactionPin: merchantPin }),
    })
    const confirmData = await confirmRes.json()
    setLoading(false)

    if (!confirmRes.ok) {
      toast.error(confirmData.error ?? 'Erreur lors de la confirmation — vérifiez votre PIN')
      return
    }

    const cb = confirmData.cashback?.amount ?? cashback
    setResultCashback(cb)
    setResultDiscount(cashbackApplied)
    setMerchantPin('')
    setStep('success')
    toast.success(t('merchant.receive.paymentConfirmedToast'))
    speak(`Paiement confirmé. ${buyerInfo?.name ?? 'Le client'} a gagné ${cb} ${cb < 50 ? 'points GreenFlame' : 'francs'} de cashback.`)
  }

  const timerLabel = `${Math.floor(secondsLeft / 60).toString().padStart(2, '0')}:${(secondsLeft % 60).toString().padStart(2, '0')}`

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-4">

      {/* ── ÉTAPE 0 : Motif de l'encaissement ── */}
      {step === 'motif' && (
        <div className="space-y-4">
          <div>
            <h1 className="font-bold text-xl">{t('merchant.receive.title')}</h1>
            <p className="text-gray-500 text-sm mt-1">{t('merchant.receive.motifSubtitle')}</p>
          </div>

          <div className="space-y-2">
            {PAYMENT_TYPES.filter(pt => {
              if (pt.type === 'subscription' && !isHub) return false
              if (pt.type === 'agent_deposit' && !agentActive) return false
              return true
            }).map(pt => (
              <button
                key={pt.type}
                onClick={() => {
                  if (pt.type === 'agent_deposit') {
                    router.push('/merchant/vouchers')
                    return
                  }
                  if (pt.type === 'wallet_load') {
                    router.push('/merchant/cashin')
                    return
                  }
                  if (pt.type === 'proxy_client') {
                    setPaymentType('proxy_client')
                    setAmount('')
                    setSelectedProductId(null)
                    setStep('proxy_method')
                    return
                  }
                  setPaymentType(pt.type)
                  if (pt.type === 'subscription' && subscriptionProducts.length > 0) {
                    setAmount(String(subscriptionProducts[0].price_fcfa))
                    setSelectedProductId(subscriptionProducts[0].id)
                  } else {
                    setAmount('')
                    setSelectedProductId(null)
                  }
                  setStep('amount')
                }}
                className="w-full flex items-start gap-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-brand-400 hover:bg-brand-50 dark:hover:bg-brand-950/30 rounded-2xl p-4 text-left transition-all group"
              >
                <span className="text-2xl flex-shrink-0 mt-0.5">{pt.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white group-hover:text-brand-700 dark:group-hover:text-brand-300">{pt.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{pt.sub}</p>
                  <p className="text-xs text-brand-600 dark:text-brand-400 mt-1 font-medium">{pt.commissionNote}</p>
                </div>
                <span className="text-gray-300 dark:text-gray-600 text-lg mt-1">›</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── STEP : PROXY METHOD — choix wallet ou espèces ── */}
      {step === 'proxy_method' && (
        <div className="space-y-4">
          <div className="text-center mb-2">
            <p className="text-lg font-bold text-gray-900">🤝 Acheter pour un client</p>
            <p className="text-sm text-gray-500 mt-1">Comment le client va-t-il payer ?</p>
          </div>

          <button
            onClick={() => { setPaymentType('proxy_purchase'); setStep('amount') }}
            className="w-full flex items-start gap-4 bg-white border-2 border-brand-200 hover:border-brand-500 hover:bg-brand-50 rounded-2xl p-5 text-left transition-all"
          >
            <span className="text-3xl">💳</span>
            <div>
              <p className="font-bold text-gray-900">Wallet GreenFlame</p>
              <p className="text-sm text-gray-500 mt-0.5">Le client a du solde sur son wallet · Vous saisissez son PIN</p>
              <p className="text-xs text-brand-600 mt-1">Cashback immédiat · Commissions réseau</p>
            </div>
          </button>

          <button
            onClick={() => { setPaymentType('proxy_cash'); setStep('amount') }}
            className="w-full flex items-start gap-4 bg-white border-2 border-amber-200 hover:border-amber-500 hover:bg-amber-50 rounded-2xl p-5 text-left transition-all"
          >
            <span className="text-3xl">💵</span>
            <div>
              <p className="font-bold text-gray-900">Espèces</p>
              <p className="text-sm text-gray-500 mt-0.5">Le client remet du cash · Son PIN valide son consentement</p>
              <p className="text-xs text-amber-700 mt-1">Cashback immédiat · Commissions réseau</p>
            </div>
          </button>

          <button
            onClick={() => { setStep('motif'); setPaymentType(null) }}
            className="btn-secondary"
          >
            ← Retour
          </button>
        </div>
      )}

      {/* Incoming cash payments from consumer app — live via Realtime */}
      {merchantId && step === 'amount' && (
        <PendingTransactionsPanel merchantId={merchantId} />
      )}

      {step === 'amount' && (
        <>
          {/* Header avec motif sélectionné */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (paymentType === 'proxy_purchase' || paymentType === 'proxy_cash') {
                  setStep('proxy_method')
                } else {
                  setStep('motif'); setPaymentType(null)
                }
              }}
              className="text-brand-600 text-sm"
            >
              ←
            </button>
            <div>
              <h1 className="font-bold text-xl">
                {paymentType === 'proxy_purchase' ? '💳' : paymentType === 'proxy_cash' ? '💵' : PAYMENT_TYPES.find(p => p.type === paymentType)?.emoji}{' '}
                {paymentType === 'proxy_purchase' ? 'Achat client — Wallet GF'
                  : paymentType === 'proxy_cash' ? 'Achat client — Espèces'
                  : PAYMENT_TYPES.find(p => p.type === paymentType)?.label ?? t('merchant.receive.title')}
              </h1>
              <p className="text-xs text-gray-500">
                {paymentType === 'proxy_purchase' || paymentType === 'proxy_cash'
                  ? 'PIN client requis · Cashback automatique'
                  : PAYMENT_TYPES.find(p => p.type === paymentType)?.commissionNote}
              </p>
            </div>
          </div>

          {/* Sélection du produit pour abonnement Hub */}
          {paymentType === 'subscription' && subscriptionProducts.length > 0 && (
            <div className="space-y-1">
              <label className="label">{t('merchant.receive.subscriptionProduct')}</label>
              <div className="grid gap-2">
                {subscriptionProducts.map(sp => (
                  <button
                    key={sp.id}
                    onClick={() => { setSelectedProductId(sp.id); setAmount(String(sp.price_fcfa)) }}
                    className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-left transition-all ${
                      selectedProductId === sp.id
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-950'
                        : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-brand-300'
                    }`}
                  >
                    <span className="text-sm font-medium text-gray-900 dark:text-white">{sp.name}</span>
                    <span className="font-bold text-brand-700 dark:text-brand-400">{formatFcfa(sp.price_fcfa)} FCFA</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Montant — pré-rempli pour les abonnements */}
          {paymentType !== 'subscription' && (
            <div>
              <label className="label">
                {t('merchant.receive.amountInputLabel')}
                <span className="text-gray-500 text-xs ml-1 font-normal">{t('merchant.receive.voiceHint')}</span>
              </label>
              <VoiceAmountInput value={amount} onChange={setAmount} autoFocus />
            </div>
          )}

          {/* Récapitulatif des frais selon motif */}
          {amountNum > 0 && (
            <div className="card space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">
                  {paymentType === 'wallet_load' ? t('merchant.receive.amountToCredit') : t('merchant.receive.clientPays')}
                </span>
                <span className="font-semibold">{formatFcfa(amountNum)} FCFA</span>
              </div>

              {paymentType === 'wallet_load' && (
                <>
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>{t('merchant.receive.walletCredit')}</span>
                    <span className="font-bold">+{formatFcfa(amountNum)} FCFA</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-xs border-t pt-2">
                    <span>{t('merchant.receive.serviceFeeLabel')}</span>
                    <span>{t('merchant.receive.serviceFree')}</span>
                  </div>
                </>
              )}

              {paymentType === 'subscription' && (
                <>
                  <div className="flex justify-between text-brand-600 dark:text-brand-400">
                    <span>{t('merchant.receive.platformRevenue')}</span>
                    <span className="font-bold">+{formatFcfa(amountNum)} FCFA</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-xs border-t pt-2">
                    <span>{t('merchant.receive.autoActivation')}</span>
                    <span>✓</span>
                  </div>
                </>
              )}

              {(paymentType === 'sale' || paymentType === 'other') && (
                <>
                  <div className="flex justify-between text-red-500">
                    <span>{t('merchant.receive.greenflameFeesPrefix')} ({commissionCode(commissionRate)})</span>
                    <span>−{formatFcfa(commissionTotal)}</span>
                  </div>
                  <div className="flex justify-between text-brand-600 font-bold border-t pt-2">
                    <span>{t('merchant.receive.youReceive')}</span>
                    <span>{formatFcfa(amountNum - commissionTotal)} FCFA</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-xs">
                    <span>{t('merchant.receive.cashbackClientLabel')}</span>
                    <span>{cashbackDisplay.label} 🔥</span>
                  </div>
                </>
              )}

              {paymentType === 'agent_deposit' && (
                <>
                  <div className="flex justify-between text-green-600 dark:text-green-400">
                    <span>{t('merchant.receive.walletCredit')}</span>
                    <span className="font-bold">+{formatFcfa(amountNum)} FCFA</span>
                  </div>
                  <div className="flex justify-between text-gray-500 text-xs border-t pt-2">
                    <span>{t('merchant.receive.agentFee')}</span>
                    <span>{commissionCode(commissionRate)}</span>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={generateQR}
              disabled={amountNum <= 0 || !merchantId}
              className="btn-primary"
            >
              {t('merchant.receive.generateQr')}
            </button>
            <button
              onClick={() => setStep('confirm')}
              disabled={amountNum <= 0}
              className="btn-secondary"
            >
              {t('merchant.receive.collectByPhone')}
            </button>
          </div>
        </>
      )}

      {step === 'cash_pending' && (
        <div className="space-y-4">
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">💵</span>
            </div>
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">{t('merchant.receive.confirmReceiptTitle')}</h2>
            <p className="text-gray-500 text-sm mt-1">{t('merchant.receive.confirmReceiptSubtitle')}</p>
          </div>

          {/* Amount + buyer recap */}
          <div className="bg-brand-50 border-2 border-brand-200 dark:bg-brand-950 dark:border-brand-800 rounded-2xl p-5 text-center space-y-1">
            {paymentType && (
              <p className="text-xs font-semibold text-brand-600 dark:text-brand-400 uppercase tracking-wide">
                {PAYMENT_TYPES.find(p => p.type === paymentType)?.emoji}{' '}
                {PAYMENT_TYPES.find(p => p.type === paymentType)?.label}
              </p>
            )}
            {buyerInfo?.name && (
              <p className="text-gray-500 dark:text-gray-400 text-sm">{buyerInfo.name}</p>
            )}
            <p className="text-4xl font-bold text-gray-900 dark:text-white">{formatFcfa(finalAmount)}</p>
            <p className="text-brand-700 dark:text-brand-300 font-semibold">{t('merchant.receive.cashInHand')}</p>
            {cashbackApplied > 0 && (
              <p className="text-xs text-brand-500 mt-1">
                {t('merchant.receive.cashDeducted').replace('{amount}', formatFcfa(cashbackApplied))}
              </p>
            )}
          </div>

          {/* Countdown timer */}
          <div className={`rounded-2xl p-4 text-center border-2 transition-colors ${
            secondsLeft > 60
              ? 'bg-amber-50 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700'
              : secondsLeft > 0
              ? 'bg-red-50 border-red-400 dark:bg-red-950/30 dark:border-red-700'
              : 'bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-600'
          }`}>
            <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
              secondsLeft > 60 ? 'text-amber-700 dark:text-amber-400' : secondsLeft > 0 ? 'text-red-700 dark:text-red-400' : 'text-gray-500'
            }`}>
              {t('merchant.receive.confirmWindow')}
            </p>
            <p className={`text-4xl font-bold font-mono tracking-wider ${
              secondsLeft > 60 ? 'text-amber-800 dark:text-amber-300' : secondsLeft > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500'
            }`}>
              {timerLabel}
            </p>
            <p className={`text-xs mt-2 ${
              secondsLeft > 0 ? 'text-gray-500' : 'text-red-500 dark:text-red-400 font-medium'
            }`}>
              {secondsLeft > 0
                ? t('merchant.receive.confirmInstructions')
                : t('merchant.receive.timeExpiredMsg')}
            </p>
          </div>

          {/* PIN du marchand */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              🔒 Code PIN de confirmation
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={merchantPin}
              onChange={e => setMerchantPin(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="w-full text-center text-2xl tracking-widest font-bold border-2 border-gray-300 dark:border-gray-600 focus:border-brand-500 rounded-xl px-4 py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none transition-colors"
            />
          </div>

          {/* Confirm button */}
          <button
            onClick={handleCashConfirmed}
            disabled={loading || secondsLeft === 0 || merchantPin.length < 4}
            className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 px-4 rounded-2xl text-base transition-colors active:scale-95"
          >
            {loading
              ? t('merchant.receive.validating')
              : secondsLeft === 0
              ? t('merchant.receive.timeExpiredBtn')
              : t('merchant.receive.confirmWithAmount').replace('{amount}', formatFcfa(finalAmount))}
          </button>
          <button onClick={() => { setStep('confirm'); setMerchantPin('') }} disabled={loading} className="btn-secondary">
            {t('merchant.receive.cancelBtn')}
          </button>
        </div>
      )}

      {step === 'qr' && qrDataUrl && (
        <div className="text-center space-y-4">
          <div>
            <h2 className="font-bold text-lg">{t('merchant.receive.showQrTitle')}</h2>
            <p className="text-gray-500 text-sm mt-1">
              {t('merchant.receive.qrAmountLabel')} <strong>{formatFcfa(amountNum)} FCFA</strong>
            </p>
          </div>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={qrDataUrl}
            alt="QR code de paiement"
            className="w-64 h-64 mx-auto border-4 border-brand-100 rounded-2xl shadow-lg"
          />

          <p className="text-xs text-gray-500">{t('merchant.receive.qrHint')}</p>

          <div className="flex gap-2 justify-center">
            <button
              onClick={downloadQR}
              className="flex items-center gap-1.5 bg-brand-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-brand-700 transition-colors"
            >
              {t('merchant.receive.downloadPng')}
            </button>
            <button
              onClick={printQR}
              className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              {t('merchant.receive.print')}
            </button>
          </div>

          <button onClick={() => { setStep('amount'); setQrDataUrl(null) }} className="btn-secondary">
            {t('merchant.receive.newAmount')}
          </button>
        </div>
      )}

      {step === 'confirm' && (
        <div className="space-y-4">
          <h2 className="font-bold text-lg">{t('merchant.receive.collectByPhoneTitle')}</h2>

          <div className="card">
            <p className="text-sm text-gray-500">{t('merchant.receive.amount')}</p>
            <p className="text-2xl font-bold">{formatFcfa(amountNum)} FCFA</p>
          </div>

          <div>
            <label className="label">{t('merchant.receive.buyerPhoneLabel')}</label>
            <div className="relative">
              <PhoneInput
                value={buyerPhone}
                onChange={v => { setBuyerPhone(v); setBuyerInfo(null) }}
                placeholder="97 00 00 00"
                autoFocus
              />
              {lookingUp && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
          </div>

          {/* Le Moment Declencheur */}
          {buyerInfo?.found && buyerInfo.balance_fcfa !== undefined && (
            <div className={`rounded-2xl border-2 p-4 space-y-3 ${
              buyerInfo.balance_fcfa > 0
                ? 'border-brand-500 bg-brand-950'
                : 'border-gray-700 bg-gray-800/50'
            }`}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-brand-600/20 border border-brand-500/30 flex items-center justify-center text-lg">
                  👤
                </div>
                <div>
                  <p className="font-semibold text-white">{buyerInfo.name}</p>
                  <p className="text-xs text-gray-500">{t('merchant.receive.buyerPhone')}</p>
                </div>
              </div>

              {buyerInfo.balance_fcfa > 0 ? (
                <>
                  <div className="bg-brand-900/60 border border-brand-700 rounded-xl p-3">
                    <p className="text-xs text-brand-300 font-medium uppercase tracking-wide mb-1">{t('merchant.receive.creditAvailable')}</p>
                    <p className="text-2xl font-bold text-brand-400">{formatFcfa(buyerInfo.balance_fcfa)} FCFA</p>
                    {(buyerInfo.balance_gfp ?? 0) > 0 && (
                      <p className="text-xs text-gray-500 mt-0.5">+ {buyerInfo.balance_gfp?.toLocaleString()} GFP</p>
                    )}
                  </div>

                  <div className="bg-amber-900/30 border border-amber-700/50 rounded-xl px-3 py-2">
                    <p className="text-amber-300 text-sm font-medium">
                      {t('merchant.receive.sayToClient').replace('{amount}', formatFcfa(buyerInfo.balance_fcfa))}
                    </p>
                  </div>

                  <label className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={applyCashback}
                        onChange={e => setApplyCashback(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-5 h-5 border-2 border-gray-500 rounded peer-checked:bg-brand-600 peer-checked:border-brand-600 transition-colors" />
                      {applyCashback && (
                        <svg className="absolute inset-0 w-5 h-5 text-white p-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white group-hover:text-brand-300 transition-colors">
                        {t('merchant.receive.applyCredit')}
                      </p>
                      <p className="text-xs text-gray-500">
                        {t('merchant.receive.applyCreditHint')
                          .replace('{discounted}', formatFcfa(Math.max(0, amountNum - Math.min(buyerInfo.balance_fcfa, amountNum))))
                          .replace('{full}', formatFcfa(amountNum))}
                      </p>
                    </div>
                  </label>
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  {t('merchant.receive.noCredit')}
                </p>
              )}
            </div>
          )}

          {buyerInfo && !buyerInfo.found && buyerPhone.replace(/\D/g, '').length >= 8 && (
            <div className="rounded-xl border border-red-800 bg-red-950/30 p-3">
              <p className="text-red-400 text-sm">{t('merchant.receive.noAccountFound')}</p>
            </div>
          )}

          {/* Updated totals when cashback applied */}
          {applyCashback && cashbackApplied > 0 && (
            <div className="card space-y-2 text-sm">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('merchant.receive.summaryWithDiscount')}</p>
              <div className="flex justify-between">
                <span className="text-gray-500">{t('merchant.receive.initialAmount')}</span>
                <span>{formatFcfa(amountNum)} FCFA</span>
              </div>
              <div className="flex justify-between text-brand-400">
                <span>{t('merchant.receive.creditUsed')}</span>
                <span>−{formatFcfa(cashbackApplied)}</span>
              </div>
              <div className="flex justify-between text-gray-500">
                <span>{t('merchant.receive.netAmount').replace('{code}', commissionCode(commissionRate))}</span>
                <span>−{formatFcfa(effectiveCommission)}</span>
              </div>
              <div className="flex justify-between text-brand-600 font-bold border-t pt-2">
                <span>{t('merchant.receive.youReceive')}</span>
                <span>{formatFcfa(merchantReceives)} FCFA</span>
              </div>
            </div>
          )}

          {/* Produits abonnement — sélection optionnelle */}
          {subscriptionProducts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">{t('merchant.receive.saleType')}</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedProductId(null)}
                  className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                    !selectedProductId ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-300'
                  }`}
                >
                  {t('merchant.receive.normalSale')}
                </button>
                {subscriptionProducts.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setSelectedProductId(p.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                      selectedProductId === p.id ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-amber-700 border-amber-300'
                    }`}
                  >
                    ⭐ {p.name}
                  </button>
                ))}
              </div>
              {selectedProductId && (
                <p className="text-xs text-amber-700">
                  {t('merchant.receive.activateProAuto')}
                </p>
              )}
            </div>
          )}

          <button
            onClick={() => setStep(
              (paymentType === 'proxy_purchase' || paymentType === 'proxy_cash') ? 'proxy_pin' : 'cash_pending'
            )}
            disabled={!buyerPhone || amountNum <= 0 || !buyerInfo?.found}
            className="btn-primary"
          >
            {(paymentType === 'proxy_purchase' || paymentType === 'proxy_cash')
              ? `Passer au paiement — ${formatFcfa(amountNum)}`
              : t('merchant.receive.collectAction').replace('{amount}', formatFcfa(finalAmount))}
          </button>
          <button onClick={() => setStep('amount')} className="btn-secondary">← {t('common.back')}</button>
        </div>
      )}

      {/* ── STEP : PROXY PIN — écran à tendre au client ── */}
      {step === 'proxy_pin' && (
        <div className="space-y-5">
          {/* Bandeau "tendez le téléphone" — visible pour le marchand */}
          <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 text-center">
            <p className="text-2xl mb-1">{paymentType === 'proxy_cash' ? '💵' : '📱'}</p>
            <p className="font-bold text-amber-800">Passez le téléphone à {buyerInfo?.name ?? 'votre client'}</p>
            <p className="text-xs text-amber-600 mt-0.5">
              {paymentType === 'proxy_cash'
                ? 'Il va confirmer avec son PIN qu\'il remet les espèces'
                : 'Il va entrer son code PIN pour valider le paiement'}
            </p>
          </div>

          {/* Récap transaction — visible pour le client */}
          <div className="bg-brand-50 border-2 border-brand-200 rounded-2xl p-5 text-center space-y-1">
            <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">
              {paymentType === 'proxy_cash' ? 'Vous remettez des espèces à' : 'Votre achat chez'}
            </p>
            <p className="text-lg font-bold text-gray-900">{businessName}</p>
            <p className="text-4xl font-black text-gray-900 mt-2">{formatFcfa(amountNum)}</p>
            <p className="text-xs text-brand-600 mt-1">
              🔥 Vous gagnerez {cashbackDisplay.label} de cashback
            </p>
          </div>

          {/* Saisie PIN par le client */}
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
            onClick={paymentType === 'proxy_cash' ? handleProxyCash : handleProxyPurchase}
            disabled={proxyProcessing || clientPin.length < 4}
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-4 rounded-2xl text-base transition-colors active:scale-95"
          >
            {proxyProcessing
              ? 'Validation…'
              : paymentType === 'proxy_cash'
                ? `Je remets les espèces — ${formatFcfa(amountNum)}`
                : `Confirmer — ${formatFcfa(amountNum)} FCFA`}
          </button>

          <button
            onClick={() => { setStep('confirm'); setClientPin('') }}
            disabled={proxyProcessing}
            className="btn-secondary"
          >
            ← Annuler
          </button>
        </div>
      )}

      {step === 'success' && (
        <div className="text-center space-y-4 py-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">✅</span>
          </div>
          <h2 className="font-bold text-2xl text-gray-900 dark:text-white">{t('merchant.receive.successTitle')}</h2>
          <div className="card bg-brand-50 border-brand-200 dark:bg-brand-950 dark:border-brand-800">
            <p className="text-brand-700 dark:text-brand-300">{t('merchant.receive.youWillReceive')}</p>
            <p className="text-3xl font-bold text-brand-800 dark:text-brand-400 mt-1">{formatFcfa(merchantReceives)} FCFA</p>
            {resultDiscount > 0 && (
              <p className="text-sm text-gray-500 mt-1">
                {t('merchant.receive.discountApplied').replace('{amount}', formatFcfa(resultDiscount))}
              </p>
            )}
            <p className="text-brand-500 text-sm mt-2">
              {t('merchant.receive.clientEarned').replace('{cashback}', formatCashback((resultCashback ?? cashback) as number).label)}
            </p>
          </div>
          <button
            onClick={() => { setStep('motif'); setPaymentType(null); setAmount(''); setBuyerPhone(''); setBuyerInfo(null); setApplyCashback(false); setSelectedProductId(null) }}
            className="btn-primary"
          >
            {t('merchant.receive.newTransaction')}
          </button>
          <button onClick={() => router.push('/merchant/dashboard')} className="btn-secondary">
            {t('merchant.receive.backToDashboard')}
          </button>
        </div>
      )}
    </div>
  )
}

