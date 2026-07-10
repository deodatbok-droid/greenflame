'use client'

import Link from 'next/link'
import Image from 'next/image'

export interface MarketplaceCategory {
  id: string
  slug: string
  name: string
  icon: string | null
  color_bg: string
  color_icon: string
  image_url: string | null
  product_count?: number
}

export function CategoryGrid({ categories }: { categories: MarketplaceCategory[] }) {
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-7 gap-3">
      {categories.map((cat) => (
        <Link
          key={cat.slug}
          href={`/marketplace/categorie/${cat.slug}`}
          className="group flex flex-col items-center gap-2 p-3 rounded-2xl hover:bg-gray-50 transition-colors text-center"
        >
          <div
            className="w-[84px] h-[84px] rounded-2xl flex items-center justify-center overflow-hidden flex-shrink-0 group-hover:scale-105 transition-transform"
            style={{ background: cat.color_bg }}
          >
            {cat.image_url ? (
              <Image
                src={cat.image_url}
                alt={cat.name}
                width={84}
                height={84}
                className="object-cover w-full h-full"
              />
            ) : (
              <span style={{ fontSize: 36, color: cat.color_icon }}>
                <i className={`ti ti-${cat.icon ?? 'shopping-bag'}`} aria-hidden="true" />
              </span>
            )}
          </div>
          <span className="text-xs text-gray-700 font-medium leading-tight line-clamp-2">
            {cat.name}
          </span>
          {cat.product_count !== undefined && (
            <span className="text-xs text-gray-400">{cat.product_count}</span>
          )}
        </Link>
      ))}
    </div>
  )
}
