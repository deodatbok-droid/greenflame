import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { formatFcfa } from '@/lib/utils/format'
import { getServerT } from '@/lib/i18n/server'
import type { PublicProperty } from '@/components/immobilier/PropertyCard'

export const revalidate = 60

interface Props {
  params: Promise<{ id: string }>
}

export default async function PropertyDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { t } = await getServerT()

  const { data } = await supabase
    .from('v_public_properties')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  const property = data as unknown as PublicProperty | null

  if (!property) notFound()

  const location = [property.neighborhood, property.city].filter(Boolean).join(', ')
  const photos = property.photos ?? []

  return (
    <div className="max-w-4xl mx-auto px-4 pt-8 pb-16">
      <Link href="/immobilier" className="text-sm text-gray-500 hover:text-brand-700 inline-block mb-4">
        {t('immobilier.backToCatalog')}
      </Link>

      {/* Photos */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 rounded-2xl overflow-hidden mb-5">
          <div className="relative col-span-2 h-64 bg-gray-100">
            <Image src={photos[0]} alt={property.title} fill className="object-cover" sizes="100vw" />
          </div>
          {photos.slice(1, 5).map((url, i) => (
            <div key={i} className="relative h-28 bg-gray-100">
              <Image src={url} alt={`${property.title} ${i + 2}`} fill className="object-cover" sizes="50vw" />
            </div>
          ))}
        </div>
      ) : (
        <div className="h-64 rounded-2xl bg-gray-100 flex items-center justify-center text-6xl mb-5">🏠</div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg text-white ${property.listing_type === 'location' ? 'bg-brand-600' : 'bg-amber-500'}`}>
          {t(`immobilier.${property.listing_type}`)}
        </span>
        <span className="text-xs text-gray-500">{t(`immobilier.${property.property_type}`)}</span>
      </div>

      <h1 className="text-xl font-bold text-gray-900">{property.title}</h1>
      {location && <p className="text-sm text-gray-500 mt-1">{location}</p>}

      <p className="text-2xl font-bold text-gray-900 mt-3">
        {formatFcfa(property.price_fcfa)}{' '}
        <span className="text-sm font-normal text-gray-500">
          FCFA{property.price_period === 'mensuel' ? ` ${t('immobilier.perMonth')}` : ''}
        </span>
      </p>

      <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
        {property.rooms != null && <span>{t('immobilier.roomsBadge').replace('{n}', String(property.rooms))}</span>}
        {property.surface_m2 != null && <span>{t('immobilier.surfaceBadge').replace('{n}', String(property.surface_m2))}</span>}
      </div>

      {property.description && (
        <div className="mt-5">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{t('immobilier.description')}</h2>
          <p className="text-sm text-gray-700 whitespace-pre-line">{property.description}</p>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-6">{t('immobilier.publishedBy').replace('{name}', property.business_name)}</p>
    </div>
  )
}
