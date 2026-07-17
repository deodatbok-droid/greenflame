/**
 * POST /api/bons/offrir
 *
 * Offre un bon d'achat à un membre de la plateforme ou à un non-membre.
 * Offrir à un non-membre = levier d'acquisition viral : il doit s'inscrire
 * pour utiliser le bon chez un marchand GreenFlame.
 *
 * Body: {
 *   bonId:               string  — UUID du bon à offrir
 *   recipientPhone?:     string  — téléphone du destinataire (membre ou non-membre)
 *   recipientEmail?:     string  — email du destinataire (optionnel)
 *   recipientUserId?:    string  — UUID si destinataire est un membre connu
 * }
 *
 * Règles :
 *  - Le bon doit appartenir à l'émetteur (issued_by_id = user.id)
 *  - Le bon doit être actif et non expiré
 *  - Seul l'émetteur original peut l'offrir
 *  - Après le don : owner_id = recipientUserId (si membre) ou null + gift_recipient_phone/email
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/ussd/africastalking'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { bonId, recipientPhone, recipientEmail, recipientUserId } = body

  if (!bonId || typeof bonId !== 'string') {
    return NextResponse.json({ error: 'Identifiant bon requis' }, { status: 400 })
  }
  if (!recipientPhone && !recipientEmail && !recipientUserId) {
    return NextResponse.json({ error: 'Destinataire requis (téléphone, email ou ID membre)' }, { status: 400 })
  }

  const svc = createServiceClient()
  const now = new Date().toISOString()

  // Récupérer le bon
  const { data: bon } = await svc
    .from('vouchers')
    .select('id, code, amount_fcfa, remaining_fcfa, status, expires_at, issued_by_id, owner_id')
    .eq('id', bonId)
    .maybeSingle()

  if (!bon) {
    return NextResponse.json({ error: 'Bon introuvable' }, { status: 404 })
  }

  // Seul l'émetteur original peut offrir le bon
  if (bon.issued_by_id !== user.id) {
    return NextResponse.json({ error: 'Seul l\'émetteur du bon peut l\'offrir' }, { status: 403 })
  }
  if (bon.status !== 'active' && bon.status !== 'partially_used') {
    return NextResponse.json({ error: `Ce bon ne peut plus être offert (statut: ${bon.status})` }, { status: 400 })
  }
  if (bon.expires_at < now) {
    await svc.from('vouchers').update({ status: 'expired', updated_at: now }).eq('id', bon.id)
    return NextResponse.json({ error: 'Ce bon a expiré' }, { status: 400 })
  }

  // Résoudre le destinataire membre si recipientPhone est fourni
  let resolvedUserId = recipientUserId ?? null
  if (!resolvedUserId && recipientPhone) {
    const { data: member } = await svc
      .from('users')
      .select('id')
      .eq('phone', recipientPhone)
      .maybeSingle()
    if (member) resolvedUserId = member.id
  }

  // Transférer le bon
  await svc.from('vouchers').update({
    owner_id:             resolvedUserId,
    gift_recipient_phone: recipientPhone   ?? null,
    gift_recipient_email: recipientEmail   ?? null,
    updated_at:           now,
  }).eq('id', bon.id)

  // Notifier le destinataire par SMS si téléphone fourni et non-membre
  if (recipientPhone && !resolvedUserId) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenflame.africa'
    const msg = `[GreenFlame] Vous avez reçu un bon d'achat de ${bon.remaining_fcfa.toLocaleString('fr-FR')} FCFA ! Utilisable chez tous nos marchands. Créez votre compte : ${baseUrl}/register`
    sendSms({ to: recipientPhone, message: msg }).catch(() => {})
  }

  return NextResponse.json({
    ok:          true,
    bonId:       bon.id,
    code:        bon.code,
    montantFcfa: bon.remaining_fcfa,
    destinataire: resolvedUserId
      ? { type: 'membre', userId: resolvedUserId }
      : { type: 'non-membre', phone: recipientPhone, email: recipientEmail },
  })
}
