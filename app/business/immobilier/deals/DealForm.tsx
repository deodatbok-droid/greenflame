'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Property { id: string; title: string }
interface SplitRow { business_id: string; name: string; role: 'lister' | 'closer' | 'autre'; percentage: string; isSelf?: boolean }

const ROLE_OPTIONS: Array<{ value: SplitRow['role']; label: string }> = [
  { value: 'lister', label: 'Gestionnaire du bien' },
  { value: 'closer', label: 'Apporteur du client' },
  { value: 'autre',  label: 'Autre' },
]

export default function DealForm({ properties, ownBusinessName }: { properties: Property[]; ownBusinessName: string }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [bizPropertyId, setBizPropertyId] = useState(properties[0]?.id ?? '')
  const [commission, setCommission]       = useState('')
  const [notes, setNotes]                 = useState('')
  const [splits, setSplits] = useState<SplitRow[]>([
    { business_id: '__self__', name: `${ownBusinessName} (vous)`, role: 'lister', percentage: '100', isSelf: true },
  ])

  const [partnerSlug, setPartnerSlug]   = useState('')
  const [partnerError, setPartnerError] = useState('')
  const [lookingUp, setLookingUp]       = useState(false)

  const totalPercentage = splits.reduce((sum, s) => sum + (parseFloat(s.percentage) || 0), 0)

  async function addPartner() {
    if (!partnerSlug.trim()) return
    setLookingUp(true)
    setPartnerError('')
    const res = await fetch(`/api/business/immobilier/deals/partner?slug=${encodeURIComponent(partnerSlug.trim())}`)
    const json = await res.json().catch(() => ({}))
    setLookingUp(false)
    if (!res.ok) { setPartnerError((json as { error?: string }).error ?? 'Partenaire introuvable'); return }
    if (splits.some(s => s.business_id === json.id)) { setPartnerError('Déjà ajouté à la répartition'); return }
    setSplits(prev => [...prev, { business_id: json.id, name: json.name, role: 'closer', percentage: '0' }])
    setPartnerSlug('')
  }

  function removeSplit(businessId: string) {
    setSplits(prev => prev.filter(s => s.business_id !== businessId))
  }

  function updateSplit(businessId: string, patch: Partial<SplitRow>) {
    setSplits(prev => prev.map(s => s.business_id === businessId ? { ...s, ...patch } : s))
  }

  async function save() {
    if (!bizPropertyId) { setError('Sélectionnez un bien'); return }
    const commissionNum = Number(commission)
    if (!commission || commissionNum <= 0) { setError('Montant de commission requis'); return }
    if (Math.round(totalPercentage * 100) !== 10000) { setError(`La répartition doit totaliser 100% (actuel : ${totalPercentage}%)`); return }

    setSaving(true)
    setError('')

    const res = await fetch('/api/business/immobilier/deals', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        biz_property_id: bizPropertyId,
        commission_amount_fcfa: commissionNum,
        notes: notes.trim() || null,
        splits: splits.map(s => ({
          business_id: s.isSelf ? undefined : s.business_id,
          role: s.role,
          percentage: parseFloat(s.percentage) || 0,
        })),
      }),
    })

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError((j as { error?: string }).error ?? 'Erreur lors de la sauvegarde')
      setSaving(false)
      return
    }
    router.push('/business/immobilier/deals')
  }

  // Le split "vous" doit recevoir votre propre business_id, résolu côté serveur.
  // On envoie business_id=undefined pour la ligne self ; l'API le remplace par le déclarant.

  return (
    <div style={{ padding: '28px 32px', maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/business/immobilier/deals" style={{ fontSize: 12, color: '#64748B', textDecoration: 'none' }}>← Deals</a>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '8px 0 0' }}>Déclarer un deal</h1>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '28px 28px' }}>

        {properties.length === 0 ? (
          <p style={{ fontSize: 13, color: '#EF4444' }}>
            Ajoutez d&apos;abord un bien avant de déclarer un deal.
          </p>
        ) : (
          <>
            <Field label="Bien concerné *">
              <select value={bizPropertyId} onChange={e => setBizPropertyId(e.target.value)} style={inp}>
                {properties.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </Field>

            <Field label="Commission totale conclue (FCFA) *">
              <input type="number" min="1" value={commission} onChange={e => setCommission(e.target.value)} placeholder="Ex : 150000" style={inp} />
            </Field>

            <p style={{ fontSize: 11, color: '#94A3B8', marginTop: -6, marginBottom: 14 }}>
              Un forfait plateforme de 2 000 FCFA sera prélevé sur votre wallet au règlement, en plus de la répartition ci-dessous.
            </p>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>
                Répartition de la commission * — total : {totalPercentage}%
              </label>

              <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
                {splits.map((s, i) => (
                  <div key={s.business_id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: '10px 12px', borderTop: i > 0 ? '1px solid #F1F5F9' : 'none' }}>
                    <span style={{ flex: '1 1 100px', minWidth: 0, fontSize: 13, fontWeight: 600, color: '#0F172A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.name}
                    </span>
                    <select value={s.role} onChange={e => updateSplit(s.business_id, { role: e.target.value as SplitRow['role'] })} style={{ ...inp, width: 150, padding: '7px 9px', fontSize: 12 }}>
                      {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <input
                      type="number" min="0" max="100" value={s.percentage}
                      onChange={e => updateSplit(s.business_id, { percentage: e.target.value })}
                      style={{ ...inp, width: 64, padding: '7px 9px', fontSize: 12, textAlign: 'right' }}
                    />
                    <span style={{ fontSize: 12, color: '#94A3B8' }}>%</span>
                    {!s.isSelf && (
                      <button onClick={() => removeSplit(s.business_id)} style={{ border: 'none', background: 'none', color: '#EF4444', fontSize: 13, cursor: 'pointer', padding: 4 }}>
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <input
                  value={partnerSlug} onChange={e => setPartnerSlug(e.target.value)}
                  placeholder="Identifiant du démarcheur partenaire"
                  style={{ ...inp, flex: 1 }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPartner() } }}
                />
                <button
                  onClick={addPartner} disabled={lookingUp || !partnerSlug.trim()}
                  style={{ padding: '10px 16px', borderRadius: 9, border: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', whiteSpace: 'nowrap' }}
                >
                  {lookingUp ? 'Recherche…' : '+ Ajouter'}
                </button>
              </div>
              {partnerError && <p style={{ fontSize: 12, color: '#EF4444', marginTop: 6 }}>{partnerError}</p>}
            </div>

            <Field label="Notes">
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Détails de la transaction…" style={{ ...inp, resize: 'vertical' }} />
            </Field>

            {error && (
              <p style={{ fontSize: 13, color: '#EF4444', padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, marginTop: 8 }}>
                {error}
              </p>
            )}

            <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
              <button
                onClick={() => router.push('/business/immobilier/deals')}
                style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
              >
                Annuler
              </button>
              <button
                onClick={save}
                disabled={saving}
                style={{
                  flex: 2, padding: '13px', borderRadius: 10, border: 'none',
                  background: saving ? '#94A3B8' : '#22C55E',
                  color: '#fff', fontWeight: 700, fontSize: 14,
                  cursor: saving ? 'not-allowed' : 'pointer',
                }}
              >
                {saving ? 'Enregistrement…' : 'Déclarer le deal →'}
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

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 9,
  border: '1px solid #CBD5E1', fontSize: 13, color: '#0F172A',
  outline: 'none', boxSizing: 'border-box', background: '#fff',
}
