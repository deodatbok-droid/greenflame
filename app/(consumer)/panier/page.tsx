'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useCart, type MerchantGroup } from '@/context/CartContext'
import { useRouter } from 'next/navigation'

const CASHBACK_RATE = 0.12 * 0.45 // 12% cashback share × commission share approx

function formatFcfa(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' F'
}

function estimateCashback(subtotal: number) {
  return Math.floor(subtotal * CASHBACK_RATE)
}

function MerchantGroupCard({ group, onCheckout }: { group: MerchantGroup; onCheckout: (g: MerchantGroup) => void }) {
  const { removeItem, updateQty } = useCart()
  const cashback = estimateCashback(group.subtotal)

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
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

            {/* Quantité */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => updateQty(item.productId, item.quantity - 1)}
                className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-lg leading-none font-bold"
              >
                −
              </button>
              <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
              <button
                onClick={() => updateQty(item.productId, item.quantity + 1)}
                className="w-7 h-7 rounded-full border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-100 text-lg leading-none font-bold"
              >
                +
              </button>
            </div>

            {/* Sous-total ligne */}
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
        <div className="flex justify-between text-xs">
          <span className="text-brand-600">Cashback estimé 🔥</span>
          <span className="font-semibold text-brand-600">~{formatFcfa(cashback)}</span>
        </div>
      </div>

      {/* Bouton payer ce marchand */}
      <div className="px-4 py-3">
        <button
          onClick={() => onCheckout(group)}
          className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl text-sm active:scale-95 transition-all"
        >
          Payer {group.merchantName} — {formatFcfa(group.subtotal)}
        </button>
      </div>
    </div>
  )
}

export default function PanierPage() {
  const { groupedByMerchant, clearMerchant, totalItems } = useCart()
  const router = useRouter()
  const [checkingOut, setCheckingOut] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const groups = groupedByMerchant()

  async function handleCheckout(group: MerchantGroup) {
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Groupes par marchand */}
      {groups.map(group => (
        <div key={group.merchantId} className={checkingOut === group.merchantId ? 'opacity-60 pointer-events-none' : ''}>
          <MerchantGroupCard
            group={group}
            onCheckout={handleCheckout}
          />
          {checkingOut === group.merchantId && (
            <p className="text-center text-xs text-gray-500 mt-1">⏳ Paiement en cours…</p>
          )}
        </div>
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
