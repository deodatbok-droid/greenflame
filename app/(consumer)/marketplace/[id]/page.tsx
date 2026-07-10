import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatFcfa, formatCashback } from '@/lib/utils/format'
import { GOVERNANCE } from '@/lib/commission-engine/constants'

const CATEGORY_META: Record<string, { label: string; emoji: string; bg: string }> = {
  ALIMENTATION:         { label: 'Alimentation',        emoji: '🛒', bg: 'bg-amber-50'  },
  TRANSPORT_SMALL:      { label: 'Carburant & Crédit',  emoji: '⛽', bg: 'bg-blue-50'   },
  BEAUTE:               { label: 'Beauté & Mode',       emoji: '💄', bg: 'bg-pink-50'   },
  HYGIENE_BEAUTE:       { label: 'Hygiène & Beauté',    emoji: '🧴', bg: 'bg-pink-50'   },
  PHARMACIE:            { label: 'Santé',               emoji: '💊', bg: 'bg-green-50'  },
  SANTE_BIEN_ETRE:      { label: 'Santé & Bien-être',   emoji: '🌿', bg: 'bg-green-50'  },
  ELECTRONIQUE:         { label: 'Électronique',        emoji: '📱', bg: 'bg-indigo-50' },
  TELEPHONIE_ELECTRONIQUE: { label: 'Téléphonie',       emoji: '📱', bg: 'bg-indigo-50' },
  RESTAURANT:           { label: 'Restauration',        emoji: '🍽️', bg: 'bg-orange-50' },
  VETEMENTS:            { label: 'Vêtements',           emoji: '👗', bg: 'bg-purple-50' },
  MODE_VETEMENTS:       { label: 'Mode & Vêtements',    emoji: '👗', bg: 'bg-purple-50' },
  SERVICES:             { label: 'Services',            emoji: '🔧', bg: 'bg-gray-50'   },
  EAU:                  { label: 'Eau & Boissons',      emoji: '💧', bg: 'bg-cyan-50'   },
  EAU_BOISSONS:         { label: 'Eau & Boissons',      emoji: '💧', bg: 'bg-cyan-50'   },
  MAISON_MENAGE:        { label: 'Maison & Ménage',     emoji: '🏠', bg: 'bg-teal-50'   },
  AGRICULTURE_ELEVAGE:  { label: 'Agriculture',         emoji: '🌾', bg: 'bg-lime-50'   },
  BEBE_ENFANT_ECOLE:    { label: 'Bébé & École',        emoji: '🎒', bg: 'bg-yellow-50' },
  ARTISANAT_CULTURE:    { label: 'Artisanat & Culture', emoji: '🎨', bg: 'bg-rose-50'   },
  CONSTRUCTION_BRICOLAGE: { label: 'Construction',      emoji: '🏗️', bg: 'bg-stone-50'  },
  ENERGIE_SOLAIRE:      { label: 'Énergie & Solaire',   emoji: '⚡', bg: 'bg-amber-50'  },
  IMMOBILIER_LOCATION:  { label: 'Immobilier',          emoji: '🏘️', bg: 'bg-sky-50'    },
}

function getCashback(price: number, rate: number) {
  const exact = price * rate * GOVERNANCE.CASHBACK_SHARE
  return formatCashback(exact)
}

export default async function MerchantProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [merchantRes, productsRes] = await Promise.all([
    supabase
      .from('merchants')
      .select('id, business_name, business_category, commission_rate, is_verified, is_active, address_text, avg_rating, review_count, total_gmv, qr_code_url')
      .eq('id', id)
      .single(),
    supabase
      .from('products')
      .select('id, name, description, price_fcfa, emoji, image_url, category, subcategory, stock_quantity')
      .eq('merchant_id', id)
      .eq('is_available', true)
      .is('subscription_trigger', null)
      .order('sort_order'),
  ])

  if (!merchantRes.data || !merchantRes.data.is_active) notFound()

  const m        = merchantRes.data
  const products = productsRes.data ?? []
  const meta     = CATEGORY_META[m.business_category] ?? { emoji: '🏪', bg: 'bg-gray-50', label: m.business_category }

  // Group by category for display
  const byCategory = products.reduce<Record<string, typeof products>>((acc, p) => {
    const key = p.category ?? 'Autres'
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  const totalTx   = 0 // could query if needed
  const productCount = products.length

  return (
    <div className="max-w-4xl mx-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-brand-700 to-brand-900 px-5 pt-10 pb-6">
        <Link href="/marketplace" className="flex items-center gap-1 text-brand-200 text-sm hover:text-white mb-5 w-fit">
          ← Marketplace
        </Link>

        <div className="flex items-start gap-4">
          <div className={`w-16 h-16 ${meta.bg} rounded-2xl flex items-center justify-center text-3xl flex-shrink-0 shadow-sm`}>
            {meta.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-white font-bold text-xl leading-tight">{m.business_name}</h1>
              {m.is_verified && (
                <span className="text-[10px] font-bold bg-brand-500/40 text-brand-200 px-2 py-0.5 rounded-full">
                  ✓ Vérifié
                </span>
              )}
            </div>
            <p className="text-brand-200 text-sm mt-0.5">{meta.label}</p>
            {m.address_text && (
              <p className="text-brand-300 text-xs mt-1 truncate">📍 {m.address_text}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              {m.avg_rating ? (
                <span className="text-xs text-amber-300">
                  ⭐ {m.avg_rating.toFixed(1)} ({m.review_count ?? 0} avis)
                </span>
              ) : null}
              <span className="text-xs text-brand-300">{productCount} produit{productCount > 1 ? 's' : ''}</span>
              {(m.total_gmv ?? 0) > 0 && (
                <span className="text-xs text-brand-300">{formatFcfa(m.total_gmv ?? 0)} FCFA de ventes</span>
              )}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <span className="inline-block bg-flame-500/20 text-flame-300 text-xs font-bold px-2.5 py-1 rounded-lg">
              Cashback 🔥
            </span>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-5">

        {/* Quick pay CTA */}
        {user ? (
          <Link href={`/pay?merchant_id=${m.id}`}>
            <button className="w-full bg-flame-500 hover:bg-flame-600 active:scale-95 text-white font-bold py-4 rounded-2xl text-base transition-all">
              Payer chez {m.business_name} 🔥
            </button>
          </Link>
        ) : (
          <Link href="/register">
            <button className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-4 rounded-2xl text-base transition-all">
              Créer un compte pour acheter 🔥
            </button>
          </Link>
        )}

        {/* Cashback info */}
        <div className="bg-brand-50 border border-brand-100 rounded-2xl px-4 py-3 flex items-center gap-3">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg">🔥</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-brand-800">Cashback automatique sur chaque achat</p>
            <p className="text-xs text-brand-600 mt-0.5">
              Le montant exact est affiché sur chaque fiche produit.
            </p>
          </div>
        </div>

        {/* Products */}
        {productCount === 0 ? (
          <div className="card text-center py-16 text-gray-400">
            <p className="text-5xl mb-4">🛍️</p>
            <p className="font-semibold text-gray-600">Aucun produit disponible</p>
            <p className="text-sm mt-1 text-gray-400">Le catalogue sera mis à jour prochainement</p>
          </div>
        ) : (
          Object.entries(byCategory).map(([cat, items]) => {
            const catMeta = CATEGORY_META[cat] ?? { emoji: '🛒', bg: 'bg-gray-50', label: cat }
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">{catMeta.emoji}</span>
                  <h2 className="font-semibold text-gray-900">
                    {catMeta.label !== cat ? catMeta.label : cat}
                  </h2>
                  <span className="text-xs text-gray-400">({items.length})</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {items.map(p => {
                    const { label: cashbackLabel } = getCashback(p.price_fcfa, m.commission_rate)
                    const outOfStock = p.stock_quantity === 0
                    const lowStock   = p.stock_quantity !== null && p.stock_quantity > 0 && p.stock_quantity <= 5

                    return (
                      <div
                        key={p.id}
                        className={`bg-white rounded-2xl border shadow-sm overflow-hidden flex flex-col transition-all hover:shadow-md ${
                          outOfStock ? 'opacity-60 border-gray-100' : 'border-gray-100 hover:border-brand-200'
                        }`}
                      >
                        {/* Image / emoji */}
                        <div className={`h-28 ${catMeta.bg} flex items-center justify-center relative`}>
                          <span className="text-5xl">{p.emoji}</span>
                          {outOfStock && (
                            <div className="absolute inset-0 bg-gray-900/40 flex items-center justify-center">
                              <span className="text-white text-xs font-bold bg-red-500 px-2 py-1 rounded-lg">
                                Rupture
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Content */}
                        <div className="p-3 flex flex-col flex-1">
                          <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 flex-1">
                            {p.name}
                          </p>
                          {p.description && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{p.description}</p>
                          )}
                          {lowStock && (
                            <p className="text-xs text-amber-600 font-medium mt-0.5">
                              Plus que {p.stock_quantity} !
                            </p>
                          )}
                          <div className="mt-2">
                            <p className="font-bold text-gray-900">
                              {formatFcfa(p.price_fcfa)}{' '}
                              <span className="text-xs font-normal text-gray-500">FCFA</span>
                            </p>
                            {cashbackLabel && (
                              <p className="text-xs text-brand-600 font-medium">
                                {cashbackLabel} cashback 🔥
                              </p>
                            )}
                          </div>
                          <Link
                            href={
                              user
                                ? `/pay?merchant_id=${m.id}&amount=${p.price_fcfa}&product_id=${p.id}`
                                : '/register'
                            }
                            className="mt-2.5"
                          >
                            <button
                              disabled={outOfStock}
                              className="w-full bg-brand-600 hover:bg-brand-700 active:scale-95 disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-semibold py-2 rounded-xl transition-all"
                            >
                              {outOfStock ? 'Indisponible' : user ? 'Acheter 🔥' : 'Créer un compte'}
                            </button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
