import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { resolveQueueEntry } from '@/lib/network/spillover'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const service = createServiceClient()
  const { data: admin } = await service
    .from('users').select('role').eq('id', user.id).single()
  if (!admin?.role?.includes('admin')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { queueId, placedUnderId } = await req.json()
  if (!queueId || !placedUnderId) {
    return NextResponse.json({ error: 'queueId et placedUnderId requis' }, { status: 400 })
  }

  const result = await resolveQueueEntry(queueId, placedUnderId, service)
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
