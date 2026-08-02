'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const PROPERTY_TYPES = [
  { value: 'appartement',      label: 'Appartement' },
  { value: 'maison_villa',     label: 'Maison / Villa' },
  { value: 'terrain_parcelle', label: 'Terrain / Parcelle' },
  { value: 'local_commercial', label: 'Local commercial' },
  { value: 'bureau',           label: 'Bureau' },
]

const STATUSES = [
  { value: 'disponible', label: 'Disponible' },
  { value: 'loue',       label: 'Loué' },
  { value: 'vendu',      label: 'Vendu' },
  { value: 'suspendu',   label: 'Suspendu' },
]

export interface PropertyFormValues {
  id?: string
  title: string
  listing_type: 'location' | 'vente'
  property_type: string
  price_fcfa: string
  price_period: 'mensuel' | 'unique'
  surface_m2: string
  rooms: string
  city: string
  neighborhood: string
  address_text: string
  photos: string[]
  description: string
  gf_listed: boolean
  status: string
}

export const EMPTY_PROPERTY: PropertyFormValues = {
  title: '', listing_type: 'location', property_type: 'appartement',
  price_fcfa: '', price_period: 'mensuel', surface_m2: '', rooms: '',
  city: '', neighborhood: '', address_text: '', photos: [],
  description: '', gf_listed: false, status: 'disponible',
}

