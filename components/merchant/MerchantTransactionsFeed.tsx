'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatFcfa } from '@/lib/utils/format'

interface TransactionItem {
  product_name: string
  quantity: number
  unit_price_fcfa: number
  emoji: string | null
}

interface MerchantTransaction {
  id: string
  created_at: string
  amount_fcfa: number
  commission_total: number
  net_fcfa: number
  payment_method: string
  buyer_name: string
  buyer_phone: string | null
  items: TransactionItem[]
  isNew?: boolean
}

const METHOD_ICONS: Record<string, string> = {
  cash_confirmed: '💵',
  mtn_momo:       '📱',
  moov_money:     '📲',
  celtiis:        '📶',
  wallet_gf:      '💳',
}

const METHOD_LABELS: Record<string, string> = {
  cash_confirmed: 'Espèces',
  mtn_momo:       'MTN MoMo',
  moov_money:     'Moov Money',
  celtiis:        'Celtiis',
  wallet_gf:      'Wallet GreenFlame',
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60)    return `il y a ${diff}s`
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function MerchantTransactionsFeed({ merchantUserId }: { merchantUserId: string }) {
  const supabase = createClient()
  const [transactions, setTransactions] = useState<MerchantTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [newCount, setNewCount] = useState(0)

  const load = useCallback(async () => {
    const res = await fetch('/api/merchant/commandes')
    if (res.ok) {
      const data = await res.json()
      setTransactions(data.transactions ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()

    // Écouter les nouvelles transactions en temps réel via les notifications
    const channel = supabase
      .channel(`merchant-feed-${merchantUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${merchantUserId}`,
        },
        async (payload: any) => {
          if (payload.new?.type !== 'payment_received') return
          // Recharger depuis l'API pour avoir les données complètes
          const res = await fetch('/api/merchant/commandes')
          if (res.ok) {
            const data = await res.json()
            const latest = data.transactions?.[0]
            if (latest) {
              setTransactions(prev => {
                const exists = prev.some(t => t.id === latest.id)
                if (exists) return prev
                setNewCount(c => c + 1)
                return [{ ...latest, isNew: true }, ...prev.slice(0, 29)]
              })
            }
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [merchantUserId, load, supabase])

  if (loading) {
    return (
      <div className="space-y-3">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (transactions.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-4xl mb-3">🧾</p>
        <p className="font-semibold text-gray-600">Aucune vente pour le moment</p>
        <p className="text-sm mt-1">Vos transactions apparaîtront ici en temps réel</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Compteur nouvelles ventes */}
      {newCount > 0 && (
        <div className="flex items-center justify-between">
          <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">
            🔔 {newCount} nouvelle{newCount > 1 ? 's' : ''} vente{newCount > 1 ? 's' : ''}
          </span>
          <button onClick={() => setNewCount(0)} className="text-xs text-gray-500 hover:text-gray-600">
            Effacer
          </button>
        </div>
      )}

      {transactions.map((tx) => {
        const method = tx.payment_method
        const hasItems = tx.items.length > 0

        return (
          <div
            key={tx.id}
            className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${
              tx.isNew ? 'border-green-300 ring-1 ring-green-200' : 'border-gray-100'
            }`}
          >
            {/* En-tête : acheteur + heure */}
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 bg-brand-100 rounded-xl flex items-center justify-center text-base font-bold text-brand-700 flex-shrink-0">
                  {tx.buyer_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{tx.buyer_name}</p>
                  <p className="text-xs text-gray-500">{timeAgo(tx.created_at)}</p>
                </div>
              </div>
              <span className="text-lg">{METHOD_ICONS[method] ?? '💰'}</span>
            </div>

            {/* Produits achetés */}
            {hasItems ? (
              <div className="px-4 py-2 space-y-1 border-t border-gray-50">
                {tx.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-base">{item.emoji ?? '📦'}</span>
                    <span className="text-gray-700 flex-1 truncate">
                      {item.quantity > 1 ? `${item.quantity}× ` : ''}{item.product_name}
                    </span>
                    <span className="text-gray-500 text-xs flex-shrink-0">{formatFcfa(item.unit_price_fcfa * item.quantity)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-4 py-2 border-t border-gray-50">
                <p className="text-sm text-gray-500 italic">Vente directe</p>
              </div>
            )}

            {/* Bilan financier */}
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between gap-3">
              {/* Méthode */}
              <span className="text-xs text-gray-500 bg-white border border-gray-200 px-2 py-1 rounded-lg flex-shrink-0">
                {METHOD_LABELS[method] ?? method}
              </span>

              {/* Montants */}
              <div className="flex items-center gap-3 ml-auto">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Encaissé</p>
                  <p className="text-sm font-semibold text-gray-700">{formatFcfa(tx.amount_fcfa)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500">Frais GF</p>
                  <p className="text-sm font-medium text-gray-600">−{formatFcfa(tx.commission_total)}</p>
                </div>
                <div className="text-right bg-green-50 rounded-xl px-3 py-1.5">
                  <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide">Net reçu</p>
                  <p className="text-base font-bold text-green-700">+{formatFcfa(tx.net_fcfa)}</p>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
