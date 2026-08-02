'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Property { id: string; title: string }

export default function MandatForm({ properties }: { properties: Property[] }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [bizPropertyId, setBizPropertyId] = useState(properties[0]?.id ?? '')
  const [ownerName, setOwnerName]         = useState('')
  const [ownerPhone, setOwnerPhone]       = useState('')
  const [mandatType, setMandatType]       = useState<'exclusif' | 'simple'>('simple')
  const [expiresAt, setExpiresAt]         = useState('')
  const [notes, setNotes]                 = useState('')

  async function save() {
    if (!bizPropertyId) { setError('Sélectionnez un bien'); return }
    if (!ownerName.trim()) { setError('Le nom du propriétaire est requis'); return }
    setSaving(true)
    setError('')

    const res = await fetch('/api/business/immobilier/mandats', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        biz_property_id: bizPropertyId,
        owner_name:      ownerName.trim(),
        owner_phone:     ownerPhone.trim() || null,
        mandat_type:     mandatType,
        expires_at:      expiresAt || null,
        notes:           notes.trim() || null,
      }),
    })

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError((j as { error?: string }).error ?? 'Erreur lors de la sauvegarde')
      setSaving(false)
      return
    }
    router.push('/business/immobilier/mandats')
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/business/immobilier/mandats" style={{ fontSize: 12, color: '#64748B', textDecoration: 'none' }}>← Mandats</a>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '8px 0 0' }}>Nouveau mandat</h1>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '28px 28px' }}>

        {properties.length === 0 ? (
          <p style={{ fontSize: 13, color: '#EF4444' }}>
            Ajoutez d&apos;abord un bien avant de créer un mandat.
          </p>
        ) : (
          <>
            <Field label="Bien concerné *">
              <select value={bizPropertyId} onChange={e => setBizPropertyId(e.target.value)} style={inp}>
                {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>

            <Row>
              <Field label="Nom du propriétaire *">
                <input value={ownerName} onChange={e => setOwnerName(e.target.value)} placeholder="Ex : M. Kponou" style={inp} />
              </Field>
              <Field label="Téléphone du propriétaire">
                <input value={ownerPhone} onChange={e => setOwnerPhone(e.target.value)} placeholder="+229 …" style={inp} />
              </Field>
            </Row>

            <Row>
              <Field label="Type de mandat">
                <select value={mandatType} onChange={e => setMandatType(e.target.value as 'exclusif' | 'simple')} style={inp}>
                  <option value="simple">Simple</option>
                  <option value="exclusif">Exclusif</option>
                </select>
              </Field>
              <Field label="Échéance">
                <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} style={inp} />
              </Field>
            </Row>

            <Field label="Notes">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Conditions particulières…" style={{ ...inp, resize: 'vertical' }} />
            </Field>

            {error && (
              <p style={{ fontSize: 13, color: '#EF4444', padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, marginTop: 8 }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => router.push('/business/immobilier/mandats')}
                style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving || !ownerName.trim()}
                style={{
                  flex: 2, padding: '13px', borderRadius: 10, border: 'none',
                  background: saving || !ownerName.trim() ? '#94A3B8' : '#22C55E',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: saving || !ownerName.trim() ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Enregistrement…' : 'Enregistrer le mandat →'}
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
    <div style={{ marginBottom: 14, flex: 1 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>{children}</div>
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 9,
  border: '1px solid #CBD5E1', fontSize: 13, color: '#0F172A',
  outline: 'none', boxSizing: 'border-box', background: '#fff',
}
