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

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url        = new URL(request.url)
  const businessId = await resolveBusinessId(url.searchParams.get('business_id'))
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const svc = createServiceClient()
  const { data: deal } = await svc.from('biz_property_deals').select('business_id, status').eq('id', id).maybeSingle()
  if (!deal) return NextResponse.json({ error: 'Deal introuvable' }, { status: 404 })
  if (deal.business_id !== businessId) return NextResponse.json({ error: 'Seul le déclarant peut régler ce deal' }, { status: 403 })
  if (deal.status !== 'declared') return NextResponse.json({ error: 'Ce deal est déjà réglé' }, { status: 400 })

  const { error } = await svc.rpc('settle_property_deal', { p_deal_id: id })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
