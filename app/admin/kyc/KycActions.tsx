'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

type KycPreDecision = 'auto_approve' | 'needs_review' | 'auto_reject' | null

interface Props {
  submissionId:  string
  aiPreDecision: KycPreDecision
}

export default function KycActions({ submissionId, aiPreDecision }: Props) {
  const router           = useRouter()
  const [loading, setLoading]       = useState(false)
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason]         = useState('')

  async function decide(decision: 'approved' | 'rejected') {
    setLoading(true)
    const res = await fetch('/api/kyc/review', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ submissionId, decision, reason: reason || undefined }),
    })
    setLoading(false)

    if (!res.ok) {
      const d = await res.json()
      toast.error(d.error ?? 'Erreur')
      return
    }

    toast.success(decision === 'approved' ? '✅ KYC approuvé' : '❌ KYC refusé')
    router.refresh()
  }

  // Bouton rapide "Confirmer décision IA"
  const ConfirmAiBtn = () => {
    if (aiPreDecision === 'auto_approve') {
      return (
        <button
          onClick={() => decide('approved')}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm py-2 rounded-lg font-medium transition-colors disabled:opacity-50 mb-2"
        >
          {loading ? '…' : '🤖 Confirmer approbation IA'}
        </button>
      )
    }
    if (aiPreDecision === 'auto_reject') {
      return (
        <button
          onClick={() => { setReason('Document non conforme (décision IA confirmée)'); setShowReject(true) }}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 bg-red-700/60 hover:bg-red-700 text-red-200 text-sm py-2 rounded-lg transition-colors disabled:opacity-50 mb-2"
        >
          🤖 Confirmer refus IA
        </button>
      )
    }
    return null
  }

  return (
    <div className="mt-4 pt-4 border-t border-gray-700">
      <ConfirmAiBtn />

      {showReject ? (
        <div className="space-y-2">
          <input
            type="text"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Raison du refus (optionnel)"
            className="w-full bg-gray-700 text-white text-sm px-3 py-2 rounded-lg border border-gray-600 focus:border-red-500 focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => decide('rejected')}
              disabled={loading}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? 'Traitement...' : 'Confirmer le refus'}
            </button>
            <button
              onClick={() => { setShowReject(false); setReason('') }}
              className="px-4 bg-gray-700 text-gray-300 text-sm py-2 rounded-lg hover:bg-gray-600"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button
            onClick={() => decide('approved')}
            disabled={loading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {loading ? '…' : '✓ Approuver'}
          </button>
          <button
            onClick={() => setShowReject(true)}
            disabled={loading}
            className="flex-1 bg-red-900/40 hover:bg-red-900/60 text-red-400 text-sm py-2 rounded-lg transition-colors"
          >
            ✕ Refuser
          </button>
        </div>
      )}
    </div>
  )
}
