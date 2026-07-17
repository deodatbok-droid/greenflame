'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

interface Props {
  id: string
  senderName: string
}

export default function InvitationCard({ id, senderName }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState<'accept' | 'refuse' | null>(null)
  const [done, setDone] = useState(false)

  async function respond(action: 'accept' | 'refuse') {
    setLoading(action)
    try {
      const res = await fetch(`/api/messages/invitations/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Erreur'); return }
      setDone(true)
      if (action === 'accept' && data.conversationId) {
        router.push(`/messages/${data.conversationId}`)
      } else {
        router.refresh()
      }
    } finally {
      setLoading(null)
    }
  }

  if (done) return null

  return (
    <div className="flex items-center gap-3 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3">
      <div className="w-9 h-9 rounded-full bg-brand-200 flex items-center justify-center flex-shrink-0 text-brand-800 font-bold text-sm">
        {senderName.charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 truncate">{senderName}</p>
        <p className="text-xs text-brand-600">t&apos;invite à discuter</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => respond('refuse')}
          disabled={!!loading}
          className="text-xs px-2.5 py-1.5 border border-gray-200 bg-white rounded-lg text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {loading === 'refuse' ? '…' : 'Refuser'}
        </button>
        <button
          onClick={() => respond('accept')}
          disabled={!!loading}
          className="text-xs px-2.5 py-1.5 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors disabled:opacity-50 font-medium"
        >
          {loading === 'accept' ? '…' : 'Accepter'}
        </button>
      </div>
    </div>
  )
}
