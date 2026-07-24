'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

type Product = {
  id: string
  name: string
  emoji: string | null
  price_fcfa: number
  stock_quantity: number | null
}

type CartItem = {
  product: Product
  qty: number
}

type PaymentMethod = 'cash' | 'momo' | 'credit_client'

const PAY_LABELS: Record<PaymentMethod, string> = {
  cash:          '💵 Espèces',
  momo:          '📱 Mobile Money',
  credit_client: '📋 Crédit client',
}

function fmtFcfa(n: number) {
  return n.toLocaleString('fr-FR') + ' FCFA'
}

export default function PosClient({
  merchantId,
  businessName,
  commissionRate,
}: {
  merchantId: string
  businessName: string
  commissionRate: number
}) {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [payMethod, setPayMethod] = useState<PaymentMethod>('cash')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [lastReceipt, setLastReceipt] = useState<{ ref: string; total: number; cashback?: number } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('id, name, emoji, price_fcfa, stock_quantity')
      .eq('merchant_id', merchantId)
      .eq('is_available', true)
      .order('name')
    setProducts((data ?? []) as Product[])
    setLoading(false)
  }, [merchantId])

  useEffect(() => { load() }, [load])

  // ── Panier ───────────────────────────────────────────────
  function addToCart(product: Product) {
    if (product.stock_quantity !== null && product.stock_quantity <= 0) {
      toast.error(`${product.name} — stock épuisé`)
      return
    }
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id)
      if (existing) {
        const maxQty = product.stock_quantity ?? 999
        if (existing.qty >= maxQty) { toast.error('Stock insuffisant'); return prev }
        return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i)
      }
      return [...prev, { product, qty: 1 }]
    })
  }

  function setQty(productId: string, qty: number) {
    if (qty <= 0) { removeFromCart(productId); return }
    setCart(prev => prev.map(i => i.product.id === productId ? { ...i, qty } : i))
  }

  function removeFromCart(productId: string) {
    setCart(prev => prev.filter(i => i.product.id !== productId))
  }

  const total = cart.reduce((s, i) => s + i.product.price_fcfa * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  // ── Valider la vente ─────────────────────────────────────
  async function confirmSale() {
    if (cart.length === 0) { toast.error('Panier vide'); return }
    setSubmitting(true)

    try {
      const now = new Date().toISOString()
      const today = now.slice(0, 10)

      // 1. Mouvements de stock (type='out') pour chaque produit
      const stockMoves = cart.map(item => ({
        product_id:  item.product.id,
        merchant_id: merchantId,
        type:        'out' as const,
        quantity:    -item.qty,
        stock_after: Math.max((item.product.stock_quantity ?? 0) - item.qty, 0),
        reason:      `Vente POS — ${item.qty} × ${item.product.name}`,
        created_at:  now,
      }))

      // 2. Entrée caisse unique pour la vente totale
      const libelle = cart.length === 1
        ? `POS — ${cart[0].qty}× ${cart[0].product.name}`
        : `POS — ${cartCount} article${cartCount > 1 ? 's' : ''} (${cart.map(i => `${i.qty}×${i.product.name}`).join(', ')})`

      // 3. Si l'acheteur est membre GreenFlame → transaction avec commissions
      let cashback = 0
      let txRef = ''

      if (buyerPhone.trim().length >= 8) {
        // Rechercher le compte GreenFlame du client
        const phoneClean = buyerPhone.replace(/\s+/g, '').replace(/^00/, '+')
        const { data: buyerUser } = await supabase
          .from('users')
          .select('id')
          .eq('phone', phoneClean)
          .maybeSingle()

        if (buyerUser) {
          // Appeler l'API transaction standard (cash_confirmed = distribution immédiate)
          const idKey = `pos-${merchantId}-${Date.now()}`
          const resp = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              merchantId,
              amountFcfa:    total,
              paymentMethod: 'cash_confirmed',
              idempotencyKey: idKey,
              buyerPhone:    phoneClean,
              deliveryType:  'pickup',
            }),
          })
          const data = await resp.json()
          if (data.ok) {
            cashback = data.cashback?.amount ?? 0
            txRef = data.transactionId?.slice(0, 8).toUpperCase() ?? ''
          }
          // Si erreur API, on continue quand même avec le stock + caisse
        }
      }

      // 4. Insérer les mouvements de stock (atomique)
      const { error: stockError } = await supabase.from('stock_movements').insert(stockMoves)
      if (stockError) throw new Error('Erreur stock : ' + stockError.message)

      // Mettre à jour stock_quantity sur les produits
      await Promise.all(cart.map(item =>
        supabase.from('products').update({
          stock_quantity: Math.max((item.product.stock_quantity ?? 0) - item.qty, 0),
        }).eq('id', item.product.id)
      ))

      // 5. Entrée caisse
      const { error: caisseError } = await supabase.from('caisse_entries').insert({
        merchant_id: merchantId,
        type:        'recette',
        amount_fcfa: total,
        categorie:   'Vente directe',
        libelle,
        date_entree: today,
        created_at:  now,
      })
      if (caisseError) throw new Error('Erreur caisse : ' + caisseError.message)

      // 6. Succès
      const ref = txRef || `POS-${Date.now().toString().slice(-6)}`
      setLastReceipt({ ref, total, cashback: cashback > 0 ? cashback : undefined })
      toast.success(`Vente enregistrée ✔ — ${fmtFcfa(total)}`)

      // Réinitialiser
      setCart([])
      setBuyerPhone('')
      load() // Recharger les stocks

    } catch (err) {
      console.error(err)
      toast.error(err instanceof Error ? err.message : 'Erreur lors de la vente')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Filtrer les produits ──────────────────────────────────
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between sticky top-14 z-30">
        <div>
          <h1 className="text-lg font-bold text-gray-900">🧾 POS Rapide</h1>
          <p className="text-xs text-gray-500">{businessName}</p>
        </div>
        {cart.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="bg-brand-600 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {cartCount} art.
            </span>
            <span className="text-sm font-bold text-gray-900">{fmtFcfa(total)}</span>
          </div>
        )}
      </div>

      <div className="flex flex-col lg:flex-row gap-0 lg:gap-4 p-4 max-w-6xl mx-auto">

        {/* ── Grille produits ── */}
        <div className="flex-1">
          {/* Barre de recherche */}
          <div className="mb-3">
            <input
              type="text"
              placeholder="Rechercher un produit…"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-brand-400 bg-white"
            />
          </div>

          {loading ? (
            <div className="text-center py-12 text-gray-500">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500 bg-white rounded-xl border border-gray-200">
              {searchTerm ? 'Aucun produit trouvé.' : 'Aucun produit disponible. Ajoutez des produits d\'abord.'}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {filtered.map(product => {
                const inCart = cart.find(i => i.product.id === product.id)
                const outOfStock = product.stock_quantity !== null && product.stock_quantity <= 0
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={outOfStock}
                    className={`relative bg-white rounded-xl border-2 p-3 text-left transition-all active:scale-95 ${
                      inCart
                        ? 'border-brand-500 shadow-md shadow-brand-100'
                        : outOfStock
                          ? 'border-gray-200 opacity-50 cursor-not-allowed'
                          : 'border-gray-200 hover:border-brand-300 hover:shadow-sm'
                    }`}
                  >
                    <div className="text-3xl mb-1.5 text-center">{product.emoji ?? '📦'}</div>
                    <div className="text-xs font-semibold text-gray-800 line-clamp-2 text-center">{product.name}</div>
                    <div className="text-xs text-brand-600 font-bold mt-1 text-center">{fmtFcfa(product.price_fcfa)}</div>
                    {product.stock_quantity !== null && (
                      <div className={`text-[10px] mt-0.5 text-center ${product.stock_quantity <= 3 ? 'text-red-500' : 'text-gray-500'}`}>
                        {outOfStock ? 'Épuisé' : `Stock: ${product.stock_quantity}`}
                      </div>
                    )}
                    {inCart && (
                      <div className="absolute -top-2 -right-2 bg-brand-600 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center">
                        {inCart.qty}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Ticket + Validation ── */}
        <div className="lg:w-80 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 p-4 sticky top-32">
            <h2 className="font-bold text-gray-800 mb-3 text-sm">🛒 Ticket en cours</h2>

            {cart.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                Tapez sur un produit pour l&apos;ajouter
              </div>
            ) : (
              <>
                {/* Liste panier */}
                <div className="space-y-2 mb-4 max-h-52 overflow-y-auto">
                  {cart.map(item => (
                    <div key={item.product.id} className="flex items-center gap-2">
                      <span className="text-lg">{item.product.emoji ?? '📦'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-800 truncate">{item.product.name}</div>
                        <div className="text-xs text-gray-500">{fmtFcfa(item.product.price_fcfa)} × {item.qty}</div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setQty(item.product.id, item.qty - 1)}
                          className="w-6 h-6 rounded-lg bg-gray-100 text-gray-600 text-sm font-bold flex items-center justify-center hover:bg-gray-200"
                        >−</button>
                        <span className="w-5 text-center text-xs font-bold">{item.qty}</span>
                        <button
                          onClick={() => setQty(item.product.id, item.qty + 1)}
                          className="w-6 h-6 rounded-lg bg-gray-100 text-gray-600 text-sm font-bold flex items-center justify-center hover:bg-gray-200"
                        >+</button>
                        <button
                          onClick={() => removeFromCart(item.product.id)}
                          className="w-6 h-6 rounded-lg bg-red-50 text-red-400 text-sm flex items-center justify-center hover:bg-red-100 ml-1"
                        >✕</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Total */}
                <div className="border-t border-gray-100 pt-3 mb-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">{cartCount} article{cartCount > 1 ? 's' : ''}</span>
                    <span className="text-lg font-bold text-gray-900">{fmtFcfa(total)}</span>
                  </div>
                </div>

                {/* Méthode de paiement */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-500 mb-1.5">Mode de paiement</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(Object.keys(PAY_LABELS) as PaymentMethod[]).map(m => (
                      <button
                        key={m}
                        onClick={() => setPayMethod(m)}
                        className={`text-xs py-2 rounded-lg border font-medium transition-colors ${
                          payMethod === m
                            ? 'bg-brand-50 border-brand-400 text-brand-700'
                            : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'
                        }`}
                      >
                        {PAY_LABELS[m].split(' ')[0]}<br/>
                        <span className="text-[10px]">{PAY_LABELS[m].split(' ').slice(1).join(' ')}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Téléphone acheteur (optionnel) */}
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    Client GreenFlame (optionnel)
                  </label>
                  <input
                    type="tel"
                    placeholder="ex: +22997123456"
                    value={buyerPhone}
                    onChange={e => setBuyerPhone(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">Si membre GreenFlame → cashback activé</p>
                </div>

                {/* Bouton confirmer */}
                <button
                  onClick={confirmSale}
                  disabled={submitting}
                  className="w-full bg-brand-600 text-white py-3 rounded-xl font-bold text-sm hover:bg-brand-700 disabled:opacity-50 transition-colors active:scale-95"
                >
                  {submitting ? 'Enregistrement…' : `✓ Valider ${fmtFcfa(total)}`}
                </button>

                <button
                  onClick={() => setCart([])}
                  className="w-full mt-2 text-xs text-gray-500 py-1.5 hover:text-red-400 transition-colors"
                >
                  Vider le panier
                </button>
              </>
            )}

            {/* Reçu du dernier ticket */}
            {lastReceipt && (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3">
                <div className="text-xs font-bold text-green-700 mb-1">✅ Vente enregistrée</div>
                <div className="text-xs text-green-600">Réf : #{lastReceipt.ref}</div>
                <div className="text-xs text-green-600">Total : {fmtFcfa(lastReceipt.total)}</div>
                {lastReceipt.cashback && (
                  <div className="text-xs text-green-600">Cashback client : {fmtFcfa(lastReceipt.cashback)} 🔥</div>
                )}
                <button
                  onClick={() => setLastReceipt(null)}
                  className="text-[10px] text-green-400 mt-1 hover:text-green-600"
                >
                  Fermer
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

