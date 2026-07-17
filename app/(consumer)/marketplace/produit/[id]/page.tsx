import { createClient } from '@/lib/supabase/server'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatFcfa, formatCashback, cashbackRate } from '@/lib/utils/format'
import { GOVERNANCE } from '@/lib/commission-engine/constants'
import { getServerT } from '@/lib/i18n/server'
import AddToCartButton from '@/components/consumer/AddToCartButton'

interface Props {
  params: Promise<{ id: string }>
}

export const revalidate = 60

export default async function ProductPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Requête directe sur products (inclut les produits à subscription_trigger)
  const { data: raw } = await supabase
    .from('products')
    .select(`
      id, name, description, price_fcfa, emoji, image_url,
      category, stock_quantity, is_available, subscription_trigger,
      marketplace_category_id, marketplace_subcategory_id,
      merchants!inner (
        id, business_name, subscription_tier, subscription_expires_at,
        commission_rate, is_active, public_slug
      ),
      mkt_cat:marketplace_categories!marketplace_category_id (
        id, name, slug, color_bg, color_icon
      ),
      mkt_sub:marketplace_categories!marketplace_subcategory_id (name)
    `)
    .eq('id', id)
    .eq('is_available', true)
    .single()

  if (!raw || !(raw.merchants as any)?.is_active) notFound()

  const { t } = await getServerT()

  const SUBSCRIPTION_LABELS: Record<string, { badge: string; cta: string; color: string }> = {
    pro:         { badge: '🚀 Pro',          cta: t('marketplace.ctaPro'),        color: 'bg-brand-600' },
    vip:         { badge: '👑 VIP',          cta: t('marketplace.ctaVip'),        color: 'bg-purple-600' },
    vip_upgrade: { badge: '⬆️ Upgrade',      cta: t('marketplace.ctaVipUpgrade'), color: 'bg-purple-500' },
    agent:       { badge: '🏦 Agent',        cta: t('marketplace.ctaAgent'),      color: 'bg-amber-600' },
  }

  const p = raw as any
  const merchant = p.merchants
  const cat      = p.mkt_cat
  const subcat   = p.mkt_sub

  const isSubscription = !!p.subscription_trigger
  const subInfo = isSubscription ? SUBSCRIPTION_LABELS[p.subscription_trigger] : null

  const commission = merchant.commission_rate ?? GOVERNANCE.DEFAULT_COMMISSION_RATE
  const { label: cashbackLabel } = formatCashback(p.price_fcfa * commission * GOVERNANCE.CASHBACK_SHARE)
  const pctLabel = cashbackRate(commission, GOVERNANCE.CASHBACK_SHARE)

  const outOfStock = p.stock_quantity === 0
  const bg = cat?.color_bg ?? '#F1EFE8'

  const payHref = isSubscription
    ? '/merchant/upgrade'
    : user
    ? `/pay?merchant_id=${merchant.id}&amount=${p.price_fcfa}&product_id=${p.id}`
    : `/register?next=/marketplace/produit/${id}`

  return (
    <div className="max-w-2xl mx-auto pb-32">

      {/* Header fil d'Ariane */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b border-gray-100 px-4 h-12 flex items-center gap-3">
        <Link href="/marketplace" className="text-gray-500 hover:text-gray-800 transition-colors text-sm">
          ← {t('marketplace.title')}
        </Link>
        {cat && (
          <>
            <span className="text-gray-300">/</span>
            <Link
              href={`/marketplace/categorie/${cat.slug}`}
              className="text-gray-500 hover:text-gray-800 transition-colors text-sm truncate"
            >
              {cat.name}
            </Link>
          </>
        )}
      </div>

      {/* Visuel */}
      <div
        className="relative w-full h-64 flex items-center justify-center"
        style={{ background: bg }}
      >
        {p.image_url ? (
          <Image
            src={p.image_url}
            alt={p.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 672px"
            priority
            unoptimized={p.image_url.startsWith('http')}
          />
        ) : (
          <span className="text-8xl">{p.emoji}</span>
        )}

        {/* Badge abonnement */}
        {subInfo && (
          <div className="absolute top-3 left-3">
            <span className={`${subInfo.color} text-white text-sm font-bold px-3 py-1 rounded-xl shadow`}>
              {subInfo.badge}
            </span>
          </div>
        )}

        {outOfStock && (
          <div className="absolute inset-0 bg-gray-900/50 flex items-center justify-center">
            <span className="text-white font-bold text-lg bg-red-600 px-4 py-2 rounded-xl">
              {t('marketplace.unavailable')}
            </span>
          </div>
        )}
      </div>

      {/* Contenu */}
      <div className="px-4 pt-5 space-y-5">

        {/* Nom + marchand */}
        <div>
          <h1 className="text-xl font-bold text-gray-900 leading-tight">{p.name}</h1>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Link
              href={merchant.public_slug ? `/boutique/${merchant.public_slug}` : `/marketplace/${merchant.id}`}
              className="text-sm text-brand-600 hover:underline font-medium"
            >
              {merchant.business_name}
            </Link>
            {subcat && (
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {subcat.name}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {p.description && (
          <div className="bg-gray-50 rounded-2xl px-4 py-3">
            <p className="text-sm text-gray-700 leading-relaxed">{p.description}</p>
          </div>
        )}

        {/* Stock (uniquement pour les produits physiques) */}
        {!isSubscription && p.stock_quantity !== null && (
          <div className={`flex items-center gap-2 text-sm font-medium ${
            outOfStock ? 'text-red-600' : p.stock_quantity <= 5 ? 'text-amber-600' : 'text-green-600'
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              outOfStock ? 'bg-red-500' : p.stock_quantity <= 5 ? 'bg-amber-500' : 'bg-green-500'
            }`} />
            {outOfStock
              ? t('marketplace.outOfStock')
              : p.stock_quantity <= 5
              ? t('marketplace.stockLow').replace('{n}', String(p.stock_quantity))
              : t('marketplace.inStock').replace('{n}', String(p.stock_quantity))}
          </div>
        )}

        {/* Prix + cashback */}
        <div className="bg-white border border-gray-100 rounded-2xl px-4 py-4 flex items-center justify-between shadow-sm">
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {formatFcfa(p.price_fcfa)}{' '}
              <span className="text-base font-normal text-gray-500">FCFA</span>
              {isSubscription && p.subscription_trigger !== 'agent' && (
                <span className="text-sm font-normal text-gray-400 ml-1">{t('marketplace.perMonth')}</span>
              )}
            </p>
            {!isSubscription && cashbackLabel && (
              <p className="text-sm text-brand-600 font-semibold mt-0.5">
                {cashbackLabel} cashback 🔥
              </p>
            )}
            {isSubscription && (
              <p className="text-xs text-gray-500 mt-0.5">
                {p.subscription_trigger === 'agent'
                  ? t('marketplace.oneTimeActivation')
                  : t('marketplace.noCommitment')}
              </p>
            )}
          </div>
          {!isSubscription && cashbackLabel && (
            <div className="w-14 h-14 bg-brand-600 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white font-bold text-xs text-center leading-tight">
                {pctLabel}<br/>back
              </span>
            </div>
          )}
          {isSubscription && subInfo && (
            <div className={`w-14 h-14 ${subInfo.color} rounded-xl flex items-center justify-center flex-shrink-0`}>
              <span className="text-2xl">{p.emoji}</span>
            </div>
          )}
        </div>

      </div>

      {/* CTA fixe en bas — z-50 pour passer au-dessus de la BottomNav (z-40) */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-4 py-3 safe-bottom z-50">
        <div className="max-w-2xl mx-auto space-y-2">
          {outOfStock ? (
            <button disabled className="w-full bg-gray-300 text-gray-500 font-bold py-4 rounded-2xl text-base cursor-not-allowed">
              {t('marketplace.unavailable')}
            </button>
          ) : (
            <>
              <Link href={payHref}>
                <button className={`w-full text-white font-bold py-3.5 rounded-2xl text-base transition-all active:scale-95 ${
                  isSubscription
                    ? (subInfo?.color ?? 'bg-brand-600') + ' hover:opacity-90'
                    : 'bg-brand-600 hover:bg-brand-700'
                }`}>
                  {isSubscription
                    ? subInfo?.cta ?? t('marketplace.ctaAgent')
                    : user
                    ? t('marketplace.buyNowWithPrice').replace('{price}', formatFcfa(p.price_fcfa))
                    : t('marketplace.createAccountToBuy')}
                </button>
              </Link>
              {!isSubscription && !outOfStock && (
                <AddToCartButton
                  productId={p.id}
                  merchantId={merchant.id}
                  merchantName={merchant.business_name}
                  name={p.name}
                  price_fcfa={p.price_fcfa}
                  emoji={p.emoji}
                />
              )}
              {user && !isSubscription && !outOfStock && (
                <Link
                  href={`/tontine?product_id=${p.id}&merchant_id=${merchant.id}&price=${p.price_fcfa}&product_name=${encodeURIComponent(p.name)}`}
                  className="block w-full"
                >
                  <button className="w-full bg-white border border-gray-200 text-gray-700 font-semibold py-3 rounded-2xl text-sm hover:border-brand-300 hover:text-brand-700 transition-colors flex items-center justify-center gap-2">
                    {t('tontine.organizeTontine')}
                  </button>
                </Link>
              )}
            </>
          )}
          {!user && !isSubscription && (
            <p className="text-center text-xs text-gray-400 mt-2">
              {t('marketplace.alreadyMember')}{' '}
              <Link href={`/login?next=/marketplace/produit/${id}`} className="text-brand-600 font-medium hover:underline">
                {t('common.signIn')}
              </Link>

            </p>
          )}
        </div>
      </div>
    </div>
  )
}