export default function PropertyForm({ initial }: { initial: PropertyFormValues }) {
  const router   = useRouter()
  const isEdit   = !!initial.id
  const [saving, setSaving]     = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState('')
  const [form, setForm]         = useState<PropertyFormValues>(initial)

  function set<K extends keyof PropertyFormValues>(k: K, v: PropertyFormValues[K]) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function uploadPhoto(file: File) {
    if (file.size > 5 * 1024 * 1024) { toast.error('Image trop volumineuse (max 5 Mo)'); return }
    setUploading(true)
    try {
      const supabase = createClient()
      const ext  = file.name.split('.').pop() ?? 'jpg'
      const path = `${Date.now()}-${Math.round(Math.random() * 1e6)}.${ext}`
      const { error } = await supabase.storage.from('property-images').upload(path, file, { upsert: true })
      if (error) { toast.error("Erreur d'envoi : " + error.message); return }
      const { data: { publicUrl } } = supabase.storage.from('property-images').getPublicUrl(path)
      set('photos', [...form.photos, publicUrl])
      toast.success('Photo ajoutée')
    } finally {
      setUploading(false)
    }
  }

  function removePhoto(url: string) {
    set('photos', form.photos.filter(p => p !== url))
  }

  async function save() {
    if (!form.title.trim()) { setError('Le titre est requis'); return }
    if (!form.price_fcfa || parseFloat(form.price_fcfa) <= 0) { setError('Le prix est requis'); return }
    setSaving(true)
    setError('')

    const payload = {
      title:         form.title.trim(),
      listing_type:  form.listing_type,
      property_type: form.property_type,
      price_fcfa:    parseFloat(form.price_fcfa),
      price_period:  form.listing_type === 'location' ? form.price_period : 'unique',
      surface_m2:    form.surface_m2 ? parseFloat(form.surface_m2) : null,
      rooms:         form.rooms ? parseInt(form.rooms) : null,
      city:          form.city.trim() || null,
      neighborhood:  form.neighborhood.trim() || null,
      address_text:  form.address_text.trim() || null,
      photos:        form.photos,
      description:   form.description.trim() || null,
      gf_listed:     form.gf_listed,
      status:        form.status,
    }

    const res = isEdit
      ? await fetch(`/api/business/immobilier/biens/${initial.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
      : await fetch('/api/business/immobilier/biens', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })

    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError((j as { error?: string }).error ?? 'Erreur lors de la sauvegarde')
      setSaving(false)
      return
    }
    router.push('/business/immobilier')
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/business/immobilier" style={{ fontSize: 12, color: '#64748B', textDecoration: 'none' }}>← Immobilier</a>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '8px 0 0' }}>
          {isEdit ? 'Modifier le bien' : 'Nouveau bien'}
        </h1>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '28px 28px' }}>

        <Section title="Type d'annonce">
          <Row>
            <Field label="Annonce *">
              <select value={form.listing_type} onChange={e => set('listing_type', e.target.value as 'location' | 'vente')} style={inp}>
                <option value="location">À louer</option>
                <option value="vente">À vendre</option>
              </select>
            </Field>
            <Field label="Type de bien *">
              <select value={form.property_type} onChange={e => set('property_type', e.target.value)} style={inp}>
                {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          </Row>
        </Section>

        <Divider />

        <Section title="Informations générales">
          <Field label="Titre de l'annonce *">
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex : Appartement 3 pièces à Fidjrossè" style={inp} />
          </Field>
          <Row>
            <Field label="Surface (m²)">
              <input type="number" min="0" value={form.surface_m2} onChange={e => set('surface_m2', e.target.value)} placeholder="0" style={inp} />
            </Field>
            <Field label="Nombre de pièces">
              <input type="number" min="0" value={form.rooms} onChange={e => set('rooms', e.target.value)} placeholder="0" style={inp} />
            </Field>
          </Row>
          <Field label="Description">
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={4} placeholder="Détails du bien, équipements, conditions…" style={{ ...inp, resize: 'vertical' }} />
          </Field>
        </Section>

        <Divider />

        <Section title="Localisation">
          <Row>
            <Field label="Ville">
              <input value={form.city} onChange={e => set('city', e.target.value)} placeholder="Cotonou" style={inp} />
            </Field>
            <Field label="Quartier">
              <input value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)} placeholder="Fidjrossè" style={inp} />
            </Field>
          </Row>
          <Field label="Adresse précise">
            <input value={form.address_text} onChange={e => set('address_text', e.target.value)} placeholder="Rue, repère…" style={inp} />
          </Field>
        </Section>

        <Divider />

        <Section title="Prix">
          <Row>
            <Field label="Prix (FCFA) *">
              <input type="number" min="0" value={form.price_fcfa} onChange={e => set('price_fcfa', e.target.value)} placeholder="0" style={inp} />
            </Field>
            {form.listing_type === 'location' && (
              <Field label="Périodicité">
                <select value={form.price_period} onChange={e => set('price_period', e.target.value as 'mensuel' | 'unique')} style={inp}>
                  <option value="mensuel">Par mois</option>
                  <option value="unique">Montant unique</option>
                </select>
              </Field>
            )}
          </Row>
        </Section>

        <Divider />

        <Section title="Photos">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
            {form.photos.map(url => (
              // eslint-disable-next-line @next/next/no-img-element
              <div key={url} style={{ position: 'relative', width: 84, height: 84 }}>
                <img src={url} alt="" style={{ width: 84, height: 84, borderRadius: 10, objectFit: 'cover' }} />
                <button
                  onClick={() => removePhoto(url)}
                  style={{
                    position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                    border: 'none', background: '#EF4444', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >×</button>
              </div>
            ))}
            <label style={{
              width: 84, height: 84, borderRadius: 10, border: '2px dashed #CBD5E1',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, color: '#64748B', cursor: uploading ? 'not-allowed' : 'pointer', textAlign: 'center',
            }}>
              {uploading ? '…' : '+ Ajouter'}
              <input
                type="file" accept="image/*" disabled={uploading} style={{ display: 'none' }}
                onChange={e => { const file = e.target.files?.[0]; if (file) uploadPhoto(file); e.target.value = '' }}
              />
            </label>
          </div>
        </Section>

        {isEdit && (
          <>
            <Divider />
            <Section title="Statut">
              <select value={form.status} onChange={e => set('status', e.target.value)} style={inp}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </Section>
          </>
        )}

        <Divider />

        <Section title="GreenFlame">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox" checked={form.gf_listed} onChange={e => set('gf_listed', e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#22C55E', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: '#374151' }}>
              <strong>Publier sur le catalogue Immobilier GreenFlame</strong> — ce bien sera visible dans le catalogue public dès son ouverture
            </span>
          </label>
        </Section>

        {error && (
          <p style={{ fontSize: 13, color: '#EF4444', padding: '10px 14px', background: '#FEF2F2', borderRadius: 8, marginTop: 20 }}>
            {error}
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, marginTop: 28 }}>
          <button
            onClick={() => router.push('/business/immobilier')}
            style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
          >
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving || uploading || !form.title.trim()}
            style={{
              flex: 2, padding: '13px', borderRadius: 10, border: 'none',
              background: saving || uploading || !form.title.trim() ? '#94A3B8' : '#22C55E',
              color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: saving || uploading || !form.title.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Enregistrement…' : isEdit ? 'Enregistrer les modifications' : 'Enregistrer le bien →'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 4 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 16 }}>{title}</p>
      {children}
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
  return <div style={{ display: 'flex', gap: 14 }}>{children}</div>
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid #F1F5F9', margin: '20px 0' }} />
}

const inp: React.CSSProperties = {
  width: '100%', padding: '10px 13px', borderRadius: 9,
  border: '1px solid #CBD5E1', fontSize: 13, color: '#0F172A',
  outline: 'none', boxSizing: 'border-box', background: '#fff',
}
