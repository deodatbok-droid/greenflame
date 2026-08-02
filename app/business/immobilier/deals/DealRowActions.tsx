'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function DealRowActions({ id, status, isDeclarant }: { id: string; status: string; isDeclarant: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  if (!isDeclarant || status !== 'declared') return null

  async function settle() {
    if (!confirm('Régler ce deal ? Le forfait plateforme sera prélevé sur votre wallet et la commission répartie entre les bénéficiaires. Cette action est irréversible.')) return
    setBusy(true)
    const res = await fetch(`/api/business/immobilier/deals/${id}/settle`, { method: 'POST' })
    setBusy(false)
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      toast.error((j as { error?: string }).error ?? 'Erreur lors du règlement')
      return
    }
    toast.success('Deal réglé')
    router.refresh()
  }

  async function remove() {
    if (!confirm('Supprimer ce deal déclaré ?')) return
    setBusy(true)
    const res = await fetch(`/api/business/immobilier/deals/${id}`, { method: 'DELETE' })
    setBusy(false)
    if (!res.ok) { toast.error('Erreur lors de la suppression'); return }
    router.refresh()
  }

  const btn: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
    border: '1px solid #E2E8F0', background: '#fff', color: '#374151', cursor: 'pointer', marginLeft: 6,
  }

  return (
    <span>
      <button disabled={busy} onClick={settle} style={{ ...btn, borderColor: '#BBF7D0', background: '#F0FDF4', color: '#16A34A' }}>
        Régler
      </button>
      <button disabled={busy} onClick={remove} style={{ ...btn, borderColor: '#FECACA', background: '#FEF2F2', color: '#EF4444' }}>
        Supprimer
      </button>
    </span>
  )
}
