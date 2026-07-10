'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatFcfa } from '@/lib/utils/format'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface Product {
  id: string
  name: string
  price_fcfa: number
  emoji: string
  is_available: boolean
  stock_quantity: number | null
  category_name: string | null
  subcategory_name: string | null
  merchant_id: string
  business_name: string
  subscription_tier: string
  subscription_trigger: string | null
  ranking_score: number
  product_created_at: string
}

interface MktCategory {
  id: string
  slug: string
  name: string
  parent_id: string | null
}

export default function AdminMarketplacePage() {
  const supabase = createClient()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<MktCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('all')
  const [filterStatus, setFilterStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [toggling, setToggling] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterCat !== 'all') params.set('category', filterCat)
    if (filterStatus !== 'all') params.set('status', filterStatus)
    if (search) params.set('q', search)

    const res = await fetch(`/api/admin/marketplace/products?${params}`)
    const data = res.ok ? await res.json() : []
    setProducts(data as Product[])
    setLoading(false)
  }, [filterCat, filterStatus, search])

  useEffect(() => {
    supabase.from('marketplace_categories')
      .select('id, slug, name, parent_id')
      .is('parent_id', null)
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => setCategories(data ?? []))
  }, [supabase])

  useEffect(() => { load() }, [load])

  async function toggleProduct(id: string, current: boolean) {
    setToggling(id)
    const res = await fetch('/api/admin/marketplace/products', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product_id: id, is_available: !current }),
    })
    if (res.ok) {
      setProducts(prev => prev.map(p => p.id === id ? { ...p, is_available: !current } : p))
      toast.success(!current ? 'Produit réactivé' : 'Produit masqué')
    } else {
      toast.error('Erreur lors de la modération')
    }
    setToggling(null)
  }

  const tierBadge = (tier: string) => {
    if (tier === 'vip') return <span className="text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">VIP</span>
    if (tier === 'pro') return <span className="text-xs bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded font-bold">Pro</span>
    return <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Free</span>
  }

  const activeCount = products.filter(p => p.is_available).length
  const hiddenCount = products.filter(p => !p.is_available).length

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Marketplace</h1>
          <p className="text-gray-400 text-sm mt-0.5">
            {products.length} produit(s) — {activeCount} en ligne · {hiddenCount} masqués
          </p>
        </div>
        <Link
          href="/admin/marketplace/categories"
          className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          Gérer les catégories →
        </Link>
      </div>

      {/* Filtres */}
      <div className="bg-gray-800 rounded-2xl p-4 flex flex-wrap gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher produit ou marchand…"
          className="flex-1 min-w-48 bg-gray-700 text-white text-sm rounded-xl px-3 py-2 border border-gray-600 focus:outline-none focus:border-brand-400 placeholder-gray-400"
        />
        <select
          value={filterCat}
          onChange={e => setFilterCat(e.target.value)}
          className="bg-gray-700 text-white text-sm rounded-xl px-3 py-2 border border-gray-600 focus:outline-none"
        >
          <option value="all">Toutes catégories</option>
          {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="bg-gray-700 text-white text-sm rounded-xl px-3 py-2 border border-gray-600 focus:outline-none"
        >
          <option value="all">Tous statuts</option>
          <option value="active">En ligne</option>
          <option value="hidden">Masqués</option>
        </select>
      </div>

      {/* Tableau */}
      {loading ? (
        <div className="text-center py-16 text-gray-400">Chargement…</div>
      ) : products.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">🛍️</p>
          <p className="font-medium text-gray-300">Aucun produit correspondant</p>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-2xl overflow-x-auto">
          <table className="min-w-full w-full text-sm">
            <thead>
              <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase tracking-wide">
                <th className="text-left px-4 py-3">Produit</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Catégorie</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Marchand</th>
                <th className="text-right px-4 py-3">Prix</th>
                <th className="text-center px-4 py-3">Statut</th>
                <th className="text-center px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {products.map(p => (
                <tr key={p.id} className={`hover:bg-gray-900 transition-colors ${!p.is_available ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl flex-shrink-0">{p.emoji}</span>
                      <div>
                        <Link href={`/marketplace/produit/${p.id}`} target="_blank"
                          className="text-white font-medium leading-tight line-clamp-1 hover:text-brand-400 hover:underline transition-colors">
                          {p.name}
                        </Link>
                        {p.subscription_trigger && (
                          <span className="inline-block text-[10px] font-bold bg-purple-800 text-purple-200 px-1.5 py-0.5 rounded mt-0.5">
                            {p.subscription_trigger.toUpperCase()}
                          </span>
                        )}
                        {p.stock_quantity !== null && (
                          <p className={`text-xs ${p.stock_quantity === 0 ? 'text-red-400' : 'text-gray-400'}`}>
                            Stock: {p.stock_quantity}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-gray-300 text-xs">{p.category_name ?? '—'}</p>
                    {p.subcategory_name && <p className="text-gray-500 text-xs">{p.subcategory_name}</p>}
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <p className="text-gray-300 text-xs">{p.business_name}</p>
                    <div className="mt-0.5">{tierBadge(p.subscription_tier)}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="text-white font-semibold">{formatFcfa(p.price_fcfa)}</p>
                    <p className="text-gray-500 text-xs">FCFA</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.is_available ? 'bg-green-900 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                      {p.is_available ? 'En ligne' : 'Masqué'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Link href={`/marketplace/produit/${p.id}`} target="_blank"
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors">
                        Fiche ↗
                      </Link>
                      <button
                        onClick={() => toggleProduct(p.id, p.is_available)}
                        disabled={toggling === p.id}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 ${
                          p.is_available
                            ? 'bg-red-900 text-red-300 hover:bg-red-800'
                            : 'bg-green-900 text-green-300 hover:bg-green-800'
                        }`}
                      >
                        {toggling === p.id ? '…' : p.is_available ? 'Masquer' : 'Activer'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
