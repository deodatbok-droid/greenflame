'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/**
 * components/messaging/ContactButton.tsx
 *
 * Bouton générique "Contacter" pour le chat marchand↔client lié à une
 * commande. Composant client minimal volontairement séparé de
 * MesAchatsClient/merchant/history (qui ne sont pas tous deux des client
 * components) pour pouvoir être importé directement dans un Server
 * Component (app/merchant/history/page.tsx) sans avoir à le convertir.
 *
 * Résolution de la conversation côté serveur uniquement (transactionId) —
 * ce composant n'a besoin de connaître ni le merchant_id ni le buyer_id.
 */
interface Props {
  transactionId: string
  label?: string
  className?: string
}

export default function ContactButton({ transactionId, label = '💬 Contacter', className }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    setLoading(true)
    try {
      const res = await fetch(`/api/messages/conversations/order/${transactionId}`, { method: 'POST' })
      if (!res.ok) throw new Error('failed')
      const data = await res.json() as { conversationId: string }
      router.push(`/messages/${data.conversationId}`)
    } catch {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={className ?? 'text-xs font-semibold text-brand-600 hover:underline disabled:opacity-50'}
    >
      {loading ? '…' : label}
    </button>
  )
}
