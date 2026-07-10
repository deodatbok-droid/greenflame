'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

/**
 * components/messaging/CercleUplineCard.tsx
 *
 * Point d'entrée Palier 1 — discussion de groupe avec le cercle de l'upline
 * direct (achat seul, pas de KYC). Composant client minimal, même
 * convention que ContactButton : résolution de la conversation côté serveur
 * uniquement (rien à transmettre, tout se déduit de l'utilisateur connecté).
 */
export default function CercleUplineCard() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/messages/conversations/cercle-upline', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erreur')
      router.push(`/messages/${data.conversationId}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur')
      setLoading(false)
    }
  }

  return (
    <button onClick={handleClick} disabled={loading} className="w-full text-left disabled:opacity-60">
      <div className="flex items-center gap-4 bg-gradient-to-r from-indigo-600 to-indigo-800 rounded-2xl px-4 py-3 text-white hover:from-indigo-700 hover:to-indigo-900 transition-all">
        <span className="text-3xl">💬</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm leading-none">Cercle de mon leader communautaire</p>
          <p className="text-indigo-200 text-xs mt-0.5">{loading ? 'Ouverture…' : 'Discussion avec votre cercle direct'}</p>
        </div>
        <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-indigo-300 flex-shrink-0">
          <path fillRule="evenodd" d="M3 10a.75.75 0 0 1 .75-.75h10.638L10.23 5.29a.75.75 0 1 1 1.04-1.08l5.5 5.25a.75.75 0 0 1 0 1.08l-5.5 5.25a.75.75 0 1 1-1.04-1.08l4.158-3.96H3.75A.75.75 0 0 1 3 10Z" clipRule="evenodd" />
        </svg>
      </div>
    </button>
  )
}
