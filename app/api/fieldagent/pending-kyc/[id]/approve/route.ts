import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { insertNotification } from '@/lib/utils/notify'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const canApprove = (me?.role ?? []).some((r: string) => ['field_agent', 'admin', 'platform_upline'].includes(r))
  if (!canApprove) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data: sub } = await svc
    .from('kyc_submissions')
    .select('id, user_id, status')
    .eq('id', id)
    .single()

  if (!sub) return NextResponse.json({ error: 'Soumission introuvable' }, { status: 404 })
  if (sub.status === 'approved') return NextResponse.json({ error: 'Déjà approuvé' }, { status: 400 })

  const now = new Date().toISOString()

  await svc.from('kyc_submissions').update({
    status:      'approved',
    reviewed_by: user.id,
    reviewed_at: now,
    updated_at:  now,
  }).eq('id', id)

  await svc.from('users').update({ kyc_level: 1 }).eq('id', sub.user_id)

  void insertNotification({
    userId:      sub.user_id,
    type:        'kyc_approved',
    title:       'Identité vérifiée',
    body:        'Votre identité a été vérifiée en personne par notre équipe terrain. Vous avez accès à toutes les fonctionnalités GreenFlame.',
    referenceId: id,
  })

  return NextResponse.json({ ok: true })
}
