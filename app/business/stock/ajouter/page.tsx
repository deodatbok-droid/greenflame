'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

const UNITS = ['pièce', 'kg', 'g', 'litre', 'ml', 'boîte', 'carton', 'sachet', 'mètre', 'lot']

export default function AjouterProduitPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  const [form, setForm] = useState({
    name: '', sku: '', barcode: '', unit: 'pièce',
    unit_price: '', buy_price: '', tax_rate: '0',
    initial_stock: '0', alert_threshold: '5',
    gf_listed: false,
  })

  function set(k: keyof typeof form, v: string | boolean) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  async function save() {
    if (!form.name.trim()) { setError('Le nom est requis'); return }
    setSaving(true)
    setError('')
    const res = await fetch('/api/business/stock/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:            form.name.trim(),
        sku:             form.sku.trim() || null,
        barcode:         form.barcode.trim() || null,
        unit:            form.unit,
        unit_price:      form.unit_price  ? parseFloat(form.unit_price)  : null,
        buy_price:       form.buy_price   ? parseFloat(form.buy_price)   : null,
        tax_rate:        parseFloat(form.tax_rate) || 0,
        initial_stock:   parseInt(form.initial_stock)   || 0,
        alert_threshold: parseInt(form.alert_threshold) || 5,
        gf_listed:       form.gf_listed,
      }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setError((j as { error?: string }).error ?? 'Erreur lors de la sauvegarde')
      setSaving(false)
      return
    }
    router.push('/business/stock')
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 680 }}>
      <div style={{ marginBottom: 24 }}>
        <a href="/business/stock" style={{ fontSize: 12, color: '#64748B', textDecoration: 'none' }}>← Stock</a>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '8px 0 0' }}>Nouveau produit</h1>
      </div>

      <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #E2E8F0', padding: '28px 28px' }}>

        <Section title="Informations générales">
          <Field label="Nom du produit *">
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Ex : Riz parfumé 5kg" style={inp} />
          </Field>
          <Row>
            <Field label="SKU / Référence">
              <input value={form.sku} onChange={e => set('sku', e.target.value)} placeholder="REF-001" style={inp} />
            </Field>
            <Field label="Code-barres">
              <input value={form.barcode} onChange={e => set('barcode', e.target.value)} placeholder="6001234567890" style={inp} />
            </Field>
          </Row>
          <Field label="Unité de vente">
            <select value={form.unit} onChange={e => set('unit', e.target.value)} style={inp}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </Field>
        </Section>

        <Divider />

        <Section title="Prix">
          <Row>
            <Field label="Prix de vente (FCFA)">
              <input type="number" min="0" value={form.unit_price} onChange={e => set('unit_price', e.target.value)} placeholder="0" style={inp} />
            </Field>
            <Field label="Prix d'achat (FCFA)">
              <input type="number" min="0" value={form.buy_price} onChange={e => set('buy_price', e.target.value)} placeholder="0" style={inp} />
            </Field>
          </Row>
          <Field label="TVA (%)">
            <select value={form.tax_rate} onChange={e => set('tax_rate', e.target.value)} style={inp}>
              <option value="0">0% — Exonéré</option>
              <option value="10">10%</option>
              <option value="18">18% — Taux standard Bénin</option>
            </select>
          </Field>
        </Section>

        <Divider />

        <Section title="Stock initial">
          <Row>
            <Field label="Quantité initiale">
              <input type="number" min="0" value={form.initial_stock} onChange={e => set('initial_stock', e.target.value)} style={inp} />
            </Field>
            <Field label="Seuil d'alerte">
              <input type="number" min="0" value={form.alert_threshold} onChange={e => set('alert_threshold', e.target.value)} style={inp} />
            </Field>
          </Row>
        </Section>

        <Divider />

        <Section title="GreenFlame">
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={form.gf_listed}
              onChange={e => set('gf_listed', e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#22C55E', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 13, color: '#374151' }}>
              <strong>Lister sur GreenFlame</strong> — ce produit sera visible et achetable par les consommateurs GreenFlame
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
            onClick={() => router.push('/business/stock')}
            style={{ flex: 1, padding: '13px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', fontSize: 14, fontWeight: 600, color: '#374151', cursor: 'pointer' }}
          >
            Annuler
          </button>
          <button
            onClick={save}
            disabled={saving || !form.name.trim()}
            style={{
              flex: 2, padding: '13px', borderRadius: 10, border: 'none',
              background: saving || !form.name.trim() ? '#94A3B8' : '#22C55E',
              color: '#fff', fontWeight: 700, fontSize: 14,
              cursor: saving || !form.name.trim() ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? 'Enregistrement…' : 'Enregistrer le produit →'}
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
