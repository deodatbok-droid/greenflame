import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function loadAlertUserId(svc: ReturnType<typeof createServiceClient>, id: string) {
  const { data } = await svc.from('property_alerts').select('user_id').eq('id', id).maybeSingle()
  return data?.user_id ?? null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const ownerId = await loadAlertUserId(svc, id)
  if (!ownerId) return NextResponse.json({ error: 'Alerte introuvable' }, { status: 404 })
  if (ownerId !== user.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const body = await request.json() as { active?: boolean }
  if (typeof body.active !== 'boolean') {
    return NextResponse.json({ error: 'Champ active requis' }, { status: 400 })
  }

  const { error } = await svc.from('property_alerts').update({ active: body.active, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const ownerId = await loadAlertUserId(svc, id)
  if (!ownerId) return NextResponse.json({ error: 'Alerte introuvable' }, { status: 404 })
  if (ownerId !== user.id) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { error } = await svc.from('property_alerts').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
