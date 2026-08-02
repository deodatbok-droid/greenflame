'use client'

import { useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { getTranslations } from '@/lib/i18n'

const CATEGORY_ICON = '#0F6E56'

export function PassPurchaseForm({ locale, onSuccess }: { locale: Locale; onSuccess: () => void }) {
  const t = getTranslations(locale)
  const [operator, setOperator] = useState<'mtn_momo' | 'moov_money'>('mtn_momo')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit() {
    if (!phone.trim()) { setError(t('immobilier.passErrorPhoneRequired')); return }
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/immobilier/pass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operator, phone: phone.trim() }),
    })
    const json = await res.json().catch(() => ({}))

    if (res.ok && json.success && !json.pending) {
      setSubmitting(false)
      onSuccess()
      return
    }
    if (res.ok && json.pending) {
      setSubmitting(false)
      setPending(true)
      return
    }
    setSubmitting(false)
    setError(json.error ?? t('immobilier.passErrorGeneric'))
  }

  if (pending) {
    return <p className="text-sm text-gray-600">{t('immobilier.passSubmitting')}</p>
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{t('immobilier.passOperatorLabel')}</label>
        <select
          value={operator}
          onChange={e => setOperator(e.target.value as 'mtn_momo' | 'moov_money')}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
        >
          <option value="mtn_momo">{t('immobilier.passOperatorMtn')}</option>
          <option value="moov_money">{t('immobilier.passOperatorMoov')}</option>
        </select>
      </div>
      <div>
        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">{t('immobilier.passPhoneLabel')}</label>
        <input
          type="tel"
          value={phone}
          onChange={e => setPhone(e.target.value)}
          placeholder={t('immobilier.passPhonePlaceholder')}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
        />
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <button
        onClick={submit}
        disabled={submitting}
        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
        style={{ background: CATEGORY_ICON }}
      >
        {submitting ? t('immobilier.passSubmitting') : t('immobilier.passSubmitCta')}
      </button>
    </div>
  )
}
