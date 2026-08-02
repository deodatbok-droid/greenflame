'use client'

import { useState, useEffect, useCallback } from 'react'

interface Product {
  id: string
  name: string
  sku?: string
  unit_price: number
  unit: string
  quantity: number
}

interface CartItem extends Product {
  qty: number
}

export default function CaissePage() {
  const [products, setProducts]   = useState<Product[]>([])
  const [search, setSearch]       = useState('')
  const [cart, setCart]           = useState<CartItem[]>([])
  const [payMode, setPayMode]     = useState<'cash' | 'momo' | 'card'>('cash')
  const [processing, setProc]     = useState(false)
  const [receipt, setReceipt]     = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    const res = await fetch('/api/business/stock/products')
    if (res.ok) setProducts(await res.json() as Product[])
  }, [])

  useEffect(() => { void loadProducts() }, [loadProducts])

  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku?.toLowerCase().includes(search.toLowerCase())
  )

  function addToCart(p: Product) {
    setCart(prev => {
      const ex = prev.find(i => i.id === p.id)
      if (ex) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i)
      return [...prev, { ...p, qty: 1 }]
    })
  }

  function updateQty(id: string, delta: number) {
    setCart(prev => {
      const next = prev.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)
      return next.filter(i => i.qty > 0)
    })
  }

  const total = cart.reduce((s, i) => s + i.unit_price * i.qty, 0)
  const fmt   = (n: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'XOF', maximumFractionDigits: 0 }).format(n)

  async function checkout() {
    if (cart.length === 0) return
    setProc(true)
    const res = await fetch('/api/business/caisse/vente', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        items: cart.map(i => ({ product_id: i.id, qty: i.qty, unit_price: i.unit_price })),
        total,
        payment_method: payMode,
      }),
    })
    if (res.ok) {
      const j = await res.json() as { transaction_id: string }
      setReceipt(j.transaction_id)
      setCart([])
    }
    setProc(false)
  }

  if (receipt) {
    return (
      <div style={{ padding: '28px 32px', maxWidth: 500, textAlign: 'center' }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>Vente enregistrée</h2>
        <p style={{ fontSize: 13, color: '#64748B', marginBottom: 28 }}>Transaction #{receipt.slice(0, 12).toUpperCase()}</p>
        <button
          onClick={() => setReceipt(null)}
          style={{ padding: '13px 32px', borderRadius: 10, background: '#22C55E', color: '#fff', fontWeight: 700, fontSize: 14, border: 'none', cursor: 'pointer' }}
        >
          Nouvelle vente →
        </button>
      </div>
    )
  }

  return (
    <div className="biz-caisse-layout" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Product grid */}
      <div className="biz-caisse-products" style={{ flex: 1, overflow: 'auto', padding: '24px 20px 24px 32px' }}>
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 12, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 4 }}>Caisse</p>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0 }}>Point de vente</h1>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher un produit ou SKU…"
          style={{
            width: '100%', padding: '11px 14px', borderRadius: 10,
            border: '1px solid #CBD5E1', fontSize: 13, color: '#0F172A',
            outline: 'none', boxSizing: 'border-box', marginBottom: 16,
          }}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10 }}>
          {filtered.map(p => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              disabled={p.quantity <= 0}
              style={{
                background: p.quantity <= 0 ? '#F8FAFC' : '#fff',
                border: '1px solid #E2E8F0', borderRadius: 12,
                padding: '14px 12px', textAlign: 'left', cursor: p.quantity <= 0 ? 'not-allowed' : 'pointer',
                opacity: p.quantity <= 0 ? .5 : 1,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: '#22C55E', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmt(p.unit_price)}</div>
              <div style={{ fontSize: 10, color: '#94A3B8', marginTop: 4 }}>Stock: {p.quantity} {p.unit}</div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p style={{ gridColumn: '1/-1', color: '#94A3B8', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>
              {products.length === 0 ? 'Aucun produit en stock. Ajoutez des produits d\'abord.' : 'Aucun résultat'}
            </p>
          )}
        </div>
      </div>

      {/* Cart */}
      <div className="biz-caisse-cart" style={{
        width: 320, flexShrink: 0, borderLeft: '1px solid #E2E8F0',
        background: '#fff', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{ padding: '20px 20px 0', borderBottom: '1px solid #F1F5F9', paddingBottom: 14 }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.06em' }}>
            Panier · {cart.reduce((s, i) => s + i.qty, 0)} article{cart.reduce((s, i) => s + i.qty, 0) !== 1 ? 's' : ''}
          </p>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '8px 0' }}>
          {cart.length === 0 ? (
            <p style={{ color: '#CBD5E1', fontSize: 13, textAlign: 'center', padding: '40px 20px' }}>Sélectionnez un produit</p>
          ) : cart.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', gap: 12, borderBottom: '1px solid #F8FAFC' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#0F172A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.name}</div>
                <div style={{ fontSize: 11, color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>{fmt(item.unit_price)} × {item.qty}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button onClick={() => updateQty(item.id, -1)} style={qtyBtn}>−</button>
                <span style={{ width: 24, textAlign: 'center', fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{item.qty}</span>
                <button onClick={() => updateQty(item.id, +1)} style={qtyBtn}>+</button>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums', minWidth: 64, textAlign: 'right' }}>
                {fmt(item.unit_price * item.qty)}
              </div>
            </div>
          ))}
        </div>

        {/* Totals & payment */}
        <div style={{ padding: 16, borderTop: '1px solid #E2E8F0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 16 }}>
            <span>Total</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(total)}</span>
          </div>

          {/* Payment mode */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
            {(['cash', 'momo', 'card'] as const).map(m => (
              <button key={m} onClick={() => setPayMode(m)} style={{
                flex: 1, padding: '8px 0', borderRadius: 8, fontSize: 11, fontWeight: 700,
                border: `1.5px solid ${payMode === m ? '#22C55E' : '#E2E8F0'}`,
                background: payMode === m ? '#F0FDF4' : '#fff',
                color: payMode === m ? '#16A34A' : '#64748B', cursor: 'pointer',
                textTransform: 'uppercase', letterSpacing: '.04em',
              }}>
                {m === 'cash' ? 'Espèces' : m === 'momo' ? 'MoMo' : 'Carte'}
              </button>
            ))}
          </div>

          <button
            onClick={checkout}
            disabled={cart.length === 0 || processing}
            style={{
              width: '100%', padding: '14px', borderRadius: 10, border: 'none',
              background: cart.length === 0 || processing ? '#94A3B8' : '#22C55E',
              color: '#fff', fontWeight: 800, fontSize: 15,
              cursor: cart.length === 0 || processing ? 'not-allowed' : 'pointer',
            }}
          >
            {processing ? 'Enregistrement…' : `Encaisser ${total > 0 ? fmt(total) : ''}`}
          </button>

          {cart.length > 0 && (
            <button
              onClick={() => setCart([])}
              style={{ width: '100%', marginTop: 8, padding: '9px', borderRadius: 10, border: '1px solid #FECACA', background: 'transparent', color: '#EF4444', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
            >
              Vider le panier
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

const qtyBtn: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, border: '1px solid #E2E8F0',
  background: '#F8FAFC', fontSize: 14, fontWeight: 700, color: '#374151',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}
