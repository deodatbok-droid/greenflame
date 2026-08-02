import { NextRequest, NextResponse } from 'next/server'
import { getBizApiSession } from '@/lib/business/auth'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function resolveBusinessId(requestedId?: string | null): Promise<string | null> {
  if (requestedId) return requestedId
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return null
  const { data } = await auth.from('biz_members').select('business_id').eq('user_id', user.id).limit(1).maybeSingle()
  return data?.business_id ?? null
}

type MandatBody = {
  business_id?: string
  biz_property_id?: string
  owner_name?: string
  owner_phone?: string | null
  mandat_type?: string
  expires_at?: string | null
  notes?: string | null
}

export async function POST(request: NextRequest) {
  const url  = new URL(request.url)
  const body = await request.json() as MandatBody

  const businessId = await resolveBusinessId(url.searchParams.get('business_id') ?? body.business_id)
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { biz_property_id, owner_name, owner_phone, mandat_type = 'simple', expires_at, notes } = body

  if (!biz_property_id) return NextResponse.json({ error: 'Bien requis' }, { status: 400 })
  if (!owner_name?.trim()) return NextResponse.json({ error: 'Nom du propriétaire requis' }, { status: 400 })
  if (!['exclusif', 'simple'].includes(mandat_type)) return NextResponse.json({ error: 'Type de mandat invalide' }, { status: 400 })

  const svc = createServiceClient()

  const { data: property } = await svc.from('biz_properties').select('business_id').eq('id', biz_property_id).maybeSingle()
  if (!property || property.business_id !== businessId) return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 })

  const { data: mandat, error } = await svc
    .from('biz_property_mandats')
    .insert({
      business_id:     businessId,
      biz_property_id,
      owner_name:      owner_name.trim(),
      owner_phone:     owner_phone || null,
      mandat_type,
      expires_at:      expires_at || null,
      notes:           notes || null,
      created_by:      bizSession.user.id,
    })
    .select('id')
    .single()

  if (error || !mandat) return NextResponse.json({ error: error?.message ?? 'Erreur création du mandat' }, { status: 500 })

  return NextResponse.json({ ok: true, mandat_id: mandat.id })
}

export async function GET(request: NextRequest) {
  const url        = new URL(request.url)
  const businessId = await resolveBusinessId(url.searchParams.get('business_id'))
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('biz_property_mandats')
    .select('id, biz_property_id, owner_name, owner_phone, mandat_type, expires_at, status, created_at, biz_properties(title)')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
