'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import Link from 'next/link'
import { useLocale } from '@/components/providers/LocaleProvider'

export default function MerchantActivateForm() {
  const router = useRouter()
  const { t } = useLocale()

  const CATEGORIES = [
    { code: 'ALIMENTATION',   label: t('merchantActivate.catAlimentation'), emoji: '🛒' },
    { code: 'RESTAURANT',     label: t('merchantActivate.catRestauration'), emoji: '🍽️' },
    { code: 'BEAUTE',         label: t('merchantActivate.catBeaute'),        emoji: '💄' },
    { code: 'PHARMACIE',      label: t('merchantActivate.catSante'),         emoji: '💊' },
    { code: 'ELECTRONIQUE',   label: t('merchantActivate.catElectronique'),  emoji: '📱' },
    { code: 'VETEMENTS',      label: t('merchantActivate.catVetements'),     emoji: '👗' },
    { code: 'SERVICES',       label: t('merchantActivate.catServices'),      emoji: '🔧' },
    { code: 'TRANSPORT_SMALL',label: t('merchantActivate.catCarburant'),     emoji: '⛽' },
  ]

  const [businessName, setBusinessName] = useState('')
  const [businessCategory, setBusinessCategory] = useState('')
  const [addressText, setAddressText] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [qrCode, setQrCode] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!businessName.trim()) { toast.error(t('merchantActivate.businessNameLabel').replace(' *', '')); return }
    if (!businessCategory) { toast.error(t('merchantActivate.chooseCategory')); return }
    setLoading(true)

    const res = await fetch('/api/merchants/activate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessName, businessCategory, addressText }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) { toast.error(data.error ?? t('merchantActivate.error')); return }
    setQrCode(data.qrCode ?? null)
    setDone(true)
    toast.success(t('merchantActivate.successTitle'))
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4 max-w-sm w-full">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">🏪</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">{t('merchantActivate.successTitle')}</h2>
          <p className="text-gray-500 text-sm">{t('merchantActivate.successDesc')}</p>
          {qrCode && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mx-auto w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrCode} alt="QR Code marchand" className="w-56 h-56 rounded-xl" />
            </div>
          )}
          <button
            onClick={() => router.push('/merchant/products')}
            className="w-full bg-brand-600 text-white font-bold py-3 rounded-xl hover:bg-brand-700 transition-colors"
          >
            {t('merchantActivate.successAddProducts')}
          </button>
          <button
            onClick={() => router.push('/merchant/dashboard')}
            className="w-full border border-gray-200 text-gray-600 font-medium py-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            {t('merchantActivate.successGoToDashboard')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-600 to-brand-800 flex flex-col items-center justify-center p-6">
      <div className="mb-6 text-center">
        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-xl">
          <span className="text-3xl">🏪</span>
        </div>
        <h1 className="text-2xl font-bold text-white">{t('merchantActivate.title')}</h1>
        <p className="text-brand-100 text-sm mt-1">{t('merchantActivate.subtitle')}</p>
      </div>

      <div className="card w-full max-w-sm space-y-5">
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="label">{t('merchantActivate.businessNameLabel')}</label>
            <input
              type="text"
              value={businessName}
              onChange={e => setBusinessName(e.target.value)}
              placeholder={t('merchantActivate.businessNamePlaceholder')}
              className="input"
              autoFocus
            />
          </div>

          <div>
            <label className="label">{t('merchantActivate.categoryLabel')}</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(cat => (
                <button
                  key={cat.code}
                  type="button"
                  onClick={() => setBusinessCategory(cat.code)}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left text-xs font-medium transition-colors ${
                    businessCategory === cat.code
                      ? 'bg-brand-600 border-brand-500 text-white'
                      : 'bg-gray-50 border-gray-200 text-gray-700 hover:border-brand-300'
                  }`}
                >
                  <span className="text-lg">{cat.emoji}</span>
                  <span className="leading-tight">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="label">{t('merchantActivate.quartierLabel')}</label>
            <input
              type="text"
              value={addressText}
              onChange={e => setAddressText(e.target.value)}
              placeholder={t('merchantActivate.quartierPlaceholder')}
              className="input"
            />
          </div>

          <p className="text-xs text-gray-500">{t('merchantActivate.commissionNote')}</p>

          <button type="submit" disabled={loading || !businessName || !businessCategory} className="btn-primary">
            {loading ? t('merchantActivate.submitting') : t('merchantActivate.submit')}
          </button>
        </form>

        <Link href="/dashboard" className="block text-center text-sm text-gray-500 hover:text-gray-700">
          {t('merchant.tools.backToDashboard')}
        </Link>
      </div>
    </div>
  )
}
