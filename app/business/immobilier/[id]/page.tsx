import { getBizSession } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import PropertyForm, { PropertyFormValues } from '../PropertyForm'

async function getProperty(businessId: string, id: string) {
  const svc = createServiceClient()
  const { data } = await svc
    .from('biz_properties')
    .select('id, title, listing_type, property_type, price_fcfa, price_period, surface_m2, rooms, city, neighborhood, address_text, photos, description, gf_listed, status')
    .eq('business_id', businessId)
    .eq('id', id)
    .maybeSingle()
  return data
}

export default async function ModifierBienPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session  = await getBizSession()
  const property = await getProperty(session.account.id, id)

  if (!property) notFound()

  const initial: PropertyFormValues = {
    id:            property.id,
    title:         property.title,
    listing_type:  property.listing_type,
    property_type: property.property_type,
    price_fcfa:    String(property.price_fcfa ?? ''),
    price_period:  (property.price_period ?? 'mensuel') as 'mensuel' | 'unique',
    surface_m2:    property.surface_m2 != null ? String(property.surface_m2) : '',
    rooms:         property.rooms != null ? String(property.rooms) : '',
    city:          property.city ?? '',
    neighborhood:  property.neighborhood ?? '',
    address_text:  property.address_text ?? '',
    photos:        property.photos ?? [],
    description:   property.description ?? '',
    gf_listed:     property.gf_listed,
    status:        property.status,
  }

  return <PropertyForm initial={initial} />
}
