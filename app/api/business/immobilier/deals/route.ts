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

type SplitInput = { business_id?: string; role?: string; percentage?: number }
type DealBody = {
  business_id?: string
  biz_property_id?: string
  commission_amount_fcfa?: number
  notes?: string | null
  splits?: SplitInput[]
}

const ROLES = ['lister', 'closer', 'autre']

export async function POST(request: NextRequest) {
  const url  = new URL(request.url)
  const body = await request.json() as DealBody

  const businessId = await resolveBusinessId(url.searchParams.get('business_id') ?? body.business_id)
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { biz_property_id, commission_amount_fcfa, notes, splits: rawSplits = [] } = body

  if (!biz_property_id) return NextResponse.json({ error: 'Bien requis' }, { status: 400 })
  if (commission_amount_fcfa == null || commission_amount_fcfa <= 0) {
    return NextResponse.json({ error: 'Montant de commission requis' }, { status: 400 })
  }
  if (rawSplits.length === 0) return NextResponse.json({ error: 'Au moins un bénéficiaire requis' }, { status: 400 })

  // Une ligne sans business_id désigne le déclarant lui-même.
  const splits = rawSplits.map(s => ({ ...s, business_id: s.business_id ?? businessId }))

  for (const s of splits) {
    if (!s.business_id) return NextResponse.json({ error: 'Bénéficiaire manquant dans la répartition' }, { status: 400 })
    if (!s.role || !ROLES.includes(s.role)) return NextResponse.json({ error: 'Rôle invalide dans la répartition' }, { status: 400 })
    if (s.percentage == null || s.percentage <= 0 || s.percentage > 100) {
      return NextResponse.json({ error: 'Pourcentage invalide dans la répartition' }, { status: 400 })
    }
  }

  const totalPercentage = splits.reduce((sum, s) => sum + (s.percentage ?? 0), 0)
  if (Math.round(totalPercentage * 100) !== 10000) {
    return NextResponse.json({ error: `La répartition doit totaliser 100% (actuel : ${totalPercentage}%)` }, { status: 400 })
  }

  const svc = createServiceClient()

  const { data: property } = await svc.from('biz_properties').select('business_id').eq('id', biz_property_id).maybeSingle()
  if (!property || property.business_id !== businessId) return NextResponse.json({ error: 'Bien introuvable' }, { status: 404 })

  const { data: deal, error } = await svc
    .from('biz_property_deals')
    .insert({
      business_id: businessId,
      biz_property_id,
      commission_amount_fcfa,
      notes: notes || null,
      created_by: bizSession.user.id,
    })
    .select('id')
    .single()

  if (error || !deal) return NextResponse.json({ error: error?.message ?? 'Erreur création du deal' }, { status: 500 })

  const { error: splitsError } = await svc
    .from('biz_property_deal_splits')
    .insert(splits.map(s => ({ deal_id: deal.id, business_id: s.business_id, role: s.role, percentage: s.percentage })))

  if (splitsError) {
    await svc.from('biz_property_deals').delete().eq('id', deal.id)
    return NextResponse.json({ error: splitsError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, deal_id: deal.id })
}

export async function GET(request: NextRequest) {
  const url        = new URL(request.url)
  const businessId = await resolveBusinessId(url.searchParams.get('business_id'))
  if (!businessId) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const svc = createServiceClient()

  const { data: participantSplits } = await svc.from('biz_property_deal_splits').select('deal_id').eq('business_id', businessId)
  const participantDealIds = (participantSplits ?? []).map(s => s.deal_id)

  const orFilter = participantDealIds.length > 0
    ? `business_id.eq.${businessId},id.in.(${participantDealIds.join(',')})`
    : `business_id.eq.${businessId}`

  const { data, error } = await svc
    .from('biz_property_deals')
    .select('id, business_id, biz_property_id, commission_amount_fcfa, gf_fee_fcfa, status, created_at, settled_at, biz_properties(title), biz_property_deal_splits(business_id, role, percentage, biz_accounts(name))')
    .or(orFilter)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((data ?? []).map(d => ({ ...d, is_declarant: d.business_id === businessId })))
}
