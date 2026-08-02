import { NextRequest, NextResponse } from 'next/server'
import { getBizApiSession } from '@/lib/business/auth'
import { createServiceClient } from '@/lib/supabase/server'

async function loadVisitBusinessId(svc: ReturnType<typeof createServiceClient>, id: string) {
  const { data } = await svc.from('biz_property_visits').select('business_id').eq('id', id).maybeSingle()
  return data?.business_id ?? null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const svc = createServiceClient()

  const businessId = await loadVisitBusinessId(svc, id)
  if (!businessId) return NextResponse.json({ error: 'Visite introuvable' }, { status: 404 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json() as { status?: string }
  const { status } = body
  if (!status || !['planifiee', 'effectuee', 'annulee'].includes(status)) {
    return NextResponse.json({ error: 'Statut invalide' }, { status: 400 })
  }

  const { error } = await svc
    .from('biz_property_visits')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const svc = createServiceClient()

  const businessId = await loadVisitBusinessId(svc, id)
  if (!businessId) return NextResponse.json({ error: 'Visite introuvable' }, { status: 404 })

  const bizSession = await getBizApiSession(businessId)
  if (!bizSession) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { error } = await svc.from('biz_property_visits').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
