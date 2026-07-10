/**
 * POST /api/ucp/[id]/confirm
 *
 * Admin confirme que le paiement a été reçu (ou valide une attribution).
 * Déclenche la génération du PDF et passe le bulletin à "signed".
 */

export const runtime = 'nodejs'

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWhatsApp } from '@/lib/whatsapp/wasender'
import { generateUcpPdf } from '@/lib/ucp/pdf-generator'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  // Vérifier que c'est un admin
  const { data: adminProfile } = await svc.from('users').select('role, full_name').eq('id', user.id).single()
  const isAdmin = adminProfile?.role?.includes('admin') || adminProfile?.role?.includes('platform_upline')
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { payment_note } = await req.json()

  // Charger le bulletin
  const { data: sub } = await svc
    .from('ucp_subscriptions')
    .select('*')
    .eq('id', id)
    .single()

  if (!sub) return NextResponse.json({ error: 'Bulletin introuvable' }, { status: 404 })

  if (sub.status !== 'user_signed')
    return NextResponse.json({
      error: `Impossible de confirmer : statut actuel "${sub.status}" (attendu : user_signed)`
    }, { status: 409 })

  // Charger les infos du bénéficiaire
  const { data: beneficiary } = await svc
    .from('users')
    .select('full_name, phone, email, referral_code')
    .eq('id', sub.user_id)
    .single()

  if (!beneficiary) return NextResponse.json({ error: 'Bénéficiaire introuvable' }, { status: 500 })

  const now = new Date().toISOString()

  // Générer le PDF
  let pdfUrl: string | null = null
  try {
    pdfUrl = await generateUcpPdf({
      bsdNumber:        sub.bsd_number,
      subscriptionType: sub.subscription_type,
      ucpParts:         sub.ucp_parts,
      unitPriceFcfa:    sub.prix_unitaire_fcfa ?? 0,
      amountFcfa:       sub.amount_fcfa,
      userName:         beneficiary.full_name,
      userPhone:        beneficiary.phone ?? '',
      userEmail:        beneficiary.email ?? '',
      adminName:        adminProfile?.full_name ?? 'Administration GreenFlame',
      acceptedAt:       sub.accepted_at,
      otpVerifiedAt:    sub.otp_verified_at,
      pinVerifiedAt:    sub.pin_verified_at,
      confirmedAt:      now,
      paymentNote:      payment_note ?? null,
    })
  } catch (err) {
    console.error('[UCP confirm] Erreur génération PDF :', err)
    // On confirme quand même même si le PDF échoue — sera régénérable
  }

  // Mettre à jour le bulletin
  await svc.from('ucp_subscriptions').update({
    status:         'signed',
    confirmed_by:   user.id,
    confirmed_at:   now,
    payment_note:   payment_note ?? null,
    pdf_url:        pdfUrl,
  }).eq('id', id)

  // Notifier le bénéficiaire
  if (beneficiary.phone) {
    const partsLabel = `${sub.ucp_parts} part${sub.ucp_parts > 1 ? 's' : ''} UCP`
    const msg =
      `✅ *GreenFlame — Bulletin BSD-UCP confirmé !*\n\n` +
      `Votre souscription de *${partsLabel}* (bulletin *${sub.bsd_number}*) a été validée par l'administration.\n\n` +
      `Votre Bulletin de Souscription de Droits UCP est maintenant officiel. ` +
      `Ces parts vous confèrent un droit prioritaire sur les actions GreenFlame SA lors de l'ouverture du capital.\n\n` +
      `Consultez votre document dans votre espace.\n\n➡ greenflame.africa/ucp`
    sendWhatsApp(beneficiary.phone, msg).catch(() => {})
  }

  return NextResponse.json({ ok: true, pdfUrl, message: 'Bulletin confirmé et PDF généré' })
}
