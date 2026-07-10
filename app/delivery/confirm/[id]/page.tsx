'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type TxInfo = {
  amount_fcfa: number
  escrow_status: string
  status: string
  delivery_type: string
  merchants: { business_name: string } | null
}

export default function DeliveryConfirmPage() {
  const { id: transactionId } = useParams<{ id: string }>()
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [tx, setTx] = useState<TxInfo | null>(null)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState<'confirmed' | 'disputed' | null>(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [showDispute, setShowDispute] = useState(false)
  const [cashback, setCashback] = useState(0)

  useEffect(() => {
    const init = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      setUser(u)

      if (!u) { setLoading(false); return }

      const { data } = await supabase
        .from('transactions')
        .select('amount_fcfa, escrow_status, status, delivery_type, merchants(business_name)')
        .eq('id', transactionId)
        .eq('buyer_id', u.id)
        .single()

      setTx(data as TxInfo | null)
      setLoading(false)
    }
    init()
  }, [transactionId])

  async function confirmDelivery() {
    setSubmitting(true)
    try {
      const resp = await fetch(`/api/transactions/${transactionId}/confirm-delivery`, { method: 'POST' })
      const data = await resp.json()
      if (data.ok) {
        setCashback(data.cashback?.amount ?? 0)
        setDone('confirmed')
      } else {
        alert(data.error ?? 'Erreur')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function openDispute() {
    if (!disputeReason.trim()) { alert('Décrivez le problème.'); return }
    setSubmitting(true)
    try {
      const resp = await fetch(`/api/transactions/${transactionId}/dispute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: disputeReason }),
      })
      const data = await resp.json()
      if (data.ok) {
        setDone('disputed')
      } else {
        alert(data.error ?? 'Erreur')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-400">Chargement…</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 text-center max-w-sm w-full">
          <div className="text-4xl mb-3">🔒</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Connexion requise</h2>
          <p className="text-sm text-gray-500 mb-4">Connectez-vous pour confirmer votre livraison.</p>
          <a href={`/login?next=/delivery/confirm/${transactionId}`}
            className="block bg-brand-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-brand-700">
            Se connecter
          </a>
        </div>
      </div>
    )
  }

  if (!tx || tx.delivery_type !== 'delivery') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 text-center max-w-sm w-full">
          <div className="text-4xl mb-3">❌</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Transaction introuvable</h2>
          <p className="text-sm text-gray-500">Cette transaction n&apos;existe pas ou ne vous appartient pas.</p>
        </div>
      </div>
    )
  }

  if (tx.escrow_status !== 'held') {
    const alreadyDone = tx.escrow_status === 'released'
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 text-center max-w-sm w-full">
          <div className="text-4xl mb-3">{alreadyDone ? '✅' : '⚠️'}</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">
            {alreadyDone ? 'Déjà confirmée' : 'Litige ouvert'}
          </h2>
          <p className="text-sm text-gray-500">
            {alreadyDone
              ? 'Cette livraison a déjà été confirmée. Les fonds ont été distribués.'
              : 'Un litige est en cours sur cette transaction. Notre équipe vous contactera.'}
          </p>
        </div>
      </div>
    )
  }

  if (done === 'confirmed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 text-center max-w-sm w-full">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Réception confirmée !</h2>
          <p className="text-sm text-gray-600 mb-4">
            Merci ! Les fonds ont été libérés et distribués.
          </p>
          {cashback > 0 && (
            <div className="bg-brand-50 border border-brand-200 rounded-xl p-3 mb-4">
              <p className="text-brand-700 text-sm font-semibold">
                🔥 +{cashback.toLocaleString('fr-FR')} FCFA de cashback crédités sur votre wallet !
              </p>
            </div>
          )}
          <div className="text-xs text-gray-400 mb-4">Ubuntu en action 🌍</div>
          <a href="/dashboard" className="block bg-brand-600 text-white py-3 rounded-xl font-semibold text-sm">
            Retour à l&apos;accueil
          </a>
        </div>
      </div>
    )
  }

  if (done === 'disputed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-200 text-center max-w-sm w-full">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Litige enregistré</h2>
          <p className="text-sm text-gray-600 mb-4">
            Notre équipe va examiner votre demande et vous recontactera rapidement par WhatsApp.
          </p>
          <p className="text-xs text-gray-400 mb-4">Les fonds restent bloqués jusqu&apos;à résolution.</p>
          <a href="/dashboard" className="block bg-gray-800 text-white py-3 rounded-xl font-semibold text-sm">
            Retour à l&apos;accueil
          </a>
        </div>
      </div>
    )
  }

  const merchantName = (tx.merchants as { business_name: string } | null)?.business_name ?? 'le marchand'

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 max-w-sm w-full overflow-hidden">
        {/* Header */}
        <div className="bg-brand-600 p-6 text-center">
          <div className="text-5xl mb-2">📦</div>
          <h1 className="text-white text-xl font-bold">Confirmer la livraison</h1>
          <p className="text-brand-200 text-sm mt-1">GreenFlame Delivery</p>
        </div>

        {/* Détails */}
        <div className="p-6">
          <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Marchand</span>
              <span className="font-semibold text-gray-800">{merchantName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Montant payé</span>
              <span className="font-bold text-gray-900">{tx.amount_fcfa.toLocaleString('fr-FR')} FCFA</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Statut</span>
              <span className="text-amber-600 font-medium">⏳ En attente de confirmation</span>
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-5">
            Avez-vous bien reçu votre commande dans les mains et êtes-vous satisfait(e) ?
          </p>

          {/* CTA principal */}
          {!showDispute ? (
            <>
              <button
                onClick={confirmDelivery}
                disabled={submitting}
                className="w-full bg-green-600 text-white py-4 rounded-xl font-bold text-base hover:bg-green-700 disabled:opacity-50 transition-colors mb-3"
              >
                {submitting ? 'Confirmation…' : '✅ Oui, j\'ai reçu ma commande'}
              </button>
              <button
                onClick={() => setShowDispute(true)}
                className="w-full text-red-500 text-sm py-2 hover:underline transition-colors"
              >
                ❌ Non, il y a un problème
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <h3 className="font-semibold text-gray-800 text-sm">Décrivez le problème :</h3>
              <textarea
                value={disputeReason}
                onChange={e => setDisputeReason(e.target.value)}
                placeholder="Ex: Colis non reçu, produit endommagé, mauvais article…"
                rows={3}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-red-400 resize-none"
              />
              <button
                onClick={openDispute}
                disabled={submitting}
                className="w-full bg-red-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {submitting ? 'Envoi…' : 'Ouvrir un litige'}
              </button>
              <button onClick={() => setShowDispute(false)} className="w-full text-gray-400 text-sm py-1 hover:text-gray-600">
                Annuler
              </button>
            </div>
          )}

          <p className="text-[10px] text-gray-400 text-center mt-4">
            Sans action de votre part, les fonds seront libérés automatiquement après 48h.
          </p>
        </div>
      </div>
    </div>
  )
}
