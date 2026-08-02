import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

type AlertBody = {
  listing_type?: string | null
  property_type?: string | null
  city?: string | null
  neighborhood?: string | null
  price_min?: number | null
  price_max?: number | null
  rooms_min?: number | null
  surface_min?: number | null
}

const LISTING_TYPES = ['location', 'vente']
const PROPERTY_TYPES = ['appartement', 'maison_villa', 'terrain_parcelle', 'local_commercial', 'bureau']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const service = createServiceClient()
  const { data: hasPass } = await service.rpc('buyer_pass_active', { p_user_id: user.id })
  if (!hasPass) {
    return NextResponse.json({ error: 'Pass chercheur requis pour créer une alerte', passRequired: true }, { status: 402 })
  }

  const body = await req.json() as AlertBody
  const { listing_type, property_type, city, neighborhood, price_min, price_max, rooms_min, surface_min } = body

  if (listing_type && !LISTING_TYPES.includes(listing_type)) {
    return NextResponse.json({ error: "Type d'annonce invalide" }, { status: 400 })
  }
  if (property_type && !PROPERTY_TYPES.includes(property_type)) {
    return NextResponse.json({ error: 'Type de bien invalide' }, { status: 400 })
  }

  const { data: alert, error } = await service
    .from('property_alerts')
    .insert({
      user_id: user.id,
      listing_type: listing_type || null,
      property_type: property_type || null,
      city: city || null,
      neighborhood: neighborhood || null,
      price_min: price_min ?? null,
      price_max: price_max ?? null,
      rooms_min: rooms_min ?? null,
      surface_min: surface_min ?? null,
    })
    .select('id')
    .single()

  if (error || !alert) return NextResponse.json({ error: error?.message ?? "Erreur création de l'alerte" }, { status: 500 })
  return NextResponse.json({ ok: true, alert_id: alert.id })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const service = createServiceClient()
  const { data, error } = await service
    .from('property_alerts')
    .select('id, listing_type, property_type, city, neighborhood, price_min, price_max, rooms_min, surface_min, active, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
