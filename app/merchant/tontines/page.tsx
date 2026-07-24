'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatFcfa } from '@/lib/utils/format'
import toast from 'react-hot-toast'
import { useLocale } from '@/components/providers/LocaleProvider'

type DeliveryStatus = 'en_attente' | 'prepare' | 'livre' | 'annule'

type DeliveryOrder = {
  id: string
  cycle_number: number
  membre_id: string
  status: DeliveryStatus
  notified_at: string | null
  delivered_at: string | null
  notes: string | null
  created_at: string
}

type Membre = {
  id: string
  full_name: string
  position: number
  has_received_pot: boolean
  status: string
}

type TontineSummary = {
  id: string
  name: string
  contribution_amount_fcfa: number
  frequency: string
  status: string
  start_date: string
  created_at: string
  tontine_membres: Membre[]
}

type TontineProduct = {
  id: string
  tontine_id: string
  product_id: string
  product_name: string
  unit_price_fcfa: number
  validated_at: string | null
  stock_committed: boolean
  created_at: string
  tontines: TontineSummary
  tontine_delivery_orders: DeliveryOrder[]
}

export default function MerchantTontinesPage() {
  const router = useRouter()
  const { t } = useLocale()
  const [items, setItems] = useState<TontineProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)

  const DELIVERY_LABELS: Record<DeliveryStatus, { label: string; icon: string; classes: string; next: DeliveryStatus | null }> = {
    en_attente: { label: t('merchant.tontines.deliveryEnAttente'), icon: '⏳', classes: 'bg-gray-50 text-gray-500 border-gray-200',   next: 'prepare' },
    prepare:    { label: t('merchant.tontines.deliveryPrepare'),   icon: '📦', classes: 'bg-amber-50 text-amber-700 border-amber-200', next: 'livre' },
    livre:      { label: t('merchant.tontines.deliveryLivre'),     icon: '✅', classes: 'bg-green-50 text-green-700 border-green-200', next: null },
    annule:     { label: t('merchant.tontines.deliveryAnnule'),    icon: '🚫', classes: 'bg-red-50 text-red-600 border-red-200',       next: null },
  }

  const FREQ_LABELS: Record<string, string> = {
    hebdomadaire: t('tontine.frequencyWeekly'),
    bimensuel:    t('tontine.frequencyBimonthly'),
    mensuel:      t('tontine.frequencyMonthly'),
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/merchant/tontines')
      const data = await res.json()
      if (res.ok) setItems(data as TontineProduct[])
    } catch {
      // silencieux
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const selected = items.find(i => i.tontine_id === selectedId) ?? null
  const pending = items.filter(i => !i.validated_at)
  const active  = items.filter(i => !!i.validated_at)

  async function validate(tontineId: string) {
    if (!confirm(t('merchant.tontines.validateConfirm'))) return
    setSaving(tontineId)
    try {
      const res = await fetch(`/api/tontines/${tontineId}/product`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      toast.success(t('merchant.tontines.tontineValidated'))
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(null)
    }
  }

  async function advanceDelivery(tontineId: string, order: DeliveryOrder) {
    const next = DELIVERY_LABELS[order.status].next
    if (!next) return
    setSaving(order.id)
    try {
      const res = await fetch(`/api/tontines/${tontineId}/product`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delivery_update', delivery_order_id: order.id, status: next }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      toast.success(`${t('merchant.tontines.deliveryUpdated')} : ${DELIVERY_LABELS[next].label}`)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-5">

      {/* Header */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-900 rounded-3xl p-6 text-white">
        <button
          onClick={() => selected ? setSelectedId(null) : router.back()}
          className="text-brand-200 text-sm hover:text-white flex items-center gap-1 mb-3"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
          </svg>
          {t('merchant.tontines.back')}
        </button>
        <div className="flex items-center gap-3">
          <span className="text-3xl">🛒</span>
          <div>
            <h1 className="font-bold text-xl leading-none">
              {selected ? selected.product_name : t('merchant.tontines.title')}
            </h1>
            <p className="text-brand-200 text-sm mt-0.5">
              {selected
                ? `${selected.tontines?.tontine_membres?.length ?? 0} ${t('merchant.tontines.participants')} · ${formatFcfa(selected.unit_price_fcfa)} FCFA`
                : `${pending.length} ${t('merchant.tontines.pendingSection').toLowerCase()} · ${active.length} ${t('merchant.tontines.activeSection').toLowerCase()}`}
            </p>
          </div>
        </div>
      </div>

      {/* ═══ VUE LISTE ═══ */}
      {!selected && (
        <>
          {loading && (
            <div className="text-center py-10 text-gray-500">
              <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">{t('merchant.tontines.loading')}</p>
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="card text-center py-10 text-gray-500">
              <p className="text-4xl mb-3">🛒</p>
              <p className="font-medium text-gray-600">{t('merchant.tontines.empty')}</p>
              <p className="text-xs mt-1">{t('merchant.tontines.emptyHint')}</p>
            </div>
          )}

          {/* Validations en attente */}
          {pending.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-amber-700 px-1 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                {t('merchant.tontines.pendingSection')} ({pending.length})
              </h2>
              {pending.map(item => (
                <div
                  key={item.tontine_id}
                  className="bg-white rounded-2xl border-2 border-amber-200 p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{item.product_name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {item.tontines?.name} · {item.tontines?.tontine_membres?.length ?? 0} {t('merchant.tontines.participants').toLowerCase()} · {FREQ_LABELS[item.tontines?.frequency] ?? '—'}
                      </p>
                      <p className="text-sm font-semibold text-brand-700 mt-1">
                        {formatFcfa(item.tontines?.contribution_amount_fcfa ?? 0)} FCFA / {t('merchant.tontines.cotisationPerCycle').toLowerCase()}
                      </p>
                    </div>
                    <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full font-semibold flex-shrink-0">{t('merchant.tontines.toValidate')}</span>
                  </div>
                  <p className="text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-2">
                    {t('merchant.tontines.confirmDelivery')
                      .replace('{count}', String(item.tontines?.tontine_membres?.length ?? 0))
                      .replace('{product}', item.product_name)}
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setSelectedId(item.tontine_id)}
                      className="flex-1 py-2 rounded-xl text-sm font-semibold border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                    >
                      {t('merchant.tontines.seeDetail')}
                    </button>
                    <button
                      onClick={() => validate(item.tontine_id)}
                      disabled={saving === item.tontine_id}
                      className="flex-1 py-2 rounded-xl text-sm font-bold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {saving === item.tontine_id ? '…' : t('merchant.tontines.validateStock')}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Tontines actives */}
          {active.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-xs font-bold uppercase tracking-widest text-green-700 px-1">
                {t('merchant.tontines.activeSection')} ({active.length})
              </h2>
              {active.map(item => {
                const orders = item.tontine_delivery_orders ?? []
                const enAttente = orders.filter(o => o.status === 'en_attente').length
                const livre = orders.filter(o => o.status === 'livre').length
                return (
                  <button
                    key={item.tontine_id}
                    onClick={() => setSelectedId(item.tontine_id)}
                    className="w-full text-left bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-brand-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-gray-900">{item.product_name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{item.tontines?.name} · {item.tontines?.tontine_membres?.length ?? 0} {t('merchant.tontines.participants').toLowerCase()}</p>
                      </div>
                      <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-1 rounded-full font-semibold flex-shrink-0">{t('merchant.tontines.validated')}</span>
                    </div>
                    {orders.length > 0 && (
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500">
                        <span>📦 {enAttente} {t('merchant.tontines.pendingDeliveries')}</span>
                        <span>✅ {livre} {t('merchant.tontines.deliveredCount')}</span>
                        <span className="ml-auto text-brand-600 font-semibold">{t('merchant.tontines.manageLivraisons')}</span>
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ═══ VUE DÉTAIL ═══ */}
      {selected && (() => {
        const membres = [...(selected.tontines?.tontine_membres ?? [])].sort((a, b) => a.position - b.position)
        const orders  = [...(selected.tontine_delivery_orders ?? [])].sort((a, b) => a.cycle_number - b.cycle_number)

        return (
          <div className="space-y-4">
            {/* Statut validation */}
            {!selected.validated_at && (
              <div className="card bg-amber-50 border-amber-200 space-y-3">
                <p className="text-sm text-amber-800 font-medium">
                  {t('merchant.tontines.validationWarning')}
                </p>
                <button
                  onClick={() => validate(selected.tontine_id)}
                  disabled={saving === selected.tontine_id}
                  className="w-full py-3 rounded-xl text-sm font-bold bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving === selected.tontine_id ? '…' : t('merchant.tontines.confirmStock')}
                </button>
              </div>
            )}

            {/* Infos produit */}
            <div className="card">
              <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wide">{t('merchant.tontines.resume')}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('merchant.tontines.product')}</span>
                  <span className="font-semibold text-gray-900">{selected.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('merchant.tontines.unitPrice')}</span>
                  <span className="font-semibold">{formatFcfa(selected.unit_price_fcfa)} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('merchant.tontines.participants')}</span>
                  <span className="font-semibold">{membres.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('merchant.tontines.cotisationPerCycle')}</span>
                  <span className="font-semibold">{formatFcfa(selected.tontines?.contribution_amount_fcfa ?? 0)} FCFA</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('merchant.tontines.frequency')}</span>
                  <span className="font-semibold">{FREQ_LABELS[selected.tontines?.frequency] ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">{t('merchant.tontines.unitsToDeliver')}</span>
                  <span className="font-bold text-brand-700">{membres.length}</span>
                </div>
              </div>
            </div>

            {/* Liste des membres / ordre de tirage */}
            <div className="card">
              <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wide">{t('merchant.tontines.deliveryOrder')}</p>
              <div className="space-y-2">
                {membres.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                      m.has_received_pot ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {m.position}
                    </span>
                    <p className="text-sm text-gray-800 flex-1">{m.full_name}</p>
                    {m.has_received_pot && <span className="text-xs text-green-600 font-semibold">{t('merchant.tontines.received')}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Bons de livraison */}
            {orders.length > 0 && (
              <div className="card">
                <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wide">{t('merchant.tontines.deliveryOrders')}</p>
                <div className="space-y-3">
                  {orders.map(o => {
                    const cfg = DELIVERY_LABELS[o.status]
                    const winner = membres.find(m => m.id === o.membre_id)
                    const canAdvance = !!cfg.next
                    return (
                      <div key={o.id} className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-7 h-7 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {o.cycle_number}
                          </span>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{winner?.full_name ?? '—'}</p>
                            {o.delivered_at && (
                              <p className="text-xs text-gray-500">
                                {new Date(o.delivered_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => canAdvance ? advanceDelivery(selected.tontine_id, o) : undefined}
                          disabled={!canAdvance || saving === o.id}
                          className={`text-xs font-semibold px-2.5 py-1.5 rounded-full border flex-shrink-0 transition-colors disabled:opacity-50 ${
                            canAdvance ? `${cfg.classes} hover:opacity-75 cursor-pointer` : `${cfg.classes} cursor-default`
                          }`}
                        >
                          {saving === o.id ? '…' : `${cfg.icon} ${cfg.label}`}
                          {canAdvance && <span className="ml-1 opacity-60">→</span>}
                        </button>
                      </div>
                    )
                  })}
                </div>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  {t('merchant.tontines.clickAdvance')}
                </p>
              </div>
            )}

            {orders.length === 0 && selected.validated_at && (
              <div className="card bg-gray-50 border-gray-200 text-center py-6">
                <p className="text-2xl mb-2">📦</p>
                <p className="text-sm text-gray-500">{t('merchant.tontines.noBonYet')}</p>
              </div>
            )}
          </div>
        )
      })()}
    </div>
  )
}
