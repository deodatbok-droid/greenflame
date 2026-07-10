'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  withdrawalId: string
}

export default function WithdrawActionButton({ withdrawalId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  async function handle(action: 'approve' | 'reject') {
    setLoading(action)
    setError(null)
    try {
      const res = await fetch(`/api/admin/withdrawals/${withdrawalId}/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Erreur')
      } else {
        setDone(action === 'approve' ? 'Approuve' : 'Refuse')
        router.refresh()
      }
    } catch {
      setError('Erreur de connexion')
    } finally {
      setLoading(null)
    }
  }

  if (done) {
    return (
      <span className={`text-xs px-2 py-1 rounded-lg ${done === 'Approuve' ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
        {done}
      </span>
    )
  }

  return (
    <div className="flex gap-2 items-center">
      <button
        onClick={() => handle('approve')}
        disabled={!!loading}
        className="bg-green-700 hover:bg-green-600 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded-lg transition-colors"
      >
        {loading === 'approve' ? '...' : 'Approuver'}
      </button>
      <button
        onClick={() => handle('reject')}
        disabled={!!loading}
        className="bg-red-900/40 hover:bg-red-800/60 disabled:opacity-50 text-red-400 text-xs px-3 py-1.5 rounded-lg transition-colors"
      >
        {loading === 'reject' ? '...' : 'Refuser'}
      </button>
      {error && <span className="text-red-400 text-xs">{error}</span>}
    </div>
  )
}
