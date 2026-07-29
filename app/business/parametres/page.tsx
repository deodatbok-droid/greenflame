'use client'

import { useState, useEffect } from 'react'

interface BizAccountSettings {
  id: string
  name: string
  slug: string | null
  country: string
  currency: string
  plan: string
  status: string
  address: string | null
  tax_id: string | null
  default_tax_rate: number | null
  invoice_prefix: string | null
  invoice_notes: string | null
}

const CURRENCIES = ['XOF','XAF','NGN','GHS','KES','MAD','TZS','UGX','ZMW']
const COUNTRIES   = ['Bénin','Togo','Nigeria','Côte d\'Ivoire','Ghana','Sénégal','Cameroun','Mali','Burkina Faso','Niger']

export default function ParametresPage() {
  const [settings, setSettings] = useState<BizAccountSettings | null>(null)
  const [form, setForm]         = useState<Partial<BizAccountSettings>>({})
  const [saving, setSaving]     = useState(false)
  const [saved, setSaved]       = useState(false)
  const [err, setErr]           = useState('')

  useEffect(() => {
    fetch('/api/business/parametres').then(r => r.json()).then(d => {
      setSettings(d.account)
      setForm(d.account ?? {})
    })
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setErr(''); setSaved(false)
    const res = await fetch('/api/business/parametres', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (!res.ok) { setErr((await res.json()).error ?? 'Erreur'); setSaving(false); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setSaving(false)
  }

  if (!settings) return (
    <div style={{ padding: 32 }}>
      <div style={{ height: 24, width: 200, background: '#F1F5F9', borderRadius: 6, marginBottom: 16 }} />
      <div style={{ height: 300, background: '#F8FAFC', borderRadius: 12 }} />
    </div>
  )

  const PLAN_LABEL: Record<string, string> = { trial: 'Essai gratuit (30j)', starter: 'Starter', business: 'Business', pro: 'Pro' }
  const STATUS_COLOR: Record<string, string> = { active: '#22C55E', trial: '#F59E0B', suspended: '#EF4444' }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Gestion</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Paramètres</h1>
      </div>

      {/* Plan info */}
      <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 4 }}>Plan actuel</p>
          <p style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0 }}>{PLAN_LABEL[settings.plan] ?? settings.plan}</p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: (STATUS_COLOR[settings.status] ?? '#94A3B8') + '20', color: STATUS_COLOR[settings.status] ?? '#94A3B8' }}>
            {settings.status === 'active' ? 'Actif' : settings.status === 'trial' ? 'Essai' : 'Suspendu'}
          </span>
        </div>
      </div>

      {saved && (
        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#166534' }}>
          Paramètres enregistrés avec succès
        </div>
      )}

      <form onSubmit={handleSave}>
        {/* Infos générales */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Informations générales</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Nom de l&apos;entreprise *</label>
              <input style={inp} value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
            </div>
            <div>
              <label style={lbl}>Identifiant unique (slug)</label>
              <input style={{ ...inp, color: '#94A3B8' }} value={form.slug ?? ''} disabled />
              <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>Généré automatiquement</p>
            </div>
            <div>
              <label style={lbl}>Pays</label>
              <select style={inp} value={form.country ?? ''} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}>
                {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Devise</label>
              <select style={inp} value={form.currency ?? 'XOF'} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Adresse</label>
              <input style={inp} value={form.address ?? ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Cotonou, Bénin" />
            </div>
          </div>
        </div>

        {/* Facturation */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 16 }}>Facturation</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>N° fiscal (NIF / IFU)</label>
              <input style={inp} value={form.tax_id ?? ''} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} placeholder="BE12345678" />
            </div>
            <div>
              <label style={lbl}>TVA par défaut (%)</label>
              <input style={inp} type="number" min="0" max="100" step="0.1" value={form.default_tax_rate ?? ''} onChange={e => setForm(f => ({ ...f, default_tax_rate: parseFloat(e.target.value) || null }))} placeholder="18" />
            </div>
            <div>
              <label style={lbl}>Préfixe factures</label>
              <input style={inp} value={form.invoice_prefix ?? ''} onChange={e => setForm(f => ({ ...f, invoice_prefix: e.target.value }))} placeholder="FACT-" />
            </div>
            <div />
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={lbl}>Mention légale sur les factures</label>
              <textarea style={{ ...inp, resize: 'vertical', minHeight: 60 }} value={form.invoice_notes ?? ''} onChange={e => setForm(f => ({ ...f, invoice_notes: e.target.value }))} placeholder="Paiement à 30 jours — TVA acquittée sur encaissements…" />
            </div>
          </div>
        </div>

        {err && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{err}</p>}

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button type="submit" disabled={saving}
            style={{ padding: '10px 28px', borderRadius: 8, border: 'none', background: '#22C55E', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Enregistrement…' : 'Enregistrer les modifications'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, color: '#0F172A', outline: 'none', background: '#fff' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }
