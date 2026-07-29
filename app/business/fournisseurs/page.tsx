'use client'

import { useState, useEffect, useCallback } from 'react'

interface Supplier {
  id: string
  name: string
  contact_name: string | null
  email: string | null
  phone: string | null
  country: string | null
  created_at: string
}

export default function FournisseursPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', contact_name: '', email: '', phone: '', country: '', address: '' })
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    fetch('/api/business/fournisseurs').then(r => r.json()).then(d => setSuppliers(d.suppliers ?? []))
  }, [])
  useEffect(() => { load() }, [load])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setErr('')
    const res = await fetch('/api/business/fournisseurs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) { setErr((await res.json()).error ?? 'Erreur'); setLoading(false); return }
    setForm({ name: '', contact_name: '', email: '', phone: '', country: '', address: '' })
    setShowForm(false)
    load()
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 24 }}>
        <div>
          <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Inventaire</p>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Fournisseurs</h1>
        </div>
        <button onClick={() => setShowForm(s => !s)}
          style={{ padding: '9px 20px', borderRadius: 8, background: '#22C55E', color: '#fff', fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
          {showForm ? '× Annuler' : '+ Nouveau fournisseur'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, marginBottom: 20 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Ajouter un fournisseur</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Raison sociale *</label>
              <input style={inp} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label style={lbl}>Nom du contact</label>
              <input style={inp} value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Email</label>
              <input style={inp} type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Téléphone</label>
              <input style={inp} type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label style={lbl}>Pays</label>
              <select style={inp} value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}>
                <option value="">— Choisir —</option>
                {['Bénin','Togo','Nigeria','Côte d\'Ivoire','Ghana','Sénégal','Cameroun','Mali','Burkina Faso','Niger'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Adresse</label>
              <input style={inp} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
            </div>
          </div>
          {err && <p style={{ color: '#EF4444', fontSize: 12, marginBottom: 10 }}>{err}</p>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button type="button" onClick={() => setShowForm(false)}
              style={{ padding: '8px 18px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
              Annuler
            </button>
            <button type="submit" disabled={loading}
              style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: '#22C55E', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      )}

      <div style={{ background: '#fff', borderRadius: 14, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 100px', padding: '10px 20px', borderBottom: '1px solid #F1F5F9', gap: 12 }}>
          {['Fournisseur', 'Contact', 'Email / Téléphone', 'Pays', 'Depuis'].map(h => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</span>
          ))}
        </div>

        {suppliers.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>🏭</p>
            <p style={{ fontSize: 14, color: '#94A3B8' }}>Aucun fournisseur enregistré</p>
          </div>
        ) : suppliers.map((s, idx) => (
          <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '2fr 1.5fr 1.5fr 1fr 100px', padding: '12px 20px', borderBottom: idx < suppliers.length - 1 ? '1px solid #F8FAFC' : 'none', alignItems: 'center', gap: 12 }}>
            <div>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#0F172A', margin: 0 }}>{s.name}</p>
            </div>
            <span style={{ fontSize: 12, color: '#374151' }}>{s.contact_name ?? '—'}</span>
            <div>
              {s.email && <p style={{ fontSize: 12, color: '#374151', margin: 0 }}>{s.email}</p>}
              {s.phone && <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>{s.phone}</p>}
              {!s.email && !s.phone && <span style={{ color: '#CBD5E1' }}>—</span>}
            </div>
            <span style={{ fontSize: 12, color: '#64748B' }}>{s.country ?? '—'}</span>
            <span style={{ fontSize: 11, color: '#94A3B8' }}>{new Date(s.created_at).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, color: '#0F172A', outline: 'none', background: '#fff' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }
