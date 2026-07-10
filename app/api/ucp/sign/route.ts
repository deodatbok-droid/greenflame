/**
 * POST /api/ucp/sign
 *
 * State machine à 3 étapes pour la signature du BSD-UCP :
 *   step "accept" → horodatage + génération OTP + envoi WhatsApp
 *   step "otp"    → vérification OTP → otp_verified_at
 *   step "pin"    → vérification PIN → pin_verified_at + status user_signed
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { verifyPin } from '@/lib/utils/pin'
import { sendWhatsApp } from '@/lib/whatsapp/wasender'
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

const OTP_TTL_MS = 10 * 60 * 1000   // 10 minutes
const KEYLEN = 32

function generateOtp(): string {
  // 6 chiffres numériques
  return String(Math.floor(100000 + Math.random() * 900000))
}

function hashOtp(code: string, salt: string): string {
  return scryptSync(code, salt, KEYLEN).toString('hex')
}

function verifyOtp(code: string, storedHash: string): boolean {
  try {
    // Format stocké : "salt:hash"
    const [salt, hash] = storedHash.split(':')
    if (!salt || !hash) return false
    const derived = scryptSync(code, salt, KEYLEN)
    return timingSafeEqual(derived, Buffer.from(hash, 'hex'))
  } catch {
    return false
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id, step, code, pin } = await req.json()
  if (!id || !step) return NextResponse.json({ error: 'id et step requis' }, { status: 400 })

  const svc = createServiceClient()

  // Charger le bulletin (appartient à l'utilisateur)
  const { data: sub } = await svc
    .from('ucp_subscriptions')
    .select('id, status, otp_hash, otp_expires_at, accepted_at, otp_verified_at')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (!sub)
    return NextResponse.json({ error: 'Bulletin introuvable' }, { status: 404 })

  if (!['pending', 'user_signed'].includes(sub.status) || sub.status === 'signed' || sub.status === 'revoked')
    return NextResponse.json({ error: 'Ce bulletin ne peut plus être modifié' }, { status: 409 })

  const now = new Date()

  // ── Étape 1 : Acceptation ──────────────────────────────
  if (step === 'accept') {
    if (sub.accepted_at)
      return NextResponse.json({ error: 'Déjà accepté' }, { status: 409 })

    // Générer OTP
    const otpCode = generateOtp()
    const salt    = randomBytes(16).toString('hex')
    const hash    = hashOtp(otpCode, salt)
    const expires = new Date(Date.now() + OTP_TTL_MS).toISOString()

    await svc.from('ucp_subscriptions').update({
      accepted_at:   now.toISOString(),
      otp_hash:      `${salt}:${hash}`,
      otp_expires_at: expires,
    }).eq('id', id)

    // Récupérer le téléphone pour l'envoi WhatsApp
    const { data: profile } = await svc.from('users').select('phone, full_name').eq('id', user.id).single()
    if (profile?.phone) {
      const msg =
        `🔐 *GreenFlame — Code de validation BSD-UCP*\n\n` +
        `Votre code de vérification est : *${otpCode}*\n\n` +
        `Ce code est valable 10 minutes. Ne le partagez jamais.`
      sendWhatsApp(profile.phone, msg).catch(() => {})
    }

    return NextResponse.json({ ok: true, message: 'Code OTP envoyé sur WhatsApp' })
  }

  // ── Étape 2 : Vérification OTP ────────────────────────
  if (step === 'otp') {
    if (!code) return NextResponse.json({ error: 'Code OTP requis' }, { status: 400 })
    if (!sub.accepted_at) return NextResponse.json({ error: 'Étape 1 non complétée' }, { status: 409 })
    if (sub.otp_verified_at) return NextResponse.json({ error: 'OTP déjà vérifié' }, { status: 409 })

    if (!sub.otp_hash || !sub.otp_expires_at)
      return NextResponse.json({ error: 'Aucun OTP en attente — recommencez l\'étape 1' }, { status: 400 })

    if (new Date(sub.otp_expires_at) < now)
      return NextResponse.json({ error: 'Code OTP expiré — recommencez l\'étape 1' }, { status: 400 })

    if (!verifyOtp(code.toString().trim(), sub.otp_hash))
      return NextResponse.json({ error: 'Code OTP incorrect' }, { status: 401 })

    await svc.from('ucp_subscriptions').update({
      otp_verified_at: now.toISOString(),
    }).eq('id', id)

    return NextResponse.json({ ok: true, message: 'OTP vérifié' })
  }

  // ── Étape 3 : PIN transaction ─────────────────────────
  if (step === 'pin') {
    if (!pin) return NextResponse.json({ error: 'PIN requis' }, { status: 400 })
    if (!sub.otp_verified_at) return NextResponse.json({ error: 'Étape 2 non complétée' }, { status: 409 })

    const { data: profile } = await svc
      .from('users')
      .select('transaction_pin')
      .eq('id', user.id)
      .single()

    if (!profile?.transaction_pin)
      return NextResponse.json({ error: 'Aucun PIN configuré sur ce compte' }, { status: 400 })

    const pinValid = profile.transaction_pin.includes(':')
      ? verifyPin(pin.toString(), profile.transaction_pin)
      : profile.transaction_pin === pin.toString()

    if (!pinValid)
      return NextResponse.json({ error: 'PIN incorrect' }, { status: 401 })

    await svc.from('ucp_subscriptions').update({
      pin_verified_at: now.toISOString(),
      status:          'user_signed',
    }).eq('id', id)

    // Notifier l'admin via WhatsApp (numéro de l'admin principal stocké en env)
    const adminPhone = process.env.ADMIN_WHATSAPP_PHONE
    if (adminPhone) {
      const { data: sub2 } = await svc
        .from('ucp_subscriptions')
        .select('bsd_number, ucp_parts, subscription_type, amount_fcfa')
        .eq('id', id)
        .single()
      const { data: userProfile } = await svc.from('users').select('full_name').eq('id', user.id).single()
      if (sub2) {
        const msg =
          `✍️ *GreenFlame — Bulletin BSD-UCP signé*\n\n` +
          `*${userProfile?.full_name ?? 'Un Leader'}* vient de signer le bulletin *${sub2.bsd_number}*.\n` +
          `Type : ${sub2.subscription_type === 'purchase' ? 'Achat' : 'Attribution'}\n` +
          `Parts UCP : ${sub2.ucp_parts}\n` +
          (sub2.subscription_type === 'purchase'
            ? `Montant : ${Number(sub2.amount_fcfa).toLocaleString('fr-FR')} FCFA\n`
            : '') +
          `\n⏳ En attente de votre confirmation de paiement.`
        sendWhatsApp(adminPhone, msg).catch(() => {})
      }
    }

    return NextResponse.json({ ok: true, message: 'Bulletin signé — en attente de confirmation' })
  }

  return NextResponse.json({ error: 'Étape inconnue' }, { status: 400 })
}
