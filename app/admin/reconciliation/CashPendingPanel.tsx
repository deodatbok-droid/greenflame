'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatFcfa } from '@/lib/utils/format'

export interface CashPendingItem {
  merchant_id: string
  business_name: string
  total_fcfa: number
  tx_count: number
  oldest_tx: string
}

interface CashPendingPanelProps {
  items: CashPendingItem[]
  title?: string
  subtitle?: string
  emptyIcon?: string
  emptyTitle?: string
  emptyMessage?: string
}

export default function CashPendingPanel({
  items,
  title = '💰 Cash chez les marchands — à collecter',
  subtitle = 'Ces montants sont chez les marchands, pas encore dans vos caisses',
  emptyIcon = '✅',
  emptyTitle = 'Tout le cash est collecté',
  emptyMessage = 'Aucun paiement en espèces en attente de collecte',
}: CashPendingPanelProps) {
  const router = useRouter()
  const [open, setOpen] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalPending = items.reduce((s, i) => s + i.total_fcfa, 0)

  function openCollect(item: CashPendingItem) {
    setOpen(item.merchant_id)
    setAmount(item.total_fcfa.toString())
    setNotes('')
    setError(null)
  }

  async function handleCollect(merchantId: string) {
    const parsed = parseInt(amount)
    if (!parsed || parsed <= 0) { setError('Montant invalide'); return }
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/float/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_id: merchantId,
          amount_fcfa: parsed,
          notes:       notes || null,
          entry_date:  new Date().toISOString().slice(0, 10),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setOpen(null)
      router.refresh()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="bg-gray-800 rounded-2xl p-6 text-center border border-green-700/30">
        <p className="text-3xl mb-2">{emptyIcon}</p>
        <p className="text-green-400 font-semibold">{emptyTitle}</p>
        <p className="text-gray-500 text-sm mt-1">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-2xl overflow-hidden border border-amber-600/40">
      <div className="px-5 py-4 border-b border-gray-700 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-white font-semibold">{title}</h2>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-amber-400 text-xl font-bold">{formatFcfa(totalPending)} FCFA</p>
          <p className="text-gray-500 text-xs">{items.length} marchand{items.length > 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="divide-y divide-gray-700/40">
        {items.map(item => {
          const isOpen = open === item.merchant_id
          const parsedAmt = parseInt(amount)
          const hasDiscrepancy = isOpen && parsedAmt > 0 && parsedAmt !== item.total_fcfa
          const diff = hasDiscrepancy ? item.total_fcfa - parsedAmt : 0

          return (
            <div key={item.merchant_id}>
              {/* Ligne marchand */}
              <div className="px-5 py-3.5 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{item.business_name}</p>
                  <p className="text-gray-500 text-xs">
                    {item.tx_count} transaction{item.tx_count > 1 ? 's' : ''} · depuis le{' '}
                    {new Date(item.oldest_tx).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-amber-400 font-bold text-base">{formatFcfa(item.total_fcfa)} FCFA</span>
                  <button
                    onClick={() => isOpen ? setOpen(null) : openCollect(item)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
                      isOpen
                        ? 'bg-gray-600 text-gray-300 hover:bg-gray-500'
                        : 'bg-amber-600 text-white hover:bg-amber-500'
                    }`}
                  >
                    {isOpen ? 'Annuler' : 'Collecter'}
                  </button>
                </div>
              </div>

              {/* Formulaire de collecte inline */}
              {isOpen && (
                <div className="px-5 py-4 bg-gray-750 border-t border-gray-700/60 space-y-3 bg-gray-900/30">
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">
                    Enregistrer la collecte — {item.business_name}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Montant reçu (FCFA)</label>
                      <input
                        type="number"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        min="1"
                        className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-amber-500 focus:outline-none"
                      />
                      {hasDiscrepancy && (
                        <p className={`text-xs mt-1 ${diff > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {diff > 0
                            ? `⚠ Manque ${formatFcfa(diff)} FCFA vs attendu`
                            : `⚠ Surplus de ${formatFcfa(-diff)} FCFA vs attendu`
                          }
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 mb-1.5 block">Notes (optionnel)</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Ex : collecté en personne, reçu partiel…"
                        className="w-full bg-gray-700 text-white rounded-lg px-3 py-2 text-sm border border-gray-600 focus:border-amber-500 focus:outline-none"
                      />
                    </div>
                  </div>
                  {error && <p className="text-red-400 text-xs">{error}</p>}
                  <button
                    onClick={() => handleCollect(item.merchant_id)}
                    disabled={loading}
                    className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors"
                  >
                    {loading ? 'Enregistrement…' : '✓ Confirmer la collecte'}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
