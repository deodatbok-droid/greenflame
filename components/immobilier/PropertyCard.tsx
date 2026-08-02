import Link from 'next/link'
import Image from 'next/image'
import { formatFcfa } from '@/lib/utils/format'
import type { Locale } from '@/lib/i18n'
import { getTranslations } from '@/lib/i18n'

export interface PublicProperty {
  id: string
  business_name: string
  title: string
  listing_type: 'location' | 'vente'
  property_type: 'appartement' | 'maison_villa' | 'terrain_parcelle' | 'local_commercial' | 'bureau'
  price_fcfa: number
  price_period: 'mensuel' | 'unique' | null
  surface_m2: number | null
  rooms: number | null
  city: string | null
  neighborhood: string | null
  photos: string[]
  description: string | null
  created_at: string
}

export function PropertyCard({ property, locale }: { property: PublicProperty; locale: Locale }) {
  const t = getTranslations(locale)
  const cover = property.photos?.[0] ?? null
  const location = [property.neighborhood, property.city].filter(Boolean).join(', ')

  return (
    <Link
      href={`/immobilier/${property.id}`}
      className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-brand-200 transition-all overflow-hidden flex flex-col h-full"
    >
      <div className="relative h-36 flex items-center justify-center overflow-hidden bg-gray-100">
        {cover ? (
          <Image
            src={cover}
            alt={property.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 50vw, 25vw"
          />
        ) : (
          <span className="text-5xl">🏠</span>
        )}
        <span
          className={`absolute top-2 left-2 text-xs font-bold px-1.5 py-0.5 rounded-lg text-white ${
            property.listing_type === 'location' ? 'bg-brand-600' : 'bg-amber-500'
          }`}
        >
          {t(`immobilier.${property.listing_type}`)}
        </span>
      </div>

      <div className="p-3 flex flex-col flex-1">
        <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">
          {property.title}
        </p>
        {location && <p className="text-xs text-gray-500 mt-0.5 truncate">{location}</p>}

        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <span className="text-xs text-gray-400">{t(`immobilier.${property.property_type}`)}</span>
          {property.rooms != null && (
            <span className="text-xs text-gray-400">· {t('immobilier.roomsBadge').replace('{n}', String(property.rooms))}</span>
          )}
          {property.surface_m2 != null && (
            <span className="text-xs text-gray-400">· {t('immobilier.surfaceBadge').replace('{n}', String(property.surface_m2))}</span>
          )}
        </div>

        <div className="mt-auto pt-2">
          <p className="font-bold text-gray-900 text-sm">
            {formatFcfa(property.price_fcfa)}{' '}
            <span className="text-xs font-normal text-gray-500">
              FCFA{property.price_period === 'mensuel' ? ` ${t('immobilier.perMonth')}` : ''}
            </span>
          </p>
          <p className="text-xs text-gray-400 truncate mt-0.5">{property.business_name}</p>
        </div>
      </div>
    </Link>
  )
}
