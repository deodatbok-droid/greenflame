'use client'

import { useEffect, useState } from 'react'
import type { Locale } from '@/lib/i18n'
import { getTranslations } from '@/lib/i18n'
import { PassPurchaseForm } from './PassPurchaseForm'

const CATEGORY_ICON = '#0F6E56'

const PROPERTY_TYPES = ['appartement', 'maison_villa', 'terrain_parcelle', 'local_commercial', 'bureau'] as const
const LISTING_TYPES  = ['location', 'vente'] as const

interface Alert {
  id: string
  listing_type: typeof LISTING_TYPES[number] | null
  property_type: typeof PROPERTY_TYPES[number] | null
  city: string | null
  neighborhood: string | null
  price_min: number | null
  price_max: number | null
  rooms_min: number | null
  surface_min: number | null
  active: boolean
}

export function AlertsManager({ locale }: { locale: Locale }) {
  const t = getTranslations(locale)
  const [loading, setLoading] = useState(true)
  const [passActive, setPassActive] = useState(false)
  const [alerts, setAlerts] = useState<Alert[]>([])

  const [listingType, setListingType] = useState('')
  const [propertyType, setPropertyType] = useState('')
  const [city, setCity] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [priceMin, setPriceMin] = useState('')
  const [priceMax, setPriceMax] = useState('')
  const [roomsMin, setRoomsMin] = useState('')
  const [surfaceMin, setSurfaceMin] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function refresh() {
    const [passRes, alertsRes] = await Promise.all([
      fetch('/api/immobilier/pass'),
      fetch('/api/immobilier/alertes'),
    ])
    const passJson = await passRes.json().catch(() => ({}))
    const alertsJson = await alertsRes.json().catch(() => [])
    setPassActive(passJson.active === true)
    setAlerts(Array.isArray(alertsJson) ? alertsJson : [])
    setLoading(false)
  }

  useEffect(() => { refresh() }, [])

  async function createAlert() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/immobilier/alertes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        listing_type: listingType || null,
        property_type: propertyType || null,
        city: city.trim() || null,
        neighborhood: neighborhood.trim() || null,
        price_min: priceMin ? Number(priceMin) : null,
        price_max: priceMax ? Number(priceMax) : null,
        rooms_min: roomsMin ? Number(roomsMin) : null,
        surface_min: surfaceMin ? Number(surfaceMin) : null,
      }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(json.error ?? t('immobilier.passErrorGeneric')); return }
    setListingType(''); setPropertyType(''); setCity(''); setNeighborhood('')
    setPriceMin(''); setPriceMax(''); setRoomsMin(''); setSurfaceMin('')
    refresh()
  }

  async function toggleAlert(alert: Alert) {
    await fetch(`/api/immobilier/alertes/${alert.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !alert.active }),
    })
    refresh()
  }

  async function deleteAlert(id: string) {
    await fetch(`/api/immobilier/alertes/${id}`, { method: 'DELETE' })
    refresh()
  }

  if (loading) return <p className="text-sm text-gray-500">{t('immobilier.contactLoading')}</p>

  return (
    <div className="space-y-5">
      {!passActive && (
        <div className="border border-gray-100 rounded-2xl p-4">
          <p className="text-sm font-semibold text-gray-900">{t('immobilier.contactPassRequiredTitle')}</p>
          <p className="text-sm text-gray-500 mt-1 mb-3">{t('immobilier.contactPassRequiredHint')}</p>
          <PassPurchaseForm locale={locale} onSuccess={refresh} />
        </div>
      )}

      {passActive && (
        <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{t('immobilier.alertsCreateTitle')}</h2>

          <div className="grid grid-cols-2 gap-3">
            <select value={listingType} onChange={e => setListingType(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
              <option value="">{t('immobilier.alertsAnyOption')}</option>
              {LISTING_TYPES.map(v => <option key={v} value={v}>{t(`immobilier.${v}`)}</option>)}
            </select>
            <select value={propertyType} onChange={e => setPropertyType(e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
              <option value="">{t('immobilier.alertsAnyOption')}</option>
              {PROPERTY_TYPES.map(v => <option key={v} value={v}>{t(`immobilier.${v}`)}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input value={city} onChange={e => setCity(e.target.value)} placeholder={t('immobilier.filterCity')} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
            <input value={neighborhood} onChange={e => setNeighborhood(e.target.value)} placeholder={t('immobilier.filterCityPlaceholder')} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input type="number" min="0" value={priceMin} onChange={e => setPriceMin(e.target.value)} placeholder={t('immobilier.filterPriceMin')} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
            <input type="number" min="0" value={priceMax} onChange={e => setPriceMax(e.target.value)} placeholder={t('immobilier.filterPriceMax')} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
            <input type="number" min="0" value={roomsMin} onChange={e => setRoomsMin(e.target.value)} placeholder={t('immobilier.filterRoomsMin')} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
            <input type="number" min="0" value={surfaceMin} onChange={e => setSurfaceMin(e.target.value)} placeholder={t('immobilier.filterSurfaceMin')} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            onClick={createAlert}
            disabled={saving}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-60"
            style={{ background: CATEGORY_ICON }}
          >
            {saving ? t('immobilier.alertsSaving') : t('immobilier.alertsSaveCta')}
          </button>
        </div>
      )}

      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">{t('immobilier.alertsListTitle')}</h2>

        {alerts.length === 0 ? (
          <div className="text-center py-10 text-gray-400">
            <p className="text-4xl mb-3">🔔</p>
            <p className="font-semibold text-gray-600">{t('immobilier.alertsEmptyState')}</p>
            <p className="text-sm mt-1">{t('immobilier.alertsEmptyHint')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map(alert => (
              <div key={alert.id} className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    {alert.property_type ? t(`immobilier.${alert.property_type}`) : t('immobilier.alertsSummaryAny')}
                    {alert.listing_type ? ` · ${t(`immobilier.${alert.listing_type}`)}` : ''}
                  </p>
                  {alert.city && <p className="text-xs text-gray-500 mt-0.5">{t('immobilier.alertsSummaryCity').replace('{city}', alert.city)}</p>}
                  <span className={`text-xs font-semibold mt-1 inline-block ${alert.active ? 'text-emerald-600' : 'text-gray-400'}`}>
                    {alert.active ? t('immobilier.alertsStatusActive') : t('immobilier.alertsStatusPaused')}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button onClick={() => toggleAlert(alert)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-700">
                    {alert.active ? t('immobilier.alertsPauseCta') : t('immobilier.alertsResumeCta')}
                  </button>
                  <button onClick={() => deleteAlert(alert.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-red-200 text-red-500">
                    {t('immobilier.alertsDeleteCta')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
