'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface Product { id: string; name: string; unit_price: number | null; tax_rate: number | null }
interface LineItem { product_id: string; label: string; qty: number; unit_price: number; tax_rate: number }

export default function NouvelleFacturePage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [lines, setLines] = useState<LineItem[]>([{ product_id: '', label: '', qty: 1, unit_price: 0, tax_rate: 0 }])
  const [client, setClient] = useState({ name: '', email: '', phone: '' })
  const [notes, setNotes] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<'draft' | 'sent'>('draft')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/business/stock/products').then(r => r.json()).then(d => setProducts(d.products ?? []))
  }, [])

  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_price, 0)
  const taxTotal = lines.reduce((s, l) => s + l.qty * l.unit_price * (l.tax_rate / 100), 0)
  const total = subtotal + taxTotal

  const updateLine = (i: number, field: keyof LineItem, val: string | number) => {
    setLines(prev => {
      const next = [...prev]
      next[i] = { ...next[i], [field]: val }
      if (field === 'product_id') {
        const p = products.find(p => p.id === val)
        if (p) next[i] = { ...next[i], label: p.name, unit_price: p.unit_price ?? 0, tax_rate: p.tax_rate ?? 0 }
      }
      return next
    })
  }
  const addLine = () => setLines(prev => [...prev, { product_id: '', label: '', qty: 1, unit_price: 0, tax_rate: 0 }])
  const removeLine = (i: number) => setLines(prev => prev.filter((_, j) => j !== i))

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setErr('')
    const res = await fetch('/api/business/ventes/factures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client, lines, notes, due_date: dueDate || null, status }),
    })
    if (!res.ok) { setErr((await res.json()).error ?? 'Erreur'); setLoading(false); return }
    router.push('/business/ventes')
  }, [client, lines, notes, dueDate, status, router])

  return (
    <div style={{ padding: '28px 32px', maxWidth: 780 }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Factures</p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Nouvelle facture</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Client */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Informations client</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
            {([['name','Nom complet *'], ['email','Email'], ['phone','Téléphone']] as [string, string][]).map(([f, l]) => (
              <div key={f}>
                <label style={lbl}>{l}</label>
                <input style={inp} value={(client as Record<string, string>)[f]} onChange={e => setClient(c => ({ ...c, [f]: e.target.value }))} required={f === 'name'} />
              </div>
            ))}
          </div>
        </div>

        {/* Lignes */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Articles</h2>
          <div className="biz-table-scroll">
            <div style={{ minWidth: 560 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1fr 1.2fr 0.8fr 28px', gap: 8, marginBottom: 8 }}>
                {['Produit', 'Libellé', 'Qté', 'P.U. (FCFA)', 'TVA %', ''].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</span>
                ))}
              </div>
              {lines.map((line, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 3fr 1fr 1.2fr 0.8fr 28px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <select style={inp} value={line.product_id} onChange={e => updateLine(i, 'product_id', e.target.value)}>
                    <option value="">— Manuel —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input style={inp} value={line.label} onChange={e => updateLine(i, 'label', e.target.value)} placeholder="Description" required />
                  <input style={{ ...inp, textAlign: 'right' }} type="number" min="0.01" step="0.01" value={line.qty} onChange={e => updateLine(i, 'qty', parseFloat(e.target.value) || 0)} required />
                  <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="1" value={line.unit_price} onChange={e => updateLine(i, 'unit_price', parseFloat(e.target.value) || 0)} required />
                  <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" max="100" step="0.1" value={line.tax_rate} onChange={e => updateLine(i, 'tax_rate', parseFloat(e.target.value) || 0)} />
                  <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1} style={{ border: 'none', background: 'none', color: '#CBD5E1', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          </div>
          <button type="button" onClick={addLine} style={{ fontSize: 12, color: '#22C55E', background: 'none', border: '1px dashed #BBF7D0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', marginTop: 4 }}>
            + Ajouter une ligne
          </button>

          {/* Totaux */}
          <div style={{ marginTop: 20, borderTop: '1px solid #F1F5F9', paddingTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
            <div style={totRow}><span style={totLabel}>Sous-total</span><span style={totVal}>{fmt(subtotal)}</span></div>
            <div style={totRow}><span style={totLabel}>TVA</span><span style={totVal}>{fmt(taxTotal)}</span></div>
            <div style={{ ...totRow, borderTop: '1px solid #E2E8F0', paddingTop: 8, marginTop: 2 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: '#0F172A' }}>Total</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</span>
            </div>
          </div>
        </div>

        {/* Params */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <div>
              <label style={lbl}>Échéance</label>
              <input style={inp} type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div>
              <label style={lbl}>Statut</label>
              <select style={inp} value={status} onChange={e => setStatus(e.target.value as 'draft' | 'sent')}>
                <option value="draft">Brouillon</option>
                <option value="sent">Envoyée</option>
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>Notes internes</label>
            <textarea style={{ ...inp, resize: 'vertical', minHeight: 60 }} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Conditions, remarques…" />
          </div>
        </div>

        {err && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{err}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()} style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
            Annuler
          </button>
          <button type="submit" disabled={loading} style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#22C55E', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Enregistrement…' : 'Créer la facture'}
          </button>
        </div>
      </form>
    </div>
  )
}

const fmt = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)
const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, color: '#0F172A', outline: 'none', background: '#fff' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 4 }
const totRow: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 40, width: 280 }
const totLabel: React.CSSProperties = { fontSize: 12, color: '#64748B' }
const totVal: React.CSSProperties = { fontSize: 13, color: '#374151', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }
