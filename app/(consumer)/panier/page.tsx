'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useCart, type MerchantGroup } from '@/context/CartContext'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { GOVERNANCE } from '@/lib/commission-engine/constants'

const CASHBACK_RATE = GOVERNANCE.DEFAULT_COMMISSION_RATE * GOVERNANCE.CASHBACK_SHARE

function formatFcfa(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' F'
}

function estimateCashback(subtotal: number) {
  return Math.floor(subtotal * CASHBACK_RATE)
}

interface DeliveryProvider {
  id: string
  display_name: string
  phone: string
  service_area: string | null
  base_fee_fcfa: number
  avg_rating: number | null
  nb_deliveries: number
  is_verified: boolean
}

function MerchantGroupCard({
  group,
  onCheckout,
  isCheckingOut,
  isGuest,
  onGuestLogin,
}: {
  group: MerchantGroup
  onCheckout: (g: MerchantGroup, opts: {
    deliveryType: 'pickup' | 'delivery'
    deliveryAddress: string
    providerId: string | null
    paymentMethod: 'wallet_gf' | 'cash_on_delivery'
  }) => void
  isCheckingOut: boolean
  isGuest?: boolean
  onGuestLogin?: () => void
}) {
  const { removeItem, updateQty } = useCart()
  const cashback = estimateCashback(group.subtotal)

  const [deliveryType, setDeliveryType] = useState<'pickup' | 'delivery' | null>(null)
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [providerId, setProviderId] = useState<string | null>(null)
  const [providers, setProviders] = useState<DeliveryProvider[]>([])
  const [loadingProviders, setLoadingProviders] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'wallet_gf' | 'cash_on_delivery'>('wallet_gf')

  useEffect(() => {
    if (deliveryType !== 'delivery') return
    setLoadingProviders(true)
    fetch('/api/delivery/providers')
      .then(r => r.json())
      .then(d => { setProviders(d.providers ?? []); setLoadingProviders(false) })
      .catch(() => setLoadingProviders(false))
  }, [deliveryType])

  const canPay = deliveryType !== null && (deliveryType === 'pickup' || deliveryAddress.trim().length > 3)

  function handlePay() {
    if (!deliveryType) return
    onCheckout(group, { deliveryType, deliveryAddress, providerId, paymentMethod })
  }

  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-opacity ${isCheckingOut ? 'opacity-60 pointer-events-none' : ''}`}>
      {/* En-tête marchand */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
        <p className="font-semibold text-gray-800 text-sm">{group.merchantName}</p>
        <span className="text-xs text-gray-400">{group.items.length} article{group.items.length > 1 ? 's' : ''}</span>
      </div>

      {/* Lignes d'articles */}
      <div className="divide-y divide-gray-50">
        {group.items.map(item => (
          <div key={item.productId} className="px-4 py-3 flex items-center gap-3">
            <span className="text-2xl w-8 text-center flex-shrink-0">{item.emoji ?? '📦'}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
              <p className="text-xs text-gray-500">{formatFcfa(item.price_fcfa)} / unité</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => updateQty(item.productId, item.quantity - 1)}
                className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-lg leading-none font-bold"
              >−</button>
              <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
              <button
                onClick={() => updateQty(item.productId, item.quantity + 1)}
                className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-lg leading-none font-bold"
              >+</button>
            </div>
            <div className="flex-shrink-0 text-right min-w-[70px]">
              <p className="text-sm font-bold text-gray-900">{formatFcfa(item.price_fcfa * item.quantity)}</p>
              <button onClick={() => removeItem(item.productId)} className="text-[10px] text-red-400 hover:text-red-600">
                Retirer
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Récap + cashback */}
      <div className="px-4 py-3 bg-brand-50/50 border-t border-brand-100 space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Sous-total</span>
          <span className="font-bold text-gray-900">{formatFcfa(group.subtotal)}</span>
        </div>
        {paymentMethod === 'wallet_gf' && (
          <div className="flex justify-between text-xs">
            <span className="text-brand-600">Cashback estimé 🔥</span>
            <span className="font-semibold text-brand-600">~{formatFcfa(cashback)}</span>
          </div>
        )}
      </div>

      {/* ─── Mode de récupération ─── */}
      <div className="px-4 pt-4 pb-2 border-t border-gray-100">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mode de récupération</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setDeliveryType('pickup')}
            className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all text-left ${
              deliveryType === 'pickup'
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <span className="block text-lg leading-none mb-0.5">🏪</span>
            <span className="text-xs">Retrait en boutique</span>
            <span className="block text-[10px] text-green-600 font-semibold mt-0.5">Gratuit</span>
          </button>
          <button
            onClick={() => setDeliveryType('delivery')}
            className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all text-left ${
              deliveryType === 'delivery'
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-gray-200 text-gray-600 hover:border-gray-300'
            }`}
          >
            <span className="block text-lg leading-none mb-0.5">🚚</span>
            <span className="text-xs">Livraison à domicile</span>
            <span className="block text-[10px] text-gray-400 font-medium mt-0.5">Frais livreur</span>
          </button>
        </div>
        {deliveryType === null && (
          <p className="text-[11px] text-gray-400 text-center mt-2">
            Choisissez un mode de récupération pour continuer
          </p>
        )}
      </div>

      {/* Options livraison */}
      {deliveryType === 'delivery' && (
        <div className="px-4 pb-2 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Adresse de livraison *</label>
            <input
              type="text"
              value={deliveryAddress}
              onChange={e => setDeliveryAddress(e.target.value)}
              placeholder="Quartier, rue, repère…"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-200"
            />
          </div>

          {loadingProviders ? (
            <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />
          ) : providers.length === 0 ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-xs text-amber-700">
              Aucun livreur disponible actuellement. Votre commande sera traitée sans livreur assigné.
            </div>
          ) : (
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Choisir un livreur (optionnel)</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                <button
                  onClick={() => setProviderId(null)}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-xs transition-all ${
                    providerId === null ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  🎯 Assigner automatiquement
                </button>
                {providers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => setProviderId(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl border transition-all ${
                      providerId === p.id ? 'border-brand-400 bg-brand-50' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-semibold text-gray-800">
                          {p.is_verified ? '✅ ' : ''}{p.display_name}
                        </p>
                        {p.service_area && <p className="text-[10px] text-gray-400">{p.service_area}</p>}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs font-bold text-gray-700">{formatFcfa(p.base_fee_fcfa)}</p>
                        {p.avg_rating && <p className="text-[10px] text-amber-500">★ {p.avg_rating} ({p.nb_deliveries})</p>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── Mode de paiement — visible seulement après choix de livraison ─── */}
      {deliveryType !== null && (
        <div className="px-4 pt-3 pb-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Mode de paiement</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setPaymentMethod('wallet_gf')}
              className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all text-left ${
                paymentMethod === 'wallet_gf'
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="block text-lg leading-none mb-0.5">🔥</span>
              <span className="text-xs">Wallet GreenFlame</span>
              <span className="block text-[10px] text-brand-600 font-semibold mt-0.5">+Cashback</span>
            </button>
            <button
              onClick={() => setPaymentMethod('cash_on_delivery')}
              disabled={deliveryType === 'pickup'}
              className={`py-2.5 px-3 rounded-xl border text-sm font-medium transition-all text-left ${
                deliveryType === 'pickup'
                  ? 'opacity-40 cursor-not-allowed border-gray-200 text-gray-400'
                  : paymentMethod === 'cash_on_delivery'
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              <span className="block text-lg leading-none mb-0.5">💵</span>
              <span className="text-xs">Espèces à la livraison</span>
              <span className="block text-[10px] text-gray-400 font-medium mt-0.5">Paiement au livreur</span>
            </button>
          </div>
          {deliveryType === 'pickup' && (
            <p className="text-[10px] text-gray-400 mt-1.5">Paiement espèces disponible uniquement en livraison.</p>
          )}
        </div>
      )}

      {/* Bouton payer */}
      <div className="px-4 py-3">
        {isGuest ? (
          <button
            onClick={onGuestLogin}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-all"
          >
            Se connecter pour commander →
          </button>
        ) : (
          <>
            <button
              onClick={handlePay}
              disabled={!canPay || isCheckingOut}
              className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-all"
            >
              {isCheckingOut ? '⏳ En cours…'
                : deliveryType === null ? 'Choisir un mode de récupération'
                : paymentMethod === 'cash_on_delivery'
                  ? `Commander — ${formatFcfa(group.subtotal)} (espèces)`
                  : `Payer ${group.merchantName} — ${formatFcfa(group.subtotal)}`
              }
            </button>
            {deliveryType === 'delivery' && !deliveryAddress.trim() && (
              <p className="text-[10px] text-red-400 text-center mt-1">Saisissez une adresse de livraison</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function PanierPage() {
  const { groupedByMerchant, clearMerchant, totalItems } = useCart()
  const router = useRouter()
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isGuest, setIsGuest] = useState(false)

  useEffect(() => {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    sb.auth.getSession().then(({ data: { session } }) => {
      setIsGuest(!session)
    })
  }, [])

  function handleGuestLogin() {
    router.push('/login?next=/panier')
  }

  const groups = groupedByMerchant()

  async function handleCheckout(
    group: MerchantGroup,
    opts: {
      deliveryType: 'pickup' | 'delivery'
      deliveryAddress: string
      providerId: string | null
      paymentMethod: 'wallet_gf' | 'cash_on_delivery'
    }
  ) {
    setCheckingOut(group.merchantId)
    setError(null)
    try {
      const res = await fetch('/api/cart/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: group.merchantId,
          items: group.items.map(i => ({
            productId: i.productId,
            name: i.name,
            price_fcfa: i.price_fcfa,
            quantity: i.quantity,
            emoji: i.emoji,
          })),
          totalAmount: group.subtotal,
          deliveryType: opts.deliveryType,
          deliveryAddress: opts.deliveryAddress || undefined,
          providerId: opts.providerId || undefined,
          paymentMethod: opts.paymentMethod,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur de paiement')
      clearMerchant(group.merchantId)
      router.push(`/history?tx=${data.transactionId}&from=panier`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inattendue')
    } finally {
      setCheckingOut(null)
    }
  }

  if (totalItems === 0) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <span className="text-6xl">🛒</span>
        <h1 className="text-xl font-bold text-gray-800">Votre panier est vide</h1>
        <p className="text-gray-500 text-sm">Ajoutez des produits depuis le Marché pour les retrouver ici.</p>
        <Link href="/marketplace" className="inline-block mt-4 bg-brand-600 text-white font-bold px-6 py-3 rounded-xl hover:bg-brand-700 transition-all">
          Découvrir le Marché →
        </Link>
      </div>
    )
  }

  const grandTotal = groups.reduce((s, g) => s + g.subtotal, 0)
  const grandCashback = groups.reduce((s, g) => s + estimateCashback(g.subtotal), 0)

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Link href="/marketplace" className="text-sm text-gray-500 hover:text-gray-700">← Marché</Link>
        <h1 className="font-bold text-gray-900">🛒 Mon Panier</h1>
        <span className="text-xs text-gray-400">{totalItems} article{totalItems > 1 ? 's' : ''}</span>
      </div>

      {isGuest && (
        <div className="bg-gradient-to-r from-brand-50 to-indigo-50 border border-brand-100 rounded-2xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-100 flex items-center justify-center flex-shrink-0 text-lg">
            🔒
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-800 leading-none">Mode visiteur</p>
            <p className="text-[11px] text-gray-500 mt-0.5 leading-snug">
              Connecte-toi pour commander et gagner ton cashback 🔥
            </p>
          </div>
          <Link
            href="/login?next=/panier"
            className="bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold px-3 py-2 rounded-xl flex-shrink-0 transition-colors active:scale-95"
          >
            Connexion →
          </Link>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Groupes par marchand */}
      {groups.map(group => (
        <MerchantGroupCard
          key={group.merchantId}
          group={group}
          onCheckout={handleCheckout}
          isCheckingOut={checkingOut === group.merchantId}
          isGuest={isGuest}
          onGuestLogin={handleGuestLogin}
        />
      ))}

      {/* Récap global */}
      {groups.length > 1 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4 space-y-2">
          <p className="font-semibold text-gray-700 text-sm">Récapitulatif total</p>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Total commandes</span>
            <span className="font-bold text-gray-900">{formatFcfa(grandTotal)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-brand-600">Cashback total estimé</span>
            <span className="font-semibold text-brand-600">~{formatFcfa(grandCashback)}</span>
          </div>
          <p className="text-[10px] text-gray-400">
            Payez marchand par marchand. Le cashback est crédité à chaque paiement.
          </p>
        </div>
      )}

      {/* Lien Mes Achats */}
      <div className="text-center pt-2">
        <Link href="/mes-achats" className="text-xs text-gray-400 hover:text-brand-600 underline">
          Voir mes commandes précédentes →
        </Link>
      </div>
    </div>
  )
}
