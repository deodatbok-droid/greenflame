'use client'

import { useState } from 'react'
import Link from 'next/link'
import ContactButton from '@/components/messaging/ContactButton'

const RARITY_STYLE: Record<string, string> = {
  commun:     'bg-gray-100 text-gray-600',
  rare:       'bg-blue-100 text-blue-700',
  épique:     'bg-purple-100 text-purple-700',
  légendaire: 'bg-yellow-100 text-yellow-800',
}

const TIER_EMOJI: Record<string, string> = { bronze: '🥉', argent: '🥈', or: '🥇' }

function formatFcfa(n: number) { return new Intl.NumberFormat('fr-FR').format(n) + ' F' }
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// ─── Tracker de commande ───────────────────────────────────────────────────
type StepKey = 'paid' | 'preparing' | 'in_transit' | 'delivered'

interface StepInfo {
  key: StepKey
  label: string
  sublabel?: string
  icon: string
}

const DELIVERY_STEPS: StepInfo[] = [
  { key: 'paid',       label: 'Payé',         icon: '✅' },
  { key: 'preparing',  label: 'Préparation',   icon: '📦' },
  { key: 'in_transit', label: 'En route',      icon: '🚴' },
  { key: 'delivered',  label: 'Livré',         icon: '🏠' },
]

const PICKUP_STEPS: StepInfo[] = [
  { key: 'paid',      label: 'Payé',        icon: '✅' },
  { key: 'preparing', label: 'Préparation', icon: '📦' },
  { key: 'delivered', label: 'Récupéré',    icon: '🤝' },
]

function getActiveStep(tx: any, deliveryOrder: any): number {
  const { status, escrow_status, delivery_type } = tx
  if (delivery_type !== 'delivery') {
    // Pickup : payé→préparation→récupéré (simplifié)
    if (status === 'completed') return 2
    return 1
  }
  // Delivery avec escrow
  if (!deliveryOrder) {
    if (escrow_status === 'held') return 1 // en préparation
    if (status === 'completed')   return 3 // libéré
    return 0
  }
  const ds = deliveryOrder.status
  if (ds === 'delivered' || escrow_status === 'released' || status === 'completed') return 3
  if (ds === 'in_transit' || ds === 'picked_up') return 2
  if (ds === 'assigned')           return 1
  if (ds === 'pending_assignment') return 1
  return 0
}

function OrderTracker({ tx, deliveryOrder }: { tx: any; deliveryOrder: any }) {
  const isDelivery = tx.delivery_type === 'delivery'
  const steps = isDelivery ? DELIVERY_STEPS : PICKUP_STEPS
  const activeStep = getActiveStep(tx, deliveryOrder)
  const isDisputed = tx.status === 'disputed'

  if (isDisputed) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
        ⚠ Litige en cours — notre équipe vous contactera par WhatsApp.
      </div>
    )
  }

  return (
    <div className="mt-3">
      {/* Barre de progression */}
      <div className="flex items-center">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center flex-1 last:flex-none">
            {/* Cercle */}
            <div className={`relative w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm transition-all ${
              i < activeStep  ? 'bg-green-500 shadow-sm' :
              i === activeStep ? 'bg-brand-600 ring-4 ring-brand-100 shadow-sm' :
              'bg-gray-100'
            }`}>
              {i < activeStep ? (
                <span className="text-white text-xs">✓</span>
              ) : (
                <span className={i === activeStep ? 'text-white' : 'text-gray-300'}>{step.icon}</span>
              )}
            </div>
            {/* Ligne */}
            {i < steps.length - 1 && (
              <div className={`flex-1 h-1 mx-1 rounded-full transition-colors ${i < activeStep ? 'bg-green-400' : 'bg-gray-100'}`} />
            )}
          </div>
        ))}
      </div>

      {/* Labels */}
      <div className="flex mt-1.5" style={{ marginLeft: 0 }}>
        {steps.map((step, i) => (
          <div key={step.key} className={`flex-1 text-center ${i === steps.length - 1 ? 'flex-none w-8 text-right' : ''}`}>
            <p className={`text-[10px] font-medium leading-tight ${
              i === activeStep ? 'text-brand-600' : i < activeStep ? 'text-green-600' : 'text-gray-400'
            }`}>
              {step.label}
            </p>
          </div>
        ))}
      </div>

      {/* Infos contextuelles selon l'étape */}
      {isDelivery && deliveryOrder && (
        <div className="mt-2 text-xs text-gray-500 space-y-1">
          {deliveryOrder.delivery_providers && (
            <div className="flex items-center gap-1.5">
              <span>🚴</span>
              <span className="font-medium text-gray-700">{deliveryOrder.delivery_providers.display_name}</span>
              <span>·</span>
              <a href={`tel:${deliveryOrder.delivery_providers.phone}`} className="text-brand-600 hover:underline">
                {deliveryOrder.delivery_providers.phone}
              </a>
            </div>
          )}
          {deliveryOrder.delivery_address && (
            <div className="flex gap-1.5">
              <span className="flex-shrink-0">📍</span>
              <span>{deliveryOrder.delivery_address}</span>
            </div>
          )}
        </div>
      )}

      {/* Escrow info */}
      {tx.escrow_status === 'held' && tx.escrow_expires_at && activeStep < 3 && (
        <div className="mt-2 text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
          ⏳ Paiement sécurisé en escrow. Libération automatique le{' '}
          <span className="font-medium">
            {formatDateTime(tx.escrow_expires_at)}
          </span>
          {' '}si non confirmé.
        </div>
      )}
    </div>
  )
}

