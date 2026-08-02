'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'

export default function VisitRowActions({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function setStatus(next: string) {
    setBusy(true)
    const res = await fetch(`/api/business/immobilier/visites/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: next }),
    })
    setBusy(false)
    if (!res.ok) { toast.error('Erreur lors de la mise à jour'); return }
    router.refresh()
  }

  const btn: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 6,
    border: '1px solid #E2E8F0', background: '#fff', color: '#374151', cursor: 'pointer', marginLeft: 6,
  }

  if (status !== 'planifiee') return null

  return (
    <span>
      <button disabled={busy} onClick={() => setStatus('effectuee')} style={{ ...btn, borderColor: '#BBF7D0', background: '#F0FDF4', color: '#16A34A' }}>
        Effectuée
      </button>
      <button disabled={busy} onClick={() => setStatus('annulee')} style={{ ...btn, borderColor: '#FECACA', background: '#FEF2F2', color: '#EF4444' }}>
        Annuler
      </button>
    </span>
  )
}
