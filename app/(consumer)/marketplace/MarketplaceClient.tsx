'use client'

import { useState, useMemo } from 'react'
import { ProductCard, type MarketplaceProduct } from '@/components/marketplace/ProductCard'
import type { MarketplaceCategory } from '@/components/marketplace/CategoryGrid'
import Link from 'next/link'
import { EmptyState } from '@/components/ui/EmptyState'

type Tab = 'all' | 'network' | 'vip' | 'trending' | 'recent'
type SortKey = 'score' | 'price_asc' | 'price_desc' | 'recent'

interface Props {
  allProducts: MarketplaceProduct[]
  categories: MarketplaceCategory[]
  userId?: string | null
  searchQuery?: string
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: 'all',      label: 'Tout',      icon: '🏪' },
  { key: 'network',  label: 'Mon réseau', icon: '🌱' },
  { key: 'vip',      label: 'VIP',        icon: '⭐' },
  { key: 'trending', label: 'Tendances',  icon: '🔥' },
  { key: 'recent',   label: 'Nouveaux',   icon: '✨' },
]

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'score',      label: 'Pertinence' },
  { key: 'price_asc',  label: 'Prix ↑' },
  { key: 'price_desc', label: 'Prix ↓' },
  { key: 'recent',     label: 'Récent' },
]

function isVipActive(tier: string, expiresAt: string | null): boolean {
  if (tier !== 'vip' || !expiresAt) return false
  return new Date(expiresAt) > new Date()
}

export default function MarketplaceClient({
  allProducts,
  categories,
  userId,
  searchQuery = '',
}: Props) {
  const [tab, setTab]             = useState<Tab>('all')
  const [sort, setSort]           = useState<SortKey>('score')
  const [catFilter, setCatFilter] = useState<string | null>(null)
  const [minPrice, setMinPrice]   = useState('')
  const [maxPrice, setMaxPrice]   = useState('')
  const [showFilters, setShowFilters] = useState(false)

  const filtered = useMemo(() => {
    let list = [...allProducts]

    // Tab filter
    if (tab === 'network')  list = list.filter((p) => (p.community_boost ?? 0) > 0)
    if (tab === 'vip')      list = list.filter((p) => isVipActive(p.subscription_tier, p.subscription_expires_at))
    if (tab === 'trending') list = list.sort((a, b) => b.ranking_score - a.ranking_score).slice(0, 40)
    if (tab === 'recent')   list = list.sort((a, b) =>
      new Date(b.product_created_at ?? 0).getTime() - new Date(a.product_created_at ?? 0).getTime()
    ).slice(0, 40)

    // Category filter
    if (catFilter) list = list.filter((p) => p.category_name === catFilter || p.subcategory_name === catFilter)

    // Price filter
    const min = parseFloat(minPrice)
    const max = parseFloat(maxPrice)
    if (!isNaN(min)) list = list.filter((p) => p.price_fcfa >= min)
    if (!isNaN(max)) list = list.filter((p) => p.price_fcfa <= max)

    // Sort
    if (sort === 'price_asc')  list = [...list].sort((a, b) => a.price_fcfa - b.price_fcfa)
    if (sort === 'price_desc') list = [...list].sort((a, b) => b.price_fcfa - a.price_fcfa)
    if (sort === 'recent') list = [...list].sort((a, b) =>
      new Date(b.product_created_at ?? 0).getTime() - new Date(a.product_created_at ?? 0).getTime()
    )
    if (sort === 'score') list = [...list].sort((a, b) => b.ranking_score - a.ranking_score)

    return list
  }, [allProducts, tab, sort, catFilter, minPrice, maxPrice])

  // Toutes les catégories uniques présentes dans les produits
  const categoryNames = useMemo(() => {
    const set = new Set<string>()
    for (const p of allProducts) {
      if (p.category_name) set.add(p.category_name)
    }
    return Array.from(set)
  }, [allProducts])

  const hasActiveFilters = catFilter || minPrice || maxPrice || tab !== 'all' || sort !== 'score'

  return (
    <div className="space-y-4">

      {/* ── Tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4">
        {TABS.map((t) => {
          // Masquer "Mon réseau" si pas connecté ou pas de produits réseau
          if (t.key === 'network' && (!userId || !allProducts.some((p) => (p.community_boost ?? 0) > 0))) return null
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                tab === t.key
                  ? 'bg-gray-900 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {t.icon} {t.label}
            </button>
          )
        })}
      </div>

      {/* ── Barre tri + filtres ── */}
      <div className="flex items-center gap-2">
        {/* Tri */}
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:border-brand-400"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        {/* Toggle filtres avancés */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-medium transition-colors flex-shrink-0 ${
            showFilters || catFilter || minPrice || maxPrice
              ? 'bg-brand-600 text-white border-brand-600'
              : 'bg-white text-gray-600 border-gray-200'
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 8h10M11 12h2M9 16h6" />
          </svg>
          Filtres
          {(catFilter || minPrice || maxPrice) && (
            <span className="w-4 h-4 bg-white text-brand-600 rounded-full text-xs font-bold leading-4 text-center">
              {[catFilter, minPrice, maxPrice].filter(Boolean).length}
            </span>
          )}
        </button>
      </div>

      {/* ── Filtres avancés (expandable) ── */}
      {showFilters && (
        <div className="bg-gray-50 rounded-2xl p-4 space-y-4 border border-gray-100">
          {/* Catégories */}
          {categoryNames.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Catégorie</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setCatFilter(null)}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                    !catFilter ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200'
                  }`}
                >
                  Toutes
                </button>
                {categoryNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => setCatFilter(catFilter === name ? null : name)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      catFilter === name ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-gray-600 border-gray-200'
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Fourchette de prix */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Prix (FCFA)</p>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                min="0"
              />
              <span className="text-gray-400 text-sm flex-shrink-0">—</span>
              <input
                type="number"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
                min="0"
              />
            </div>
          </div>

          {/* Reset */}
          {(catFilter || minPrice || maxPrice) && (
            <button
              onClick={() => { setCatFilter(null); setMinPrice(''); setMaxPrice('') }}
              className="text-xs text-red-500 hover:underline"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      )}

      {/* ── Résultats ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500">
            {filtered.length} produit{filtered.length !== 1 ? 's' : ''}
            {searchQuery && ` pour « ${searchQuery} »`}
            {catFilter && ` · ${catFilter}`}
          </p>
          {hasActiveFilters && (
            <button
              onClick={() => { setTab('all'); setSort('score'); setCatFilter(null); setMinPrice(''); setMaxPrice('') }}
              className="text-xs text-brand-600 hover:underline"
            >
              Tout effacer
            </button>
          )}
        </div>

        {filtered.length === 0 ? (
          <div>
            <EmptyState.Search query={searchQuery || undefined} />
            {categories.length > 0 && (
              <div className="flex gap-2 justify-center mt-1 flex-wrap pb-4">
                {categories.slice(0, 4).map((cat) => (
                  <Link
                    key={cat.slug}
                    href={`/marketplace/categorie/${cat.slug}`}
                    className="px-3 py-1.5 rounded-full text-xs font-medium bg-brand-50 text-brand-700 border border-brand-200"
                  >
                    {cat.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((product) => (
              <ProductCard key={product.id} product={product} userId={userId} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
