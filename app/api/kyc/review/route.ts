import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendKycResultEmail } from '@/lib/email'
import { insertNotification } from '@/lib/utils/notify'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  // Verifier que c'est un admin
  const { data: reviewer } = await supabase.from('users').select('role').eq('id', user.id).single()
  const isAdmin = reviewer?.role?.includes('admin') || reviewer?.role?.includes('platform_upline')
  if (!isAdmin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })

  const { submissionId, decision, reason } = await req.json()
  if (!submissionId || !['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
  }

  const service = createServiceClient()

  // Recuperer la soumission
  const { data: sub } = await service
    .from('kyc_submissions')
    .select('user_id, users(full_name, phone, email)')
    .eq('id', submissionId)
    .single()

  if (!sub) return NextResponse.json({ error: 'Soumission introuvable' }, { status: 404 })

  // Mettre a jour le statut
  const { error } = await service.from('kyc_submissions').update({
    status: decision,
    rejection_reason: decision === 'rejected' ? (reason ?? null) : null,
    reviewed_by: user.id,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', submissionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Si approuve, monter le kyc_level a 1
  if (decision === 'approved') {
    await service.from('users').update({ kyc_level: 1 }).eq('id', sub.user_id)
  }

  // Notifier l'utilisateur (non-bloquant)
  const owner = sub.users as unknown as { full_name: string; phone: string; email?: string | null } | null
  if (owner) {
    sendKycResultEmail(owner.full_name, owner.phone, decision === 'approved', reason, owner.email).catch(() => {})
  }

  insertNotification({
    userId:      sub.user_id,
    type:        decision === 'approved' ? 'kyc_approved' : 'kyc_rejected',
    title:       decision === 'approved' ? '✅ Identité vérifiée' : '❌ Vérification refusée',
    body:        decision === 'approved'
      ? 'Votre identité a été vérifiée. Vous avez accès à toutes les fonctionnalités GreenFlame.'
      : `Vos documents n'ont pas pu être validés.${reason ? ` Raison : ${reason}` : ' Veuillez les resoumettre.'}`,
    referenceId: submissionId,
  }).catch(() => {})

  return NextResponse.json({ ok: true })
}
