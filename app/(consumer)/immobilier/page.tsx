import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { PropertyCard, type PublicProperty } from '@/components/immobilier/PropertyCard'
import { getServerT } from '@/lib/i18n/server'

export const revalidate = 60

const CATEGORY_BG   = '#E1F5EE'
const CATEGORY_ICON = '#0F6E56'

const PROPERTY_TYPES = ['appartement', 'maison_villa', 'terrain_parcelle', 'local_commercial', 'bureau'] as const
const LISTING_TYPES  = ['location', 'vente'] as const
const SORTS          = ['recent', 'prix_asc', 'prix_desc'] as const

interface SearchParams {
  type?: string
  bien?: string
  ville?: string
  prix_min?: string
  prix_max?: string
  pieces_min?: string
  surface_min?: string
  tri?: string
}

export default async function ImmobilierPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const { t, locale } = await getServerT()

  const type    = LISTING_TYPES.includes(sp.type as never) ? sp.type : ''
  const bien    = PROPERTY_TYPES.includes(sp.bien as never) ? sp.bien : ''
  const ville   = sp.ville?.trim() ?? ''
  const prixMin = parseFloat(sp.prix_min ?? '')
  const prixMax = parseFloat(sp.prix_max ?? '')
  const piecesMin  = parseInt(sp.pieces_min ?? '', 10)
  const surfaceMin = parseFloat(sp.surface_min ?? '')
  const tri     = SORTS.includes(sp.tri as never) ? (sp.tri as typeof SORTS[number]) : 'recent'

  const supabase = await createClient()
  let query = supabase.from('v_public_properties').select('*').limit(60)

  if (type) query = query.eq('listing_type', type)
  if (bien) query = query.eq('property_type', bien)
  if (ville) query = query.or(`city.ilike.%${ville}%,neighborhood.ilike.%${ville}%`)
  if (!isNaN(prixMin)) query = query.gte('price_fcfa', prixMin)
  if (!isNaN(prixMax)) query = query.lte('price_fcfa', prixMax)
  if (!isNaN(piecesMin)) query = query.gte('rooms', piecesMin)
  if (!isNaN(surfaceMin)) query = query.gte('surface_m2', surfaceMin)

  if (tri === 'prix_asc')  query = query.order('price_fcfa', { ascending: true })
  if (tri === 'prix_desc') query = query.order('price_fcfa', { ascending: false })
  if (tri === 'recent')    query = query.order('created_at', { ascending: false })

  const { data } = await query
  const properties = (data ?? []) as unknown as PublicProperty[]

  const hasActiveFilters = !!(type || bien || ville || sp.prix_min || sp.prix_max || sp.pieces_min || sp.surface_min || (sp.tri && sp.tri !== 'recent'))

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div
        className="px-5 pt-12 pb-5 md:pt-8 md:rounded-b-3xl"
        style={{ background: `linear-gradient(135deg, ${CATEGORY_BG}, ${CATEGORY_BG}dd)` }}
      >
        <Link href="/marketplace" className="text-sm mb-4 inline-block" style={{ color: CATEGORY_ICON }}>
          {t('immobilier.backToMarketplace')}
        </Link>
        <div className="flex items-center gap-3">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: `${CATEGORY_ICON}20` }}
          >
            <i className="ti ti-building" style={{ fontSize: 28, color: CATEGORY_ICON }} aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: CATEGORY_ICON }}>{t('immobilier.title')}</h1>
            <p className="text-sm mt-0.5" style={{ color: `${CATEGORY_ICON}bb` }}>{t('immobilier.tagline')}</p>
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 space-y-5 mt-5">

        {/* Filtres — formulaire GET, fonctionne sans JS */}
        <form className="bg-gray-50 rounded-2xl p-4 space-y-3 border border-gray-100">
          <div className="grid grid-cols-2 gap-3">
            <select name="type" defaultValue={type} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
              <option value="">{t('immobilier.allListingTypes')}</option>
              {LISTING_TYPES.map((v) => (
                <option key={v} value={v}>{t(`immobilier.${v}`)}</option>
              ))}
            </select>
            <select name="bien" defaultValue={bien} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
              <option value="">{t('immobilier.allPropertyTypes')}</option>
              {PROPERTY_TYPES.map((v) => (
                <option key={v} value={v}>{t(`immobilier.${v}`)}</option>
              ))}
            </select>
          </div>

          <input
            type="text"
            name="ville"
            defaultValue={ville}
            placeholder={t('immobilier.filterCityPlaceholder')}
            className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white"
          />

          <details>
            <summary className="text-xs font-semibold text-gray-500 uppercase tracking-wide cursor-pointer select-none">
              {t('immobilier.filterPriceMin')} / {t('immobilier.filterRoomsMin')} / {t('immobilier.filterSurfaceMin')}
            </summary>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <input type="number" name="prix_min" min="0" defaultValue={sp.prix_min ?? ''} placeholder={t('immobilier.filterPriceMin')} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
              <input type="number" name="prix_max" min="0" defaultValue={sp.prix_max ?? ''} placeholder={t('immobilier.filterPriceMax')} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
              <input type="number" name="pieces_min" min="0" defaultValue={sp.pieces_min ?? ''} placeholder={t('immobilier.filterRoomsMin')} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
              <input type="number" name="surface_min" min="0" defaultValue={sp.surface_min ?? ''} placeholder={t('immobilier.filterSurfaceMin')} className="border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white" />
            </div>
          </details>

          <div className="flex items-center gap-2">
            <select name="tri" defaultValue={tri} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white">
              <option value="recent">{t('immobilier.sortRecent')}</option>
              <option value="prix_asc">{t('immobilier.sortPriceAsc')}</option>
              <option value="prix_desc">{t('immobilier.sortPriceDesc')}</option>
            </select>
            <button type="submit" className="px-4 py-2 rounded-xl text-sm font-semibold text-white flex-shrink-0" style={{ background: CATEGORY_ICON }}>
              {t('immobilier.applyFilters')}
            </button>
          </div>

          {hasActiveFilters && (
            <Link href="/immobilier" className="text-xs text-red-500 hover:underline inline-block">
              {t('immobilier.resetFilters')}
            </Link>
          )}
        </form>

        {/* Résultats */}
        <section>
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            {properties.length === 1
              ? t('immobilier.resultCount').replace('{n}', String(properties.length))
              : t('immobilier.resultCountPlural').replace('{n}', String(properties.length))}
          </h2>

          {properties.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <p className="text-5xl mb-4">🏠</p>
              <p className="font-semibold text-gray-600">{t('immobilier.noResults')}</p>
              <p className="text-sm mt-1">{t('immobilier.noResultsHint')}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {properties.map((property) => (
                <PropertyCard key={property.id} property={property} locale={locale} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
