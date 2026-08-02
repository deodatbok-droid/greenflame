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

async function loadDeal(svc: ReturnType<typeof createServiceClient>, id: string) {
  const { data } = await svc
    .from('biz_property_deals')
    .select('id, business_id, biz_property_id, commission_amount_fcfa, gf_fee_fcfa, status, notes, created_at, settled_at, biz_properties(title), biz_property_deal_splits(id, business_id, role, percentage, biz_accounts(name))')
    .eq('id', id)
    .maybeSingle()
  return data
}

async function assertParticipant(svc: ReturnType<typeof createServiceClient>, dealBusinessId: string, splits: Array<{ business_id: string }>, callerBusinessId: string) {
  return dealBusinessId === callerBusinessId || splits.some(s => s.business_id === callerBusinessId)
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url        = new URL(request.url)
  const businessId = await resolveBusinessId(url.searchParams.get('business_id'))
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const svc  = createServiceClient()
  const deal = await loadDeal(svc, id)
  if (!deal) return NextResponse.json({ error: 'Deal introuvable' }, { status: 404 })

  const splits = (deal.biz_property_deal_splits ?? []) as unknown as Array<{ business_id: string }>
  if (!await assertParticipant(svc, deal.business_id, splits, businessId)) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  }

  return NextResponse.json({ ...deal, is_declarant: deal.business_id === businessId })
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const url        = new URL(request.url)
  const businessId = await resolveBusinessId(url.searchParams.get('business_id'))
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const svc  = createServiceClient()
  const deal = await loadDeal(svc, id)
  if (!deal) return NextResponse.json({ error: 'Deal introuvable' }, { status: 404 })
  if (deal.business_id !== businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })
  if (deal.status !== 'declared') return NextResponse.json({ error: 'Ce deal est déjà réglé' }, { status: 400 })

  const { error } = await svc.from('biz_property_deals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
