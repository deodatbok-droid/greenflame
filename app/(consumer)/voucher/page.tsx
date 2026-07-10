'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { formatFcfa } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import PhoneInput from '@/components/ui/PhoneInput'
import { useLocale } from '@/components/providers/LocaleProvider'

const MIN_AMOUNT = 500

type VoucherStatus = 'active' | 'redeemed' | 'expired' | 'cancelled'

type Voucher = {
  id: string
  code: string
  amount_fcfa: number
  status: VoucherStatus
  note: string | null
  expires_at: string
  created_at: string
  redeemed_at: string | null
  recipient_phone: string | null
  merchants: { business_name: string } | null
}

export default function VoucherPage() {
  const supabase = createClient()
  const router = useRouter()
  const { t, locale } = useLocale()
  const dateLocale = locale === 'en' ? 'en-US' : 'fr-FR'

  const STATUS_CONFIG: Record<VoucherStatus, { label: string; icon: string; classes: string }> = {
    active:    { label: t('voucher.status.active'),    icon: '✅', classes: 'bg-green-50 text-green-700 border-green-200' },
    redeemed:  { label: t('voucher.status.redeemed'),  icon: '✔️', classes: 'bg-gray-50 text-gray-500 border-gray-200' },
    expired:   { label: t('voucher.status.expired'),   icon: '⏰', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
    cancelled: { label: t('voucher.status.cancelled'), icon: '🚫', classes: 'bg-red-50 text-red-600 border-red-200' },
  }

  const [balance, setBalance] = useState<number | null>(null)
  const [vouchers, setVouchers] = useState<Voucher[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [cancelling, setCancelling] = useState<string | null>(null)

  // Form state
  const [amount, setAmount]               = useState('')
  const [note, setNote]                   = useState('')
  const [recipientPhone, setRecipientPhone] = useState('')
  const [recipientName, setRecipientName]   = useState<string | null>(null)
  const [phoneChecking, setPhoneChecking]   = useState(false)
  const [phoneValid, setPhoneValid]         = useState<boolean | null>(null)
  const [showForm, setShowForm] = useState(false)

  // Copied code feedback
  const [copiedCode, setCopiedCode] = useState<string | null>(null)

  const amountNum = parseInt(amount.replace(/\D/g, '')) || 0
  const phoneRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [walletRes, vouchersRes] = await Promise.all([
      supabase
        .from('wallets')
        .select('balance_fcfa')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('withdrawal_vouchers')
        .select('id, code, amount_fcfa, status, note, expires_at, created_at, redeemed_at, recipient_phone, merchants(business_name)')
        .eq('sender_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30),
    ])

    setBalance(walletRes.data?.balance_fcfa ?? 0)
    setVouchers((vouchersRes.data ?? []) as unknown as Voucher[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  // Debounced phone lookup
  useEffect(() => {
    const cleaned = recipientPhone.replace(/\D/g, '')
    if (cleaned.length < 8) {
      setPhoneValid(null)
      setRecipientName(null)
      return
    }

    if (phoneRef.current) clearTimeout(phoneRef.current)
    phoneRef.current = setTimeout(async () => {
      setPhoneChecking(true)
      try {
        const res = await fetch(`/api/vouchers/create?phone=${cleaned}`)
        const data = await res.json()
        setPhoneValid(data.valid === true)
        setRecipientName(data.valid ? data.name : null)
      } catch {
        setPhoneValid(null)
      } finally {
        setPhoneChecking(false)
      }
    }, 600)
  }, [recipientPhone])

  function resetForm() {
    setShowForm(false)
    setAmount('')
    setNote('')
    setRecipientPhone('')
    setRecipientName(null)
    setPhoneValid(null)
  }

  async function handleCreate() {
    if (amountNum < MIN_AMOUNT) {
      toast.error(`${t('voucher.minimum')} : ${MIN_AMOUNT} FCFA`)
      return
    }
    if (balance !== null && amountNum > balance) {
      toast.error(t('voucher.insufficient'))
      return
    }
    if (!recipientPhone.trim()) {
      toast.error(t('voucher.recipientPhone'))
      return
    }
    if (phoneValid === false) {
      toast.error(t('voucher.recipientNotFound'))
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/vouchers/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amountFcfa:     amountNum,
          note:           note.trim() || null,
          recipientPhone: recipientPhone.replace(/\D/g, ''),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('common.error'))
      toast.success(`${t('voucher.create')} ! ${t('voucher.recipient')} : ${data.recipientName ?? '✓'}`)
      resetForm()
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setCreating(false)
    }
  }

  async function handleCancel(voucherId: string) {
    setCancelling(voucherId)
    try {
      const res = await fetch('/api/vouchers/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voucherId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t('common.error'))
      toast.success(t('voucher.cancelVoucher'))
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : t('common.error'))
    } finally {
      setCancelling(null)
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code)
      toast.success(t('profile.linkCopied'))
      setTimeout(() => setCopiedCode(null), 2000)
    })
  }

  function shareCode(voucher: Voucher) {
    const expires = new Date(voucher.expires_at).toLocaleDateString(dateLocale, {
      day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
    })
    const text = locale === 'en'
      ? `Here is my GreenFlame withdrawal voucher 🔥\n\nCode: ${voucher.code}\nAmount: ${formatFcfa(voucher.amount_fcfa)} FCFA\nValid until ${expires}\n\nGo to a GreenFlame VIP merchant to redeem this voucher.`
      : `Voici mon bon de retrait GreenFlame 🔥\n\nCode : ${voucher.code}\nMontant : ${formatFcfa(voucher.amount_fcfa)} FCFA\nValide jusqu'au ${expires}\n\nRends-toi chez un marchand GreenFlame VIP pour encaisser ce bon.`
    if (navigator.share) {
      navigator.share({ text }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text)
      toast.success(t('profile.linkCopied'))
    }
  }

  const canCreate = (
    amountNum >= MIN_AMOUNT &&
    (balance === null || amountNum <= balance) &&
    recipientPhone.replace(/\D/g, '').length >= 8 &&
    phoneValid === true
  )

  const activeVouchers   = vouchers.filter(v => v.status === 'active')
  const inactiveVouchers = vouchers.filter(v => v.status !== 'active')

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-900 rounded-3xl p-6 text-white">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => router.back()} className="text-brand-200 text-sm hover:text-white flex items-center gap-1">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" /></svg>
            {t('common.back')}
          </button>
        </div>
        <div className="flex items-center gap-3 mb-1">
          <span className="text-3xl">🎟️</span>
          <div>
            <h1 className="font-bold text-xl leading-none">{t('voucher.title')}</h1>
            <p className="text-brand-200 text-sm mt-0.5">{t('voucher.subtitle')}</p>
          </div>
        </div>

        {balance !== null && (
          <div className="mt-4 bg-white/10 rounded-2xl p-4">
            <p className="text-brand-200 text-xs mb-0.5">{t('voucher.balanceAvailable')}</p>
            <p className="text-white text-2xl font-bold">{formatFcfa(balance)} FCFA</p>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="card bg-amber-50 border-amber-200">
        <h2 className="font-semibold text-amber-800 text-sm mb-2">{t('voucher.howItWorks')}</h2>
        <ol className="text-xs text-amber-700 space-y-1 list-decimal list-inside">
          {locale === 'en' ? (
            <>
              <li>Create a voucher with the amount and the recipient&apos;s GreenFlame number</li>
              <li>Share the code — only GreenFlame members can redeem it</li>
              <li>They go to a GreenFlame VIP merchant with the code</li>
              <li>The merchant redeems the voucher and gives them the cash</li>
            </>
          ) : (
            <>
              <li>Créez un bon avec le montant et le numéro GreenFlame du destinataire</li>
              <li>Partagez le code — uniquement les membres GreenFlame peuvent l&apos;encaisser</li>
              <li>Elle se rend chez un marchand GreenFlame VIP avec le code</li>
              <li>Le marchand encaisse le bon et lui remet le cash correspondant</li>
            </>
          )}
        </ol>
      </div>

      {/* Create button / form */}
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-colors"
        >
          <span className="text-xl">+</span>
          {t('voucher.createNew')}
        </button>
      ) : (
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900">{t('voucher.newVoucher')}</h2>
            <button
              onClick={resetForm}
              className="text-gray-400 hover:text-gray-600 text-xl font-medium"
            >
              ×
            </button>
          </div>

          {/* Montant */}
          <div>
            <label className="label">{t('voucher.amount')} <span className="text-red-500">*</span></label>
            <input
              type="number"
              inputMode="numeric"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder={`${t('voucher.minimum')} ${MIN_AMOUNT} FCFA`}
              className="input"
              min={MIN_AMOUNT}
            />
            {amountNum > 0 && balance !== null && amountNum > balance && (
              <p className="text-red-500 text-xs mt-1">{t('voucher.insufficient')} ({t('voucher.balanceAvailable')} : {formatFcfa(balance)} FCFA)</p>
            )}
          </div>

          {/* Téléphone destinataire */}
          <div>
            <label className="label">
              {t('voucher.recipientPhone')} <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <PhoneInput
                value={recipientPhone}
                onChange={setRecipientPhone}
                placeholder="97 00 00 00"
                className={
                  phoneValid === true
                    ? 'border-green-400 bg-green-50'
                    : phoneValid === false
                    ? 'border-red-400 bg-red-50'
                    : ''
                }
              />
              {phoneChecking && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
              )}
              {!phoneChecking && phoneValid === true && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500">✓</span>
              )}
              {!phoneChecking && phoneValid === false && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500">✗</span>
              )}
            </div>

            {/* Feedback destinataire */}
            {phoneValid === true && recipientName && (
              <div className="mt-1.5 flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                <span className="text-green-600 text-sm">✅</span>
                <div>
                  <p className="text-xs font-semibold text-green-800">{recipientName}</p>
                  <p className="text-xs text-green-600">{t('voucher.recipientConfirmed')}</p>
                </div>
              </div>
            )}
            {phoneValid === false && (
              <div className="mt-1.5 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <span className="text-red-600 text-sm">❌</span>
                <p className="text-xs text-red-700">
                  {t('voucher.recipientNotFound')}{' '}
                  <span className="font-semibold">{t('voucher.recipientNotFoundHint')}</span>
                </p>
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {t('voucher.membersOnly')}
            </p>
          </div>

          {/* Note */}
          <div>
            <label className="label">{t('voucher.noteOptional')}</label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('voucher.notePlaceholder')}
              className="input"
              maxLength={120}
            />
          </div>

          {/* Récapitulatif */}
          {amountNum >= MIN_AMOUNT && (
            <div className="bg-brand-50 rounded-xl p-3 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">{t('voucher.amountReserved')}</span>
                <span className="font-semibold text-red-500">−{formatFcfa(amountNum)} FCFA</span>
              </div>
              {recipientName && (
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('voucher.recipient')}</span>
                  <span className="font-semibold text-gray-800">{recipientName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">{t('voucher.validity')}</span>
                <span className="font-semibold">48h</span>
              </div>
              <div className="flex justify-between text-xs text-gray-400 pt-1 border-t border-brand-100 mt-1">
                <span>{t('voucher.fees')}</span>
                <span>{t('voucher.feesDetail')}</span>
              </div>
              <p className="text-xs text-gray-400">
                {t('voucher.refundOnCancel')}
              </p>
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || !canCreate}
            className="btn-primary disabled:opacity-50"
          >
            {creating ? t('voucher.creating') : `${t('voucher.create')} — ${formatFcfa(amountNum)} FCFA`}
          </button>
        </div>
      )}

      {/* Active vouchers */}
      {!loading && activeVouchers.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">{t('voucher.activeVouchers')} ({activeVouchers.length})</h2>
          <div className="space-y-3">
            {activeVouchers.map(voucher => {
              const expiresAt = new Date(voucher.expires_at)
              const hoursLeft = Math.max(0, Math.round((expiresAt.getTime() - Date.now()) / 3600000))
              const isUrgent  = hoursLeft <= 6
              return (
                <div
                  key={voucher.id}
                  className={`rounded-2xl border-2 p-4 space-y-3 ${
                    isUrgent ? 'border-amber-400 bg-amber-50' : 'border-brand-400 bg-brand-50'
                  }`}
                >
                  {/* Amount + status */}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-2xl font-bold text-gray-900">{formatFcfa(voucher.amount_fcfa)} FCFA</p>
                      {voucher.note && (
                        <p className="text-xs text-gray-500 mt-0.5 italic">{voucher.note}</p>
                      )}
                      {voucher.recipient_phone && (
                        <p className="text-xs text-gray-500 mt-0.5">📱 {t('voucher.recipient')} : {voucher.recipient_phone}</p>
                      )}
                    </div>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${STATUS_CONFIG.active.classes}`}>
                      {STATUS_CONFIG.active.icon} {STATUS_CONFIG.active.label}
                    </span>
                  </div>

                  {/* Code block — prominent */}
                  <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide font-medium">{t('voucher.code')}</p>
                    <p className="text-2xl font-mono font-bold tracking-widest text-gray-900 select-all">
                      {voucher.code}
                    </p>
                  </div>

                  {/* Expiry */}
                  <p className={`text-xs font-medium ${isUrgent ? 'text-amber-700' : 'text-gray-500'}`}>
                    {isUrgent ? '⚠️ ' : '⏱ '}
                    {t('voucher.expires')} {isUrgent && hoursLeft === 0 ? t('voucher.expireSoon') : `${t('voucher.expiresIn')} ${hoursLeft}h`}
                    {' · '}
                    {expiresAt.toLocaleDateString(dateLocale, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => copyCode(voucher.code)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold transition-colors ${
                        copiedCode === voucher.code
                          ? 'bg-green-500 text-white'
                          : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {copiedCode === voucher.code ? t('voucher.copied') : `📋 ${t('voucher.copyCode')}`}
                    </button>
                    <button
                      onClick={() => shareCode(voucher)}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold bg-brand-600 text-white hover:bg-brand-700 transition-colors"
                    >
                      📤 {t('voucher.share')}
                    </button>
                  </div>

                  <button
                    onClick={() => handleCancel(voucher.id)}
                    disabled={cancelling === voucher.id}
                    className="w-full py-2 rounded-xl text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
                  >
                    {cancelling === voucher.id ? t('voucher.cancelling') : `🚫 ${t('voucher.cancelVoucher')}`}
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Empty state for active */}
      {!loading && activeVouchers.length === 0 && inactiveVouchers.length === 0 && (
        <div className="card text-center py-10 text-gray-400">
          <p className="text-4xl mb-3">🎟️</p>
          <p className="font-medium text-gray-600">{t('voucher.noVouchers')}</p>
          <p className="text-xs mt-1">{t('voucher.noVouchersHint')}</p>
        </div>
      )}

      {/* History */}
      {inactiveVouchers.length > 0 && (
        <div>
          <h2 className="font-semibold text-gray-900 mb-3">{t('wallet.history')}</h2>
          <div className="space-y-2">
            {inactiveVouchers.map(voucher => {
              const cfg = STATUS_CONFIG[voucher.status]
              const date = new Date(voucher.redeemed_at ?? voucher.created_at).toLocaleDateString(dateLocale, {
                day: '2-digit', month: 'short', year: 'numeric',
              })
              const merchant = voucher.merchants
              return (
                <div key={voucher.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 text-lg">
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-mono text-xs text-gray-400 truncate">{voucher.code}</p>
                      <span className={`text-xs px-1.5 py-0.5 rounded-md border font-medium ${cfg.classes}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {date}
                      {merchant ? ` · ${merchant.business_name}` : ''}
                      {voucher.note ? ` · ${voucher.note}` : ''}
                    </p>
                  </div>
                  <p className="font-bold text-gray-700 flex-shrink-0 text-sm">
                    {formatFcfa(voucher.amount_fcfa)} F
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {loading && (
        <div className="text-center py-10 text-gray-400">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm">{t('common.loading')}</p>
        </div>
      )}
    </div>
  )
}
