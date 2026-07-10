'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { formatFcfa } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import { useLocale } from '@/components/providers/LocaleProvider'

type VoucherInfo = {
  valid: boolean
  code: string
  amount_fcfa: number
  sender_name: string
  note: string | null
  expires_at: string
}

type RedeemedVoucher = {
  id: string
  code: string
  amount_fcfa: number
  fee_fcfa: number
  merchant_fee_fcfa: number
  note: string | null
  redeemed_at: string
  sender: { full_name: string } | null
}

type MerchantInfo = {
  id: string
  subscription_tier: string
  subscription_expires_at: string | null
}

type Step = 'input' | 'confirm' | 'success'

export default function MerchantVouchersPage() {
  const supabase = createClient()
  const { t } = useLocale()

  const [merchant, setMerchant]             = useState<MerchantInfo | null>(null)
  const [tierLoading, setTierLoading]       = useState(true)
  const [step, setStep]                     = useState<Step>('input')
  const [code, setCode]                     = useState('')
  const [looking, setLooking]               = useState(false)
  const [voucher, setVoucher]               = useState<VoucherInfo | null>(null)
  const [lookupError, setLookupError]       = useState('')
  const [redeeming, setRedeeming]           = useState(false)
  const [lastRedemption, setLastRedemption] = useState<{
    amount: number; merchantCredit: number; fee: number; merchantFee: number
  } | null>(null)
  const [history, setHistory]               = useState<RedeemedVoucher[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: m } = await supabase
        .from('merchants')
        .select('id, subscription_tier, subscription_expires_at')
        .eq('user_id', user.id)
        .single()

      if (!m) { setTierLoading(false); return }
      setMerchant(m as MerchantInfo)
      setTierLoading(false)

      const { data } = await supabase
        .from('withdrawal_vouchers')
        .select('id, code, amount_fcfa, fee_fcfa, merchant_fee_fcfa, note, redeemed_at, users!sender_id(full_name)')
        .eq('redeemed_by_merchant_id', m.id)
        .eq('status', 'redeemed')
        .order('redeemed_at', { ascending: false })
        .limit(20)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setHistory((data ?? []).map((v: any) => ({
        id: v.id,
        code: v.code,
        amount_fcfa: v.amount_fcfa,
        fee_fcfa: v.fee_fcfa ?? 0,
        merchant_fee_fcfa: v.merchant_fee_fcfa ?? 0,
        note: v.note,
        redeemed_at: v.redeemed_at,
        sender: Array.isArray(v.users) ? (v.users[0] ?? null) : (v.users ?? null),
      })))
      setLoadingHistory(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isVipActive = (
    merchant !== null &&
    merchant.subscription_tier === 'vip' &&
    merchant.subscription_expires_at !== null &&
    new Date(merchant.subscription_expires_at) > new Date()
  )

  async function handleLookup() {
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) return
    setLooking(true)
    setLookupError('')
    setVoucher(null)
    try {
      const res = await fetch(`/api/vouchers/${encodeURIComponent(trimmed)}`)
      const data = await res.json()
      if (!res.ok) {
        setLookupError(data.error ?? t('merchant.vouchers.verifyError'))
        return
      }
      setVoucher(data)
      setStep('confirm')
    } catch {
      setLookupError(t('merchant.vouchers.networkError'))
    } finally {
      setLooking(false)
    }
  }

  async function handleRedeem() {
    if (!voucher) return
    setRedeeming(true)
    try {
      const res = await fetch('/api/vouchers/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: voucher.code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('common.error'))

      setLastRedemption({
        amount:         data.amount_fcfa,
        merchantCredit: data.merchant_credit,
        fee:            data.fee_fcfa,
        merchantFee:    data.merchant_fee,
      })
      toast.success(
        t('merchant.vouchers.creditedToWallet').replace('{amount}', formatFcfa(data.merchant_credit))
      )

      if (merchant) {
        const { data: newHistory } = await supabase
          .from('withdrawal_vouchers')
          .select('id, code, amount_fcfa, fee_fcfa, merchant_fee_fcfa, note, redeemed_at, users!sender_id(full_name)')
          .eq('redeemed_by_merchant_id', merchant.id)
          .eq('status', 'redeemed')
          .order('redeemed_at', { ascending: false })
          .limit(20)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setHistory((newHistory ?? []).map((v: any) => ({
          id: v.id, code: v.code, amount_fcfa: v.amount_fcfa,
          fee_fcfa: v.fee_fcfa ?? 0, merchant_fee_fcfa: v.merchant_fee_fcfa ?? 0,
          note: v.note, redeemed_at: v.redeemed_at,
          sender: Array.isArray(v.users) ? (v.users[0] ?? null) : (v.users ?? null),
        })))
      }
      setStep('success')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setRedeeming(false)
    }
  }

  function reset() {
    setStep('input')
    setCode('')
    setVoucher(null)
    setLookupError('')
    setLastRedemption(null)
  }

  if (tierLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── VIP Gate ──
  if (!isVipActive) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-5">
        <div className="bg-gradient-to-br from-purple-600 to-amber-500 rounded-3xl p-6 text-white">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎟️</span>
            <div>
              <h1 className="font-bold text-xl leading-none">{t('merchant.vouchers.title')}</h1>
              <p className="text-white/80 text-sm mt-0.5">{t('merchant.vouchers.subtitle')}</p>
            </div>
          </div>
        </div>

        <div className="card space-y-5 text-center py-10">
          <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">👑</span>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{t('merchant.vouchers.vipGateTitle')}</h2>
            <p className="text-gray-500 text-sm mt-2 leading-relaxed max-w-xs mx-auto">
              {t('merchant.vouchers.vipGateDesc')}
            </p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 text-left space-y-2">
            <p className="text-xs font-bold text-purple-700 uppercase tracking-wide mb-3">
              {t('merchant.vouchers.title')}
            </p>
            {([
              { icon: '🎟️', key: 'vipBenefit1' as const },
              { icon: '💰', key: 'vipBenefit2' as const },
              { icon: '📈', key: 'vipBenefit3' as const },
              { icon: '⭐', key: 'vipBenefit4' as const },
            ]).map(item => (
              <div key={item.key} className="flex items-start gap-2 text-sm">
                <span>{item.icon}</span>
                <span className="text-gray-700">{t(`merchant.vouchers.${item.key}`)}</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Link
              href="/merchant/upgrade"
              className="block w-full bg-gradient-to-r from-purple-600 to-amber-500 text-white font-bold py-3.5 rounded-xl text-center hover:opacity-90 transition-opacity"
            >
              {t('merchant.vouchers.vipGateCta')}
            </Link>
            <Link href="/merchant/dashboard" className="block text-sm text-gray-400 text-center hover:text-gray-600 transition-colors">
              {t('merchant.vouchers.vipGateBack')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // ── Main UI (VIP merchants only) ──
  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-br from-purple-600 to-brand-900 rounded-3xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🎟️</span>
            <div>
              <h1 className="font-bold text-xl leading-none">{t('merchant.vouchers.encaisserTitle')}</h1>
              <p className="text-white/70 text-sm mt-0.5">{t('merchant.vouchers.encaisserSubtitle')}</p>
            </div>
          </div>
          <span className="bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-full">
            👑 VIP
          </span>
        </div>
      </div>

      {/* Info banner */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-xs text-purple-700 flex items-start gap-2">
        <span className="text-sm">💰</span>
        <span>{t('merchant.vouchers.commissionInfo')}</span>
      </div>

      {/* Step: input code */}
      {step === 'input' && (
        <div className="card space-y-4">
          <div>
            <label className="label">{t('merchant.vouchers.codeLabel')}</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setLookupError('') }}
                onKeyDown={e => e.key === 'Enter' && handleLookup()}
                placeholder="GF-XXXXXXXX"
                className="input font-mono uppercase tracking-widest text-lg flex-1"
                autoFocus
                autoCapitalize="characters"
                maxLength={12}
              />
              <button
                onClick={handleLookup}
                disabled={looking || !code.trim()}
                className="px-5 bg-brand-600 hover:bg-brand-700 disabled:bg-gray-200 text-white disabled:text-gray-400 font-semibold rounded-xl transition-colors flex items-center gap-1"
              >
                {looking
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : t('merchant.vouchers.verifyBtn')}
              </button>
            </div>
            {lookupError && (
              <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                <span>⚠️</span> {lookupError}
              </p>
            )}
          </div>
          <p className="text-xs text-gray-400">{t('merchant.vouchers.codeHint')}</p>
        </div>
      )}

      {/* Step: confirm */}
      {step === 'confirm' && voucher && (() => {
        const totalFee       = Math.floor(voucher.amount_fcfa * 0.01)
        const cashToGive     = voucher.amount_fcfa - totalFee
        const estMerchantFee = Math.floor(totalFee / 2)
        const gfFee          = estMerchantFee

        return (
          <div className="space-y-4">
            <div className="card border-2 border-brand-400 bg-brand-50 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✅</span>
                <div>
                  <p className="font-bold text-brand-800">{t('merchant.vouchers.validVoucher')}</p>
                  <p className="font-mono text-sm text-brand-600">{voucher.code}</p>
                </div>
              </div>

              <div className="space-y-0">
                <div className="flex justify-between items-center py-2.5 border-b border-brand-200">
                  <span className="text-gray-500 text-sm">{t('merchant.vouchers.voucherValue')}</span>
                  <span className="font-bold text-2xl text-gray-900">{formatFcfa(voucher.amount_fcfa)} FCFA</span>
                </div>
                <div className="flex justify-between items-center py-2.5 border-b border-brand-200">
                  <span className="text-gray-500 text-sm">{t('merchant.vouchers.issuedBy')}</span>
                  <span className="font-semibold text-gray-800">{voucher.sender_name}</span>
                </div>
                {voucher.note && (
                  <div className="flex justify-between items-start py-2.5 border-b border-brand-200">
                    <span className="text-gray-500 text-sm">{t('merchant.vouchers.note')}</span>
                    <span className="text-gray-700 text-sm italic text-right max-w-[60%]">{voucher.note}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-2.5 border-b border-brand-200">
                  <span className="text-gray-500 text-sm">{t('merchant.vouchers.expires')}</span>
                  <span className="text-gray-700 text-sm">
                    {new Date(voucher.expires_at).toLocaleDateString(undefined, {
                      day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
                    })}
                  </span>
                </div>

                <div className="bg-white rounded-xl p-3 mt-2 space-y-1.5">
                  <div className="flex justify-between text-sm border-b border-gray-100 pb-2 mb-2">
                    <span className="text-gray-500">{t('merchant.vouchers.feesPool')}</span>
                    <span className="text-gray-600 font-medium">{formatFcfa(totalFee)} FCFA</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{t('merchant.vouchers.yourFeeEst')}</span>
                    <span className="text-green-500">≈ +{formatFcfa(estMerchantFee)} FCFA</span>
                  </div>
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>{t('merchant.vouchers.gfFee')}</span>
                    <span>≈ {formatFcfa(gfFee)} FCFA</span>
                  </div>
                  <p className="text-xs text-indigo-600 bg-indigo-50 rounded-lg px-2 py-1.5 mt-1">
                    {t('merchant.vouchers.feeNotice')}
                  </p>
                  <div className="border-t border-gray-100 pt-2 mt-1 space-y-1">
                    <div className="flex justify-between font-bold text-amber-700">
                      <span>{t('merchant.vouchers.cashToGive')}</span>
                      <span>{formatFcfa(cashToGive)} FCFA</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                <p className="text-amber-800 text-sm font-medium">{t('merchant.vouchers.identityWarning')}</p>
              </div>
            </div>

            <button
              onClick={handleRedeem}
              disabled={redeeming}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-base transition-colors"
            >
              {redeeming
                ? t('merchant.vouchers.confirmingBtn')
                : t('merchant.vouchers.confirmBtn').replace('{amount}', formatFcfa(cashToGive))}
            </button>
            <button onClick={reset} disabled={redeeming} className="btn-secondary">
              {t('merchant.vouchers.cancelBtn')}
            </button>
          </div>
        )
      })()}

      {/* Step: success */}
      {step === 'success' && lastRedemption && (
        <div className="card text-center space-y-5 py-8">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">✅</span>
          </div>
          <div>
            <h2 className="font-bold text-2xl text-gray-900">{t('merchant.vouchers.successTitle')}</h2>
            <p className="text-gray-500 text-sm mt-1">
              {t('merchant.vouchers.successDesc').replace('{amount}', formatFcfa(lastRedemption.merchantCredit))}
            </p>
          </div>

          <div className="space-y-2">
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <p className="text-amber-800 text-sm font-semibold">{t('merchant.vouchers.handOverCash')}</p>
              <p className="text-3xl font-bold text-amber-900 mt-1">
                {formatFcfa(lastRedemption.amount - lastRedemption.fee)} FCFA
              </p>
              <p className="text-amber-700 text-xs mt-0.5">{t('merchant.vouchers.handOverTo')}</p>
            </div>

            {lastRedemption.merchantFee > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm">
                <p className="text-green-700">
                  {t('merchant.vouchers.vipCommission')}{' '}
                  <strong>+{formatFcfa(lastRedemption.merchantFee)} FCFA</strong>
                </p>
              </div>
            )}
          </div>

          <button onClick={reset} className="btn-primary">
            {t('merchant.vouchers.anotherVoucher')}
          </button>
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3">{t('merchant.vouchers.historyTitle')}</h2>
        {loadingHistory ? (
          <div className="text-center py-6 text-gray-400">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        ) : history.length === 0 ? (
          <div className="card text-center py-8 text-gray-400">
            <p className="text-3xl mb-2">📋</p>
            <p className="text-sm font-medium text-gray-600">{t('merchant.vouchers.historyEmpty')}</p>
            <p className="text-xs mt-1">{t('merchant.vouchers.historyEmptySub')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {history.map(v => (
              <div key={v.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0 text-lg">
                  🎟️
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-xs text-gray-500 truncate">{v.code}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {new Date(v.redeemed_at).toLocaleDateString(undefined, {
                      day: '2-digit', month: 'short', year: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                    {v.sender ? ` · ${v.sender.full_name}` : ''}
                  </p>
                  {v.merchant_fee_fcfa > 0 && (
                    <p className="text-xs text-green-600 mt-0.5">
                      +{formatFcfa(v.merchant_fee_fcfa)} FCFA {t('merchant.vouchers.commissionLabel')}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-green-600 text-sm">
                    +{formatFcfa(v.amount_fcfa - (v.fee_fcfa - v.merchant_fee_fcfa))} F
                  </p>
                  <p className="text-xs text-gray-400">{t('merchant.vouchers.netLabel')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
