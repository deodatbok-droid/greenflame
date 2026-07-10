import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Logo from '@/components/Logo'
import { CategoryGrid, type MarketplaceCategory } from '@/components/marketplace/CategoryGrid'
import { type MarketplaceProduct } from '@/components/marketplace/ProductCard'
import MarketplaceSearchBar from '@/components/marketplace/MarketplaceSearchBar'
import MarketplaceClient from './MarketplaceClient'
import { buildBoostMap } from '@/lib/marketplace/community-boost'
import { getServerT } from '@/lib/i18n/server'

export const revalidate = 60 // revalider toutes les 60 secondes

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; filter?: string }>
}) {
  const { q = '' } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { t } = await getServerT()

  // ── Catégories racines ────────────────────────────────────────
  const { data: rawCategories } = await supabase
    .from('marketplace_categories')
    .select('id, slug, name, icon, color_bg, color_icon, image_url')
    .is('parent_id', null)
    .eq('is_active', true)
    .order('sort_order')

  const categories = (rawCategories ?? []) as MarketplaceCategory[]

  // ── Produits (vue scorée) ─────────────────────────────────────
  let productsQuery = supabase
    .from('v_marketplace_products')
    .select('*')
    .order('ranking_score', { ascending: false })
    .limit(80)

  if (q.trim()) {
    productsQuery = productsQuery.or(`name.ilike.%${q.trim()}%,business_name.ilike.%${q.trim()}%`)
  }

  const { data: rawProducts } = await productsQuery
  const allProducts = (rawProducts ?? []) as unknown as MarketplaceProduct[]

  // ── Marchands VIP actifs ──────────────────────────────────────
  const { data: vipMerchants } = await supabase
    .from('merchants')
    .select('id, business_name, subscription_tier, subscription_expires_at')
    .eq('is_active', true)
    .eq('subscription_tier', 'vip')
    .gt('subscription_expires_at', new Date().toISOString())
    .limit(10)

  const vipMerchantIds = new Set((vipMerchants ?? []).map((m) => m.id))

  // ── Phase 2 : boost communauté personnalisé ───────────────────
  const boostMap = user ? await buildBoostMap(supabase, user.id) : new Map<string, number>()

  // Enrichir chaque produit avec le boost communauté
  const taggedProducts = allProducts.map((p) => ({
    ...p,
    community_boost: boostMap.get(p.merchant_id) ?? 0,
    is_in_network:   boostMap.has(p.merchant_id),
  }))

  return (
    <div className="max-w-4xl mx-auto">
      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-brand-600 to-brand-800 px-5 pt-12 pb-5 md:pt-8 md:rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5">
            <Logo size={48} className="w-12 h-12" />
            <span className="text-white font-bold text-lg">GreenFlame</span>
          </div>
          {!user ? (
            <div className="flex gap-2">
              <Link href="/login" className="text-brand-100 text-sm font-medium hover:text-white">
                {t('common.signIn')}
              </Link>
              <Link
                href="/register"
                className="bg-white text-brand-700 text-sm font-bold px-3 py-1.5 rounded-xl hover:bg-brand-50"
              >
                {t('common.signUp')}
              </Link>
            </div>
          ) : (
            <Link href="/dashboard" className="text-brand-100 text-sm hover:text-white">
              {t('marketplace.myAccount')}
            </Link>
          )}
        </div>
        <h1 className="text-white text-2xl font-bold">{t('marketplace.title')}</h1>
        <p className="text-brand-100 text-sm mt-0.5">{t('marketplace.tagline')}</p>
        <MarketplaceSearchBar defaultValue={q} />
      </div>

      <div className="px-4 pb-8 space-y-6 mt-6">

        {/* ── Grille des catégories (toujours visible) ── */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">
            {t('marketplace.allCategories')}
          </h2>
          <CategoryGrid categories={categories} />
        </section>

        {/* ── Séparateur ── */}
        <div className="border-t border-gray-100" />

        {/* ── Produits — grille filtrée/triée côté client ── */}
        <MarketplaceClient
          allProducts={taggedProducts}
          categories={categories}
          userId={user?.id}
          searchQuery={q}
        />

        {/* ── CTA invité ── */}
        {!user && (
          <div className="bg-gradient-to-r from-brand-50 to-amber-50 border border-brand-200 rounded-2xl text-center py-8 px-4">
            <p className="text-3xl mb-2">🔥</p>
            <p className="font-bold text-brand-700 text-lg">{t('marketplace.joinTitle')}</p>
            <p className="text-sm text-gray-600 mt-1 mb-4">
              {t('marketplace.joinDesc')}
            </p>
            <div className="flex gap-3 justify-center">
              <Link href="/register">
                <button className="bg-brand-600 text-white font-bold px-6 py-2.5 rounded-xl hover:bg-brand-700 transition-colors">
                  {t('register.createAccount')}
                </button>
              </Link>
              <Link href="/login">
                <button className="bg-white text-brand-600 font-semibold px-6 py-2.5 rounded-xl border border-brand-200 hover:bg-brand-50 transition-colors">
                  {t('common.signIn')}
                </button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
