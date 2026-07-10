'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type Product = {
  id: string
  name: string
  emoji: string
  stock_quantity: number | null
  stock_alert_threshold: number | null
  price_fcfa: number
}

type Movement = {
  id: string
  product_id: string
  product_name: string
  product_emoji: string
  type: 'in' | 'out' | 'adjustment' | 'loss'
  quantity: number
  stock_after: number
  reason: string | null
  created_at: string
}

const TYPE_LABELS: Record<string, { label: string; color: string; sign: string }> = {
  in:         { label: 'Approvisionnement', color: 'text-green-400',  sign: '+' },
  out:        { label: 'Vente directe',     color: 'text-blue-400',   sign: '-' },
  adjustment: { label: 'Ajustement',        color: 'text-amber-400',  sign: '±' },
  loss:       { label: 'Perte / Casse',     color: 'text-red-400',    sign: '-' },
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function StockClient({ merchantId }: { merchantId: string }) {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Formulaire mouvement
  const [selectedProduct, setSelectedProduct] = useState('')
  const [mvtType, setMvtType] = useState<'in' | 'out' | 'adjustment' | 'loss'>('in')
  const [mvtQty, setMvtQty] = useState('')
  const [mvtReason, setMvtReason] = useState('')
  const [showForm, setShowForm] = useState(false)

  // Filtre
  const [filterProduct, setFilterProduct] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [prodRes, mvtRes] = await Promise.all([
      supabase
        .from('products')
        .select('id, name, emoji, stock_quantity, stock_alert_threshold, price_fcfa')
        .eq('merchant_id', merchantId)
        .eq('is_available', true)
        .order('name'),
      supabase
        .from('stock_movements')
        .select('id, product_id, type, quantity, stock_after, reason, created_at, products(name, emoji)')
        .eq('merchant_id', merchantId)
        .order('created_at', { ascending: false })
        .limit(100),
    ])
    setProducts((prodRes.data ?? []) as Product[])
    setMovements(
      ((mvtRes.data ?? []) as any[]).map(m => ({
        id:            m.id,
        product_id:    m.product_id,
        product_name:  m.products?.name ?? '—',
        product_emoji: m.products?.emoji ?? '📦',
        type:          m.type,
        quantity:      m.quantity,
        stock_after:   m.stock_after,
        reason:        m.reason,
        created_at:    m.created_at,
      }))
    )
    setLoading(false)
  }, [merchantId])

  useEffect(() => { load() }, [load])

  async function submitMovement() {
    if (!selectedProduct || !mvtQty || parseInt(mvtQty) <= 0) {
      toast.error('Sélectionnez un produit et entrez une quantité valide.')
      return
    }
    setSaving(true)

    const product = products.find(p => p.id === selectedProduct)
    if (!product) { setSaving(false); return }

    const qty = parseInt(mvtQty)
    const currentStock = product.stock_quantity ?? 0
    const delta = mvtType === 'in' ? qty : -qty
    const stockAfter = Math.max(0, currentStock + delta)

    const { error } = await supabase.from('stock_movements').insert({
      product_id:  selectedProduct,
      merchant_id: merchantId,
      type:        mvtType,
      quantity:    delta,
      stock_after: stockAfter,
      reason:      mvtReason || null,
    })

    if (error) { toast.error('Erreur lors de l\'enregistrement.'); setSaving(false); return }

    // Mettre à jour stock_quantity sur le produit
    await supabase.from('products').update({ stock_quantity: stockAfter }).eq('id', selectedProduct)

    toast.success('Mouvement enregistré.')
    setMvtQty('')
    setMvtReason('')
    setShowForm(false)
    load()
    setSaving(false)
  }

  const filteredMovements = filterProduct
    ? movements.filter(m => m.product_id === filterProduct)
    : movements

  const lowStockProducts = products.filter(p =>
    p.stock_alert_threshold !== null &&
    (p.stock_quantity ?? 0) <= (p.stock_alert_threshold ?? 0)
  )

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Gestion de stock</h1>
          <p className="text-sm text-gray-500 mt-0.5">Suivez vos entrées et sorties de stock</p>
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="bg-brand-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 transition-colors"
        >
          {showForm ? '✕ Fermer' : '+ Nouveau mouvement'}
        </button>
      </div>

      {/* Alertes stock bas */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="font-medium text-red-700 mb-2">⚠️ Stock bas</div>
          <div className="space-y-1">
            {lowStockProducts.map(p => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-red-800">{p.emoji} {p.name}</span>
                <span className="font-bold text-red-700">{p.stock_quantity ?? 0} unités restantes</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Formulaire nouveau mouvement */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">Enregistrer un mouvement</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Produit</label>
              <select
                value={selectedProduct}
                onChange={e => setSelectedProduct(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              >
                <option value="">Sélectionner…</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.emoji} {p.name} — stock actuel : {p.stock_quantity ?? '?'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={mvtType}
                onChange={e => setMvtType(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              >
                <option value="in">Approvisionnement (entrée)</option>
                <option value="out">Vente directe (sortie)</option>
                <option value="adjustment">Ajustement d'inventaire</option>
                <option value="loss">Perte / Casse</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Quantité</label>
              <input
                type="number"
                min="1"
                value={mvtQty}
                onChange={e => setMvtQty(e.target.value)}
                placeholder="Ex: 50"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Raison (optionnel)</label>
              <input
                type="text"
                value={mvtReason}
                onChange={e => setMvtReason(e.target.value)}
                placeholder="Ex: Achat fournisseur Dantokpa"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button
              onClick={submitMovement}
              disabled={saving}
              className="bg-brand-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-500 px-4 py-2 rounded-lg text-sm hover:bg-gray-100 transition-colors"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Vue stock par produit */}
      <div>
        <h2 className="font-semibold text-gray-800 mb-3">Stock par produit</h2>
        {loading ? (
          <div className="text-center py-8 text-gray-400">Chargement…</div>
        ) : products.length === 0 ? (
          <div className="text-center py-8 text-gray-400">Aucun produit actif.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {products.map(p => {
              const stock = p.stock_quantity ?? 0
              const alert = p.stock_alert_threshold
              const isLow = alert !== null && stock <= alert
              return (
                <div
                  key={p.id}
                  className={`rounded-xl border p-4 ${isLow ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-white'}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-lg">{p.emoji}</span>
                    {isLow && <span className="text-xs text-red-600 font-medium">⚠️ Stock bas</span>}
                  </div>
                  <div className="font-medium text-gray-800 text-sm">{p.name}</div>
                  <div className="text-2xl font-bold text-gray-900 mt-1">{stock}</div>
                  <div className="text-xs text-gray-400">unités en stock</div>
                  {alert !== null && (
                    <div className="text-xs text-gray-400 mt-1">Alerte à {alert} unités</div>
                  )}
                  <button
                    onClick={() => { setSelectedProduct(p.id); setShowForm(true) }}
                    className="mt-3 text-xs text-brand-600 hover:underline"
                  >
                    + Mouvement
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Historique des mouvements */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-800">Historique des mouvements</h2>
          <select
            value={filterProduct}
            onChange={e => setFilterProduct(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-brand-500"
          >
            <option value="">Tous les produits</option>
            {products.map(p => (
              <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
            ))}
          </select>
        </div>

        {filteredMovements.length === 0 ? (
          <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-200">
            Aucun mouvement enregistré.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="min-w-full w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-xs text-gray-500 uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Produit</th>
                  <th className="text-left px-4 py-3">Type</th>
                  <th className="text-right px-4 py-3">Qté</th>
                  <th className="text-right px-4 py-3">Stock après</th>
                  <th className="text-left px-4 py-3">Raison</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredMovements.map(m => {
                  const tc = TYPE_LABELS[m.type]
                  return (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{fmtDate(m.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className="mr-1">{m.product_emoji}</span>
                        <span className="text-gray-800">{m.product_name}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${tc.color}`}>{tc.label}</span>
                      </td>
                      <td className={`px-4 py-3 text-right font-bold ${tc.color}`}>
                        {tc.sign}{Math.abs(m.quantity)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 font-medium">{m.stock_after}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{m.reason ?? '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
