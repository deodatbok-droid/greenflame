'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Property { id: string; title: string }
interface Customer { id: string; name: string; phone: string | null }

export default function VisitForm({ properties, customers }: { properties: Property[]; customers: Customer[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [bizPropertyId, setBizPropertyId] = useState(properties[0]?.id ?? '')
  const [customerId, setCustomerId]       = useState('')
  const [scheduledAt, setScheduledAt]     = useState('')
  const [notes, setNotes]                 = useState('')

  async function save() {
    if (!bizPropertyId) { setError('Sélectionnez un bien'); return }
    if (!scheduledAt) { setError('La date de visite est requise'); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/business/immobilier/visites', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        biz_property_id: bizPropertyId,
        customer_id:     customerId || null,
        scheduled_at:    new Date(scheduledAt).toISOString(),
        notes:           notes.trim() || null,
      }),
    })

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError((j as { error?: string }).error ?? 'Erreur lors de la sauvegarde')
      setSaving(false)
      return
    }
    router.push('/business/immobilier/visites')
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/business/immobilier/visites" style={{ fontSize: 12, color: '#64748B', textDecoration: 'none' }}>← Visites</a>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '8px 0 0' }}>Planifier une visite</h1>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '28px 28px' }}>

        {properties.length === 0 ? (
          <p style={{ fontSize: 13, color: '#EF4444' }}>
            Ajoutez d&apos;abord un bien avant de planifier une visite.
          </p>
        ) : (
          <>
            <Field label="Bien concerné *">
              <select value={bizPropertyId} onChange={e => setBizPropertyId(e.target.value)} style={inp}>
                {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>

            <Field label="Client">
              <select value={customerId} onChange={e => setCustomerId(e.target.value)} style={inp}>
                <option value="">— Aucun client lié —</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>
                ))}
              </select>
              {customers.length === 0 && (
                <p style={{ fontSize: 11, color: '#94A3B8', marginTop: 6 }}>
                  Aucun client enregistré pour l&apos;instant — vous pourrez en lier un plus tard.
                </p>
              )}
            </Field>

            <Field label="Date et heure *">
              <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} style={inp} />
            </Field>

            <Field label="Notes">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Détails de la visite…" style={{ ...inp, resize: 'vertical' }} />
            </Field>

            {error && (
              <p style={{ fontSize: 13, color: '#EF4444', padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, marginTop: 8 }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => router.push('/business/immobilier/visites')}
                style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving || !scheduledAt}
                style={{
                  flex: 2, padding: '13px', borderRadius: 10, border: 'none',
                  background: saving || !scheduledAt ? '#94A3B8' : '#22C55E',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: saving || !scheduledAt ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Enregistrement…' : 'Planifier la visite →'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 9,
  border: '1px solid #CBD5E1', fontSize: 13, color: '#0F172A',
  outline: 'none', boxSizing: 'border-box', background: '#fff',
}
