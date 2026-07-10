'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function ResetPinPanel({ userId }: { userId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleReset() {
    setLoading(true)
    const res = await fetch('/api/admin/reset-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId: userId }),
    })
    const data = await res.json()
    setLoading(false)

    if (!res.ok) {
      toast.error(data.error ?? 'Erreur lors de la réinitialisation')
      return
    }

    toast.success('PIN réinitialisé — l\'utilisateur peut définir un nouveau code PIN')
    setConfirming(false)
    router.refresh()
  }

  return (
    <div className="mt-3 border border-red-800/50 bg-red-950/20 rounded-xl p-4 space-y-3">
      <p className="text-sm font-bold text-red-400">🔐 Réinitialiser le PIN</p>

      {!confirming ? (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">
            Supprime le code PIN de l&apos;utilisateur. Il pourra en définir un nouveau à sa prochaine connexion.
          </p>
          <button
            onClick={() => setConfirming(true)}
            className="w-full bg-red-900/40 hover:bg-red-900/60 border border-red-700/50 text-red-300 text-sm font-semibold py-2 rounded-lg transition-colors"
          >
            Réinitialiser le PIN →
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-red-300 font-medium">
            ⚠️ Confirmer la réinitialisation du PIN ?
          </p>
          <p className="text-xs text-gray-400">
            Cette action est immédiate et irréversible. L&apos;utilisateur devra créer un nouveau PIN.
          </p>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              disabled={loading}
              className="flex-1 bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-bold py-2 rounded-lg transition-colors"
            >
              {loading ? 'Réinitialisation...' : '✓ Confirmer'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="px-4 bg-gray-700 text-gray-300 text-sm py-2 rounded-lg hover:bg-gray-600"
            >
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
