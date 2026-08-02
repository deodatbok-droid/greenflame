'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Product { id: string; name: string; sku: string | null }

export default function MouvementStockPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [lines, setLines] = useState([{ product_id: '', qty: 1, unit_cost: 0, note: '' }])
  const [moveType, setMoveType] = useState<'in' | 'adjustment'>('in')
  const [ref, setRef] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/business/stock/products').then(r => r.json()).then(d => setProducts(d.products ?? []))
  }, [])

  const addLine = () => setLines(prev => [...prev, { product_id: '', qty: 1, unit_cost: 0, note: '' }])
  const removeLine = (i: number) => setLines(prev => prev.filter((_, j) => j !== i))
  const updateLine = <K extends keyof (typeof lines)[0]>(i: number, field: K, val: (typeof lines)[0][K]) => {
    setLines(prev => { const n = [...prev]; n[i] = { ...n[i], [field]: val }; return n })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lines.some(l => !l.product_id)) { setErr('Sélectionnez un produit pour chaque ligne'); return }
    setLoading(true); setErr('')
    const res = await fetch('/api/business/stock/mouvements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ move_type: moveType, reference: ref || null, lines }),
    })
    if (!res.ok) { setErr((await res.json()).error ?? 'Erreur'); setLoading(false); return }
    router.push('/business/stock')
  }

  return (
    <div style={{ padding: '28px 32px', maxWidth: 720 }}>
      <div style={{ marginBottom: 24 }}>
        <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>
          <Link href="/business/stock" style={{ color: '#94A3B8', textDecoration: 'none' }}>Inventaire</Link>
          {' / Mouvement'}
        </p>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0 }}>Enregistrer un mouvement</h1>
      </div>

      <form onSubmit={handleSubmit}>
        {/* Type + Ref */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div>
              <label style={lbl}>Type de mouvement</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {([['in', 'Entrée', '#22C55E'], ['adjustment', 'Ajustement', '#F59E0B']] as [string, string, string][]).map(([v, l, c]) => (
                  <button key={v} type="button" onClick={() => setMoveType(v as 'in' | 'adjustment')}
                    style={{ flex: 1, padding: '9px', borderRadius: 8, border: `2px solid ${moveType === v ? c : '#E2E8F0'}`, background: moveType === v ? c + '18' : '#fff', fontSize: 13, fontWeight: 700, color: moveType === v ? c : '#94A3B8', cursor: 'pointer' }}>
                    {v === 'in' ? '↑ ' : '⇄ '}{l}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={lbl}>Référence / Bon de livraison</label>
              <input style={inp} value={ref} onChange={e => setRef(e.target.value)} placeholder="BL-2026-001" />
            </div>
          </div>
        </div>

        {/* Lignes produits */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: 20, marginBottom: 16 }}>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 14 }}>Produits</h2>
          <div className="biz-table-scroll">
            <div style={{ minWidth: 520 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.2fr 2fr 28px', gap: 8, marginBottom: 8 }}>
                {['Produit *', 'Quantité', 'Coût unit.', 'Note', ''].map(h => (
                  <span key={h} style={{ fontSize: 10, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '.06em' }}>{h}</span>
                ))}
              </div>
              {lines.map((line, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '2.5fr 1fr 1.2fr 2fr 28px', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <select style={inp} value={line.product_id} onChange={e => updateLine(i, 'product_id', e.target.value)} required>
                    <option value="">— Choisir —</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.name}{p.sku ? ` (${p.sku})` : ''}</option>)}
                  </select>
                  <input style={{ ...inp, textAlign: 'right' }} type="number" min="0.001" step="0.001" value={line.qty}
                    onChange={e => updateLine(i, 'qty', parseFloat(e.target.value) || 0)} required />
                  <input style={{ ...inp, textAlign: 'right' }} type="number" min="0" step="1" value={line.unit_cost}
                    onChange={e => updateLine(i, 'unit_cost', parseFloat(e.target.value) || 0)} placeholder="0" />
                  <input style={inp} value={line.note} onChange={e => updateLine(i, 'note', e.target.value)} placeholder="Optionnel" />
                  <button type="button" onClick={() => removeLine(i)} disabled={lines.length === 1}
                    style={{ border: 'none', background: 'none', color: '#CBD5E1', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
              ))}
            </div>
          </div>
          <button type="button" onClick={addLine}
            style={{ fontSize: 12, color: '#22C55E', background: 'none', border: '1px dashed #BBF7D0', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', marginTop: 4 }}>
            + Ajouter un produit
          </button>
        </div>

        {err && <p style={{ color: '#EF4444', fontSize: 13, marginBottom: 12 }}>{err}</p>}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => router.back()}
            style={{ padding: '10px 20px', borderRadius: 8, border: '1px solid #E2E8F0', background: '#fff', fontSize: 13, cursor: 'pointer', color: '#374151' }}>
            Annuler
          </button>
          <button type="submit" disabled={loading}
            style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: '#22C55E', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Enregistrement…' : 'Valider le mouvement'}
          </button>
        </div>
      </form>
    </div>
  )
}

const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '7px 10px', borderRadius: 8, border: '1px solid #E2E8F0', fontSize: 13, color: '#0F172A', outline: 'none', background: '#fff' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 11, fontWeight: 600, color: '#64748B', marginBottom: 6 }
