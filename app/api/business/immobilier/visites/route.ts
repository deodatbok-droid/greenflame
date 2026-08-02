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

type VisitBody = {
  business_id?: string
  biz_property_id?: string
  customer_id?: string | null
  scheduled_at?: string
  notes?: string | null
}

export async function POST(request: NextRequest) {
  const url  = new URL(request.url)
  const body = await request.json() as VisitBody

  const businessId = await resolveBusinessId(url.searchParams.get('business_id') ?? body.business_id)
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { biz_property_id, customer_id, scheduled_at, notes } = body

  if (!biz_property_id) return NextResponse.json({ error: 'Bien requis' }, { status: 400 })
  if (!scheduled_at) return NextResponse.json({ error: 'Date de visite requise' }, { status: 400 })

  const svc = createServiceClient()

  const { data: property } = await svc.from('biz_properties').select('business_id').eq('id', biz_property_id).maybeSingle()
  if (!property || property.business_id !== businessId) return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 })

  if (customer_id) {
    const { data: customer } = await svc.from('biz_customers').select('business_id').eq('id', customer_id).maybeSingle()
    if (!customer || customer.business_id !== businessId) return NextResponse.json({ error: 'Client introuvable' }, { status: 404 })
  }

  const { data: visit, error } = await svc
    .from('biz_property_visits')
    .insert({
      business_id:     businessId,
      biz_property_id,
      customer_id:     customer_id || null,
      scheduled_at,
      notes:           notes || null,
      created_by:      bizSession.user.id,
    })
    .select('id')
    .single()

  if (error || !visit) return NextResponse.json({ error: error?.message ?? 'Erreur création de la visite' }, { status: 500 })

  return NextResponse.json({ ok: true, visit_id: visit.id })
}

export async function GET(request: NextRequest) {
  const url        = new URL(request.url)
  const businessId = await resolveBusinessId(url.searchParams.get('business_id'))
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('biz_property_visits')
    .select('id, biz_property_id, customer_id, scheduled_at, status, notes, biz_properties(title), biz_customers(name, phone)')
    .eq('business_id', businessId)
    .order('scheduled_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
