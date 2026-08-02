import { NextRequest, NextResponse } from 'next/server'
import { getBizApiSession } from '@/lib/business/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { notifyMatchingAlerts, isPubliclyListed } from '@/lib/immobilier/alerts'

async function resolveBusinessId(requestedId?: string | null): Promise<string | null> {
  if (requestedId) return requestedId
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return null
  const { data } = await auth.from('biz_members').select('business_id').eq('user_id', user.id).limit(1).maybeSingle()
  return data?.business_id ?? null
}

type PropertyBody = {
  business_id?: string
  title?: string
  listing_type?: string
  property_type?: string
  price_fcfa?: number
  price_period?: string | null
  surface_m2?: number | null
  rooms?: number | null
  city?: string | null
  neighborhood?: string | null
  address_text?: string | null
  lat?: number | null
  lng?: number | null
  photos?: string[]
  description?: string | null
  gf_listed?: boolean
  status?: string
}

export async function POST(request: NextRequest) {
  const url  = new URL(request.url)
  const body = await request.json() as PropertyBody

  const businessId = await resolveBusinessId(url.searchParams.get('business_id') ?? body.business_id)
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { title, listing_type, property_type, price_fcfa, price_period, surface_m2, rooms, city, neighborhood, address_text, lat, lng, photos = [], description, gf_listed = false } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
  if (!listing_type || !['location', 'vente'].includes(listing_type)) return NextResponse.json({ error: 'Type d\'annonce invalide' }, { status: 400 })
  if (!property_type) return NextResponse.json({ error: 'Type de bien requis' }, { status: 400 })
  if (price_fcfa == null || price_fcfa <= 0) return NextResponse.json({ error: 'Prix requis' }, { status: 400 })

  const location = (lat != null && lng != null && !isNaN(lat) && !isNaN(lng))
    ? `SRID=4326;POINT(${lng} ${lat})`
    : null

  const svc = createServiceClient()
  const { data: property, error } = await svc
    .from('biz_properties')
    .insert({
      business_id:   businessId,
      title:         title.trim(),
      listing_type,
      property_type,
      price_fcfa,
      price_period:  price_period || null,
      surface_m2:    surface_m2 ?? null,
      rooms:         rooms ?? null,
      city:          city || null,
      neighborhood:  neighborhood || null,
      address_text:  address_text || null,
      location,
      photos,
      description:   description || null,
      gf_listed,
      created_by:    bizSession.user.id,
    })
    .select('id')
    .single()

  if (error || !property) return NextResponse.json({ error: error?.message ?? 'Erreur création du bien' }, { status: 500 })

  if (isPubliclyListed(gf_listed, 'disponible')) {
    void notifyMatchingAlerts({
      id: property.id, title: title.trim(), listing_type, property_type, price_fcfa,
      city: city || null, neighborhood: neighborhood || null, rooms: rooms ?? null, surface_m2: surface_m2 ?? null,
    })
  }

  return NextResponse.json({ ok: true, property_id: property.id })
}

export async function GET(request: NextRequest) {
  const url        = new URL(request.url)
  const businessId = await resolveBusinessId(url.searchParams.get('business_id'))
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('biz_properties')
    .select('id, title, listing_type, property_type, price_fcfa, price_period, surface_m2, rooms, city, neighborhood, status, gf_listed, photos, created_at')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