// ─── Bouton confirmer réception ───────────────────────────────────────────
function ConfirmDeliveryButton({ transactionId, onConfirmed }: { transactionId: string; onConfirmed: (cashback: number) => void }) {
  const [loading, setLoading] = useState(false)

  async function confirm() {
    setLoading(true)
    try {
      const res = await fetch(`/api/transactions/${transactionId}/confirm-delivery`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) onConfirmed(data.cashback?.amount ?? 0)
      else alert(data.error ?? 'Erreur')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={confirm}
      disabled={loading}
      className="w-full mt-3 py-3 bg-green-600 text-white rounded-xl font-bold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors active:scale-95"
    >
      {loading ? 'Confirmation…' : '✅ J\'ai bien reçu ma commande'}
    </button>
  )
}

// ─── Carte de commande ────────────────────────────────────────────────────
function OrderCard({ tx, userId }: { tx: any; userId: string }) {
  const [confirmed, setConfirmed] = useState(false)
  const [cashback, setCashback]   = useState(0)

  const merchant = tx.merchants as { business_name: string; public_slug: string | null } | null
  const items: any[] = tx.transaction_items ?? []
  const deliveryOrder = Array.isArray(tx.delivery_orders)
    ? (tx.delivery_orders[0] ?? null)
    : (tx.delivery_orders ?? null)

  const canConfirm =
    !confirmed &&
    tx.delivery_type === 'delivery' &&
    tx.escrow_status === 'held' &&
    (deliveryOrder?.status === 'delivered' ||
     deliveryOrder?.status === 'in_transit' ||
     deliveryOrder?.status === 'picked_up')

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* En-tête */}
      <div className="px-4 py-3 flex items-start justify-between border-b border-gray-50">
        <div>
          <p className="font-semibold text-gray-800 text-sm">{merchant?.business_name}</p>
          <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="font-bold text-gray-900">{formatFcfa(tx.amount_fcfa)}</p>
          {tx.delivery_type === 'delivery' && (
            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5 font-medium">
              🚴 Livraison
            </span>
          )}
          {tx.delivery_type === 'pickup' && (
            <span className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">
              🏪 Retrait
            </span>
          )}
        </div>
      </div>

      {/* Articles */}
      {items.length > 0 && (
        <div className="divide-y divide-gray-50">
          {items.map((item: any) => (
            <div key={item.id} className="px-4 py-2.5 flex items-center gap-3">
              <span className="text-xl">{item.emoji ?? '📦'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 truncate">{item.product_name}</p>
                {item.quantity > 1 && <p className="text-xs text-gray-400">× {item.quantity}</p>}
              </div>
              <p className="text-sm font-medium text-gray-600 flex-shrink-0">
                {formatFcfa(item.unit_price_fcfa * item.quantity)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Tracker + actions */}
      <div className="px-4 pb-4 pt-2">
        {/* Tracker visuel */}
        <OrderTracker tx={tx} deliveryOrder={deliveryOrder} />

        {/* Confirmation réception */}
        {confirmed ? (
          <div className="mt-3 py-3 bg-green-50 border border-green-200 rounded-xl text-center">
            <p className="text-green-700 font-bold text-sm">🎉 Réception confirmée !</p>
            {cashback > 0 && (
              <p className="text-brand-600 text-xs font-medium mt-0.5">
                +{cashback.toLocaleString('fr-FR')} FCFA de cashback crédités 🔥
              </p>
            )}
          </div>
        ) : canConfirm ? (
          <ConfirmDeliveryButton
            transactionId={tx.id}
            onConfirmed={(cb) => { setConfirmed(true); setCashback(cb) }}
          />
        ) : null}

        {/* Contact marchand */}
        <div className="flex items-center justify-between mt-2">
          <ContactButton
            transactionId={tx.id}
            label="💬 Contacter le marchand"
            className="text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50"
          />
          {tx.escrow_status === 'held' && !confirmed && (
            <Link
              href={`/delivery/confirm/${tx.id}`}
              className="text-xs text-gray-500 hover:text-red-500 hover:underline"
            >
              Signaler un problème
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Composant principal ───────────────────────────────────────────────────
interface Props {
  transactions: any[]
  packs: any[]
  userId: string
}

export default function MesAchatsClient({ transactions, packs, userId }: Props) {
  const [tab, setTab] = useState<'commandes' | 'digital'>('commandes')

  const hasCommandes = transactions.length > 0
  const hasPacks     = packs.length > 0

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700">← Accueil</Link>
        <h1 className="font-bold text-gray-900 text-lg">Mes Commandes</h1>
      </div>

      {/* Onglets */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1">
        {(['commandes', 'digital'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {t === 'commandes' ? '📦 Commandes' : '✨ Digital'}
          </button>
        ))}
      </div>

      {/* Tab Commandes */}
      {tab === 'commandes' && (
        <>
          {!hasCommandes ? (
            <EmptyState
              emoji="📦"
              title="Aucune commande"
              subtitle="Vos achats apparaîtront ici après votre première transaction."
              cta={{ href: '/marketplace', label: 'Découvrir le Marché →' }}
            />
          ) : (
            <div className="space-y-4">
              {transactions.map((tx: any) => (
                <OrderCard key={tx.id} tx={tx} userId={userId} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab Digital */}
      {tab === 'digital' && (
        <>
          {!hasPacks ? (
            <EmptyState
              emoji="✨"
              title="Aucun contenu digital"
              subtitle="Vos packs mystère et formations achetées apparaîtront ici."
              cta={{ href: '/pack-mystere', label: 'Découvrir les Packs →' }}
            />
          ) : (
            <div className="space-y-3">
              {packs.length > 0 && (
                <>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">🎁 Packs Mystère</p>
                  {packs.map((pack: any) => {
                    const items: any[] = pack.mystery_pack_items ?? []
                    const isOpened = pack.status !== 'purchased'
                    return (
                      <div key={pack.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-4 py-3 flex items-center justify-between border-b border-gray-50">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl">{TIER_EMOJI[pack.pack_tier] ?? '🎁'}</span>
                            <div>
                              <p className="font-semibold text-gray-800 text-sm capitalize">Pack {pack.pack_tier}</p>
                              <p className="text-xs text-gray-400">{formatDate(pack.created_at)} · {formatFcfa(pack.price_paid_fcfa)}</p>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold rounded-full px-2 py-0.5 ${
                            isOpened ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {isOpened ? '✓ Ouvert' : '🎁 Non ouvert'}
                          </span>
                        </div>
                        {items.map((pi: any) => {
                          const cat = pi.pack_item_catalog
                          if (!cat) return null
                          return (
                            <div key={pi.id} className="px-4 py-3">
                              <div className="flex items-start gap-3">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <p className="text-sm font-semibold text-gray-800">{cat.name_fr}</p>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${RARITY_STYLE[cat.rarity] ?? 'bg-gray-100 text-gray-600'}`}>
                                      {cat.rarity}
                                    </span>
                                  </div>
                                  <p className="text-xs text-gray-500">{cat.description_fr}</p>
                                </div>
                                {pi.delivered && (
                                  <span className="text-green-500 text-xs font-bold flex-shrink-0">✓ Livré</span>
                                )}
                              </div>
                            </div>
                          )
                        })}
                        {items.some((pi: any) =>
                          pi.pack_item_catalog?.item_type?.startsWith('gf_academie') ||
                          pi.pack_item_catalog?.item_type?.startsWith('gf_formation')
                        ) && (
                          <div className="px-4 pb-3">
                            <Link href="/academie" className="text-xs font-semibold text-brand-600 hover:underline">
                              → Accéder à l&apos;Académie GreenFlame
                            </Link>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function EmptyState({ emoji, title, subtitle, cta }: {
  emoji: string; title: string; subtitle: string
  cta: { href: string; label: string }
}) {
  return (
    <div className="text-center py-12 space-y-3">
      <span className="text-5xl">{emoji}</span>
      <p className="font-bold text-gray-800">{title}</p>
      <p className="text-gray-400 text-sm">{subtitle}</p>
      <Link href={cta.href} className="inline-block mt-2 bg-brand-600 text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-brand-700 transition-all">
        {cta.label}
      </Link>
    </div>
  )
}
