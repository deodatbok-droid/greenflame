'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { formatFcfa, formatCashback } from '@/lib/utils/format'
import { GOVERNANCE } from '@/lib/commission-engine/constants'

export interface MarketplaceProduct {
  id: string
  name: string
  description: string | null
  price_fcfa: number
  emoji: string
  image_url: string | null
  category_color_bg: string | null
  merchant_id: string
  business_name: string
  subscription_tier: string
  subscription_expires_at: string | null
  ranking_score: number
  product_created_at?: string | null
  stock_quantity: number | null
  category_name: string | null
  subcategory_name: string | null
  is_in_network?: boolean
  community_boost?: number
  distance_km?: number | null
  buyer_count?: number
}

function isVipActive(tier: string, expiresAt: string | null): boolean {
  if (tier !== 'vip' || !expiresAt) return false
  return new Date(expiresAt) > new Date()
}

export function ProductCard({
  product,
  userId,
}: {
  product: MarketplaceProduct
  userId?: string | null
}) {
  const router = useRouter()
  const commission = GOVERNANCE.DEFAULT_COMMISSION_RATE
  const { label: cashbackLabel } = formatCashback(product.price_fcfa * commission * GOVERNANCE.CASHBACK_SHARE)
  const vip = isVipActive(product.subscription_tier, product.subscription_expires_at)
  const pro = product.subscription_tier === 'pro' || vip
  const bg = product.category_color_bg ?? '#F1EFE8'
  const outOfStock = product.stock_quantity === 0

  const payHref = outOfStock
    ? '#'
    : userId
    ? `/pay?merchant_id=${product.merchant_id}&amount=${product.price_fcfa}&product_id=${product.id}`
    : '/register'

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200 transition-all overflow-hidden flex flex-col cursor-pointer h-full"
      onClick={() => router.push(`/marketplace/produit/${product.id}`)}
    >
      {/* Image */}
      <div
        className="relative h-32 flex items-center justify-center overflow-hidden"
        style={{ background: bg }}
      >
        {product.image_url ? (
          <Image
            src={product.image_url}
            alt={product.name}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <span className="text-5xl">{product.emoji}</span>
        )}
        {/* Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-10">
          {vip && (
            <span className="bg-amber-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-lg">
              VIP
            </span>
          )}
          {(product.community_boost ?? 0) >= 35 && (
            <span className="bg-brand-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-lg">
              🌱 Proche
            </span>
          )}
          {(product.community_boost ?? 0) > 0 && (product.community_boost ?? 0) < 35 && (
            <span className="bg-brand-500/90 text-white text-xs font-bold px-1.5 py-0.5 rounded-lg">
              🌿 Communauté
            </span>
          )}
          {product.is_in_network && !(product.community_boost) && (
            <span className="bg-brand-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-lg">
              Réseau
            </span>
          )}
        </div>
        {product.distance_km != null && (
          <span className="absolute bottom-2 right-2 z-10 bg-black/50 text-white text-xs px-1.5 py-0.5 rounded-lg">
            {product.distance_km < 1
              ? `${Math.round(product.distance_km * 1000)} m`
              : `${product.distance_km.toFixed(1)} km`}
          </span>
        )}
      </div>

      {/* Corps */}
      <div className="p-3 flex flex-col flex-1">
        <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2 flex-1">
          {product.name}
        </p>
        {product.subcategory_name && (
          <span className="text-xs text-gray-400 mt-0.5">{product.subcategory_name}</span>
        )}

        {/* Marchand + badges trust */}
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          <p className="text-xs text-gray-500 truncate flex-1">{product.business_name}</p>
          {pro && (
            <span className="text-xs text-brand-600 font-medium flex-shrink-0">
              <i className="ti ti-shield-check" aria-hidden="true" style={{ fontSize: 12 }} /> Pro
            </span>
          )}
        </div>

        {(product.buyer_count ?? 0) > 0 && (
          <p className="text-xs text-gray-400 mt-0.5">
            {product.buyer_count} membre{(product.buyer_count ?? 0) > 1 ? 's' : ''} ont acheté
          </p>
        )}

        {product.stock_quantity !== null && (
          <p className={`text-xs mt-0.5 font-medium ${
            outOfStock ? 'text-red-500' : product.stock_quantity <= 5 ? 'text-amber-600' : 'text-green-600'
          }`}>
            {outOfStock ? 'Rupture de stock' : product.stock_quantity <= 5 ? `Plus que ${product.stock_quantity} !` : 'En stock'}
          </p>
        )}

        <div className="mt-2">
          <p className="font-bold text-gray-900 text-sm">
            {formatFcfa(product.price_fcfa)}{' '}
            <span className="text-xs font-normal text-gray-500">FCFA</span>
          </p>
          {cashbackLabel && (
            <p className="text-xs text-brand-600 font-medium">
              {cashbackLabel} cashback 🔥
            </p>
          )}
        </div>

        {/* CTA — stopPropagation pour ne pas déclencher le onClick de la carte */}
        <Link
          href={payHref}
          className={`mt-2.5 block w-full text-center text-white text-xs font-semibold py-2 rounded-xl transition-colors active:scale-95 ${
            outOfStock
              ? 'bg-gray-300 cursor-not-allowed pointer-events-none'
              : 'bg-brand-600 hover:bg-brand-700'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {outOfStock ? 'Indisponible' : userId ? 'Acheter 🔥' : 'Créer un compte'}
        </Link>
      </div>
    </div>
  )
}

// Section horizontale scrollable
export function ProductSection({
  title,
  icon,
  products,
  userId,
  href,
}: {
  title: string
  icon: string
  products: MarketplaceProduct[]
  userId?: string | null
  href?: string
}) {
  if (products.length === 0) return null
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
          <i className={`ti ti-${icon}`} style={{ fontSize: 16 }} aria-hidden="true" />
          {title}
        </h2>
        {href && (
          <Link href={href} className="text-xs text-brand-600 font-medium hover:underline">
            Voir tout →
          </Link>
        )}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
        {products.map((p) => (
          <div key={p.id} className="flex-shrink-0 w-44 h-[288px]">
            <ProductCard product={p} userId={userId} />
          </div>
        ))}
      </div>
    </div>
  )
}
