import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { insertNotification } from '@/lib/utils/notify'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const isAdmin = (me?.role ?? []).some((r: string) => ['admin', 'platform_upline'].includes(r))
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { reason } = await req.json() as { reason?: string }
  if (!reason?.trim()) return NextResponse.json({ error: 'Motif de rejet obligatoire' }, { status: 400 })

  const { data: app } = await svc
    .from('merchant_applications')
    .select('user_id, business_name, status')
    .eq('id', id)
    .single()

  if (!app) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (app.status === 'rejected') return NextResponse.json({ error: 'Déjà rejeté' }, { status: 400 })

  const now = new Date().toISOString()

  await svc.from('merchant_applications').update({
    status:           'rejected',
    rejection_reason: reason.trim(),
    reviewed_by:      user.id,
    reviewed_at:      now,
  }).eq('id', id)

  void insertNotification({
    userId:      app.user_id,
    type:        'merchant_rejected',
    title:       'Demande de boutique non acceptée',
    body:        `Votre demande pour "${app.business_name}" n'a pas pu être acceptée. Motif : ${reason.trim()}. Vous pouvez soumettre une nouvelle demande.`,
    referenceId: id,
  })

  return NextResponse.json({ ok: true })
}
