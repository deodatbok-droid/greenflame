import { NextRequest, NextResponse } from 'next/server'
import { getBizApiSession } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'
import { notifyMatchingAlerts, isPubliclyListed } from '@/lib/immobilier/alerts'

type PropertyBody = {
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

async function loadPropertyBusinessId(svc: ReturnType<typeof createServiceClient>, id: string) {
  const { data } = await svc.from('biz_properties').select('business_id').eq('id', id).maybeSingle()
  return data?.business_id ?? null
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const svc = createServiceClient()

  const businessId = await loadPropertyBusinessId(svc, id)
  if (!businessId) return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data, error } = await svc.from('biz_properties').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: error?.message ?? 'Bien introuvable' }, { status: 404 })

  return NextResponse.json(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const svc = createServiceClient()

  const businessId = await loadPropertyBusinessId(svc, id)
  if (!businessId) return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json() as PropertyBody
  const { title, listing_type, property_type, price_fcfa, price_period, surface_m2, rooms, city, neighborhood, address_text, lat, lng, photos, description, gf_listed, status } = body

  if (!title?.trim()) return NextResponse.json({ error: 'Titre requis' }, { status: 400 })
  if (price_fcfa == null || price_fcfa <= 0) return NextResponse.json({ error: 'Prix requis' }, { status: 400 })

  const { data: before } = await svc.from('biz_properties').select('gf_listed, status').eq('id', id).maybeSingle()

  const location = (lat != null && lng != null && !isNaN(lat) && !isNaN(lng))
    ? `SRID=4326;POINT(${lng} ${lat})`
    : null

  const nextGfListed = gf_listed ?? false
  const nextStatus   = status || 'disponible'

  const { error } = await svc
    .from('biz_properties')
    .update({
      title:        title.trim(),
      listing_type,
      property_type,
      price_fcfa,
      price_period: price_period || null,
      surface_m2:   surface_m2 ?? null,
      rooms:        rooms ?? null,
      city:         city || null,
      neighborhood: neighborhood || null,
      address_text: address_text || null,
      location,
      photos:       photos ?? [],
      description:  description || null,
      gf_listed:    nextGfListed,
      status:       nextStatus,
      updated_at:   new Date().toISOString(),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const wasListed = isPubliclyListed(before?.gf_listed, before?.status)
  const isListed  = isPubliclyListed(nextGfListed, nextStatus)
  if (!wasListed && isListed && listing_type && property_type && price_fcfa != null) {
    void notifyMatchingAlerts({
      id, title: title.trim(), listing_type, property_type, price_fcfa,
      city: city || null, neighborhood: neighborhood || null, rooms: rooms ?? null, surface_m2: surface_m2 ?? null,
    })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const svc = createServiceClient()

  const businessId = await loadPropertyBusinessId(svc, id)
  if (!businessId) return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { error } = await svc.from('biz_properties').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
