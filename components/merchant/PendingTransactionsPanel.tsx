'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatFcfa, formatCashback, commissionCode } from '@/lib/utils/format'
import { GOVERNANCE } from '@/lib/commission-engine/constants'
import toast from 'react-hot-toast'

interface PendingTx {
  id: string
  amount_fcfa: number
  commission_rate: number
  created_at: string
  buyer_id: string
  buyer_name?: string
}

function timeAgo(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}min`
  return `${Math.floor(diff / 3600)}h`
}

export default function PendingTransactionsPanel({ merchantId }: { merchantId: string }) {
  const supabase = createClient()
  const [pending, setPending] = useState<PendingTx[]>([])
  const [confirming, setConfirming] = useState<string | null>(null)
  // PIN confirmation step
  const [pinTxId, setPinTxId] = useState<string | null>(null)
  const [pin, setPin] = useState('')

  const enrichWithBuyerName = useCallback(async (txs: PendingTx[]) => {
    const ids = txs.map(t => t.buyer_id)
    if (ids.length === 0) return txs
    const { data: buyers } = await supabase
      .from('users')
      .select('id, full_name')
      .in('id', ids)
    const nameMap = Object.fromEntries((buyers ?? []).map(b => [b.id, b.full_name]))
    return txs.map(t => ({ ...t, buyer_name: nameMap[t.buyer_id] ?? 'Client inconnu' }))
  }, [supabase])

  const loadPending = useCallback(async () => {
    const { data } = await supabase
      .from('transactions')
      .select('id, amount_fcfa, commission_rate, created_at, buyer_id')
      .eq('merchant_id', merchantId)
      .eq('status', 'pending')
      .eq('payment_method', 'cash_confirmed')
      .order('created_at', { ascending: true })
    const enriched = await enrichWithBuyerName(data ?? [])
    setPending(enriched)
  }, [merchantId, supabase, enrichWithBuyerName])

  useEffect(() => {
    loadPending()

    const channel = supabase
      .channel(`pending-tx-${merchantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `merchant_id=eq.${merchantId}`,
        },
        () => { loadPending() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [merchantId, loadPending, supabase])

  async function confirmTx(txId: string, transactionPin: string) {
    setConfirming(txId)
    try {
      const res = await fetch('/api/transactions/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactionId: txId, transactionPin }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Erreur de confirmation')
        return
      }
      toast.success(`Transaction confirmée ! Cashback client : +${data.cashback?.amount ?? 0} ${data.cashback?.isGfp ? 'GFP' : 'FCFA'} 🔥`)
      setPending(prev => prev.filter(t => t.id !== txId))
      setPinTxId(null)
      setPin('')
    } catch {
      toast.error('Erreur de connexion')
    } finally {
      setConfirming(null)
    }
  }

  if (pending.length === 0) return null

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
        <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
          {pending.length} paiement{pending.length > 1 ? 's' : ''} en attente de confirmation
        </p>
      </div>

      {pending.map(tx => {
        const commission  = Math.floor(tx.amount_fcfa * tx.commission_rate)
        const cashback    = Math.floor(commission * GOVERNANCE.CASHBACK_SHARE)
        const cashbackDisplay = formatCashback(tx.amount_fcfa * tx.commission_rate * GOVERNANCE.CASHBACK_SHARE)
        const merchantNet = tx.amount_fcfa - commission
        const isPgf       = cashback < GOVERNANCE.GFP_CASH_MIN_THRESHOLD
        const askingPin   = pinTxId === tx.id

        return (
          <div
            key={tx.id}
            className="bg-amber-50 border-2 border-amber-300 dark:bg-amber-950/30 dark:border-amber-700 rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="font-bold text-gray-900 dark:text-white text-lg">{formatFcfa(tx.amount_fcfa)} FCFA</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{tx.buyer_name} · il y a {timeAgo(tx.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 dark:text-gray-400">Vous recevez</p>
                <p className="font-bold text-brand-600 dark:text-brand-400">{formatFcfa(merchantNet)} FCFA</p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white/60 dark:bg-black/20 rounded-xl px-3 py-2 text-xs text-gray-500">
              <span>Frais ({commissionCode(tx.commission_rate)}) : −{formatFcfa(commission)}</span>
              <span className="text-brand-600 dark:text-brand-400 font-medium">
                Cashback client : {cashbackDisplay.label} 🔥
              </span>
            </div>

            {askingPin ? (
              /* ── Étape PIN ── */
              <div className="space-y-2">
                <p className="text-xs text-amber-800 font-semibold text-center">
                  🔐 Entrez votre code PIN pour confirmer la réception
                </p>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="••••••"
                  className="w-full border border-amber-300 rounded-xl px-4 py-3 text-center text-2xl font-bold tracking-widest focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setPinTxId(null); setPin('') }}
                    className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 bg-white hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => confirmTx(tx.id, pin)}
                    disabled={confirming === tx.id || pin.length < 6}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-sm transition-colors"
                  >
                    {confirming === tx.id ? 'Confirmation...' : '✅ Valider'}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Bouton initial ── */
              <button
                onClick={() => { setPinTxId(tx.id); setPin('') }}
                disabled={confirming === tx.id}
                className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl text-sm transition-colors active:scale-95"
              >
                ✅ Confirmer — j&apos;ai reçu {formatFcfa(tx.amount_fcfa)} FCFA de {tx.buyer_name}
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
