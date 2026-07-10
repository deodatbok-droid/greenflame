import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ProductCard, type MarketplaceProduct } from '@/components/marketplace/ProductCard'
import { buildBoostMap, applyBoost } from '@/lib/marketplace/community-boost'
import { getServerT } from '@/lib/i18n/server'

interface Props {
  params: Promise<{ slug: string }>
}

export const revalidate = 60

export default async function CategoryPage({ params }: Props) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Catégorie parente
  const { data: category } = await supabase
    .from('marketplace_categories')
    .select('id, slug, name, icon, color_bg, color_icon, image_url, description')
    .eq('slug', slug)
    .is('parent_id', null)
    .single()

  if (!category) notFound()

  // Sous-catégories
  const { data: subcategories } = await supabase
    .from('marketplace_categories')
    .select('id, slug, name, icon, color_bg, color_icon')
    .eq('parent_id', category.id)
    .eq('is_active', true)
    .order('sort_order')

  // Produits de cette catégorie (via vue scorée)
  const { data: rawProducts } = await supabase
    .from('v_marketplace_products')
    .select('*')
    .eq('marketplace_category_id', category.id)
    .order('ranking_score', { ascending: false })
    .limit(60)

  const rawList = (rawProducts ?? []) as unknown as MarketplaceProduct[]

  // Phase 2 : boost communauté — re-trie par score personnalisé
  const boostMap = user ? await buildBoostMap(supabase, user.id) : new Map<string, number>()
  const products = [...rawList]
    .sort((a, b) =>
      applyBoost(b.ranking_score, b.merchant_id, boostMap) -
      applyBoost(a.ranking_score, a.merchant_id, boostMap)
    )
    .map((p) => ({
      ...p,
      community_boost: boostMap.get(p.merchant_id) ?? 0,
      is_in_network:   boostMap.has(p.merchant_id),
    }))

  const { t } = await getServerT()

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header catégorie */}
      <div
        className="px-5 pt-12 pb-5 md:pt-8 md:rounded-b-3xl"
        style={{ background: `linear-gradient(135deg, ${category.color_bg}, ${category.color_bg}dd)` }}
      >
        <Link href="/marketplace" className="text-sm mb-4 inline-block" style={{ color: category.color_icon }}>
          ← {t('marketplace.title')}
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${category.color_icon}20` }}
          >
            <i
              className={`ti ti-${category.icon ?? 'shopping-bag'}`}
              style={{ fontSize: 28, color: category.color_icon }}
              aria-hidden="true"
            />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: category.color_icon }}>
              {category.name}
            </h1>
            {category.description && (
              <p className="text-sm mt-0.5" style={{ color: `${category.color_icon}bb` }}>
                {category.description}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 space-y-6 mt-5">

        {/* Sous-catégories */}
        {(subcategories ?? []).length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
              {t('marketplace.subcategories')}
            </h2>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/marketplace/categorie/${slug}`}
                className="px-3 py-1.5 rounded-full text-sm font-medium bg-gray-900 text-white"
              >
                {t('common.viewAll')}
              </Link>
              {(subcategories ?? []).map((sub) => (
                <Link
                  key={sub.slug}
                  href={`/marketplace/categorie/${slug}/${sub.slug}`}
                  className="px-3 py-1.5 rounded-full text-sm font-medium border border-gray-200 text-gray-700 hover:border-brand-300 hover:text-brand-700 transition-colors"
                >
                  {sub.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Produits */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {products.length > 0
              ? products.length === 1
                ? t('marketplace.productCount').replace('{n}', String(products.length))
                : t('marketplace.productCountPlural').replace('{n}', String(products.length))
              : t('marketplace.noProducts')}
          </h2>

          {products.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-5xl mb-4">🏪</p>
              <p className="font-semibold text-gray-600">{t('marketplace.categoryComingSoon')}</p>
              <p className="text-sm mt-1">
                {t('marketplace.categoryMerchantsArriving')}
              </p>
              {!user && (
                <Link href="/register">
                  <button className="mt-4 bg-brand-600 text-white font-semibold px-5 py-2 rounded-xl text-sm hover:bg-brand-700">
                    {t('marketplace.becomeMerchant')}
                  </button>
                </Link>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} userId={user?.id} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
