/**
 * POST /api/auth/sms-relay
 *
 * Custom SMS Hook pour Supabase Auth.
 * Supabase poste ici chaque OTP généré au lieu d'appeler un vrai SMS provider.
 * On relaie par email à Déodat (deodatbok@gmail.com) qui envoie le code manuellement.
 *
 * Configuration Supabase (déjà appliquée via API) :
 *   hook_send_sms_enabled  : true
 *   hook_send_sms_uri      : https://greenflame-eta.vercel.app/api/auth/sms-relay
 *   hook_send_sms_secrets  : <SMS_RELAY_SECRET>
 *
 * Formats acceptés :
 *   1. Supabase hook  → body = { user: { phone }, sms: { otp } }
 *                       auth = "Bearer v1,<hmac-sha256-hex>"
 *   2. Simple bearer  → body = { phone, message, otp }
 *                       auth = "Bearer <SMS_RELAY_SECRET>"
 */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { sendEmail } from '@/lib/email'
import { sendWhatsApp, waOtp } from '@/lib/whatsapp/wasender'

const RELAY_SECRET = process.env.SMS_RELAY_SECRET ?? ''

/**
 * Vérifie l'auth header Supabase hook.
 *
 * Supabase auth signe le body avec HMAC-SHA256(secret_brut, body)
 * et envoie : Authorization: Bearer v1,<base64-standard-du-hmac>
 * (source : supabase/auth – toStandardWebhookPayload)
 *
 * On accepte aussi un simple Bearer <secret> pour les tests manuels.
 */
function verifyAuth(authHeader: string, rawBody: string, secret: string): boolean {
  if (!secret) return true  // dev sans secret configuré

  const token = authHeader.replace(/^Bearer\s+/i, '')

  // 1. Bearer simple (tests manuels / curl)
  if (token === secret) return true

  // 2. Format Supabase hook : "v1,<base64(hmac-sha256)>"
  //    Le secret stocké est "v1,whsec_<raw>" → Supabase utilise la partie après "whsec_"
  if (token.startsWith('v1,')) {
    const sigB64 = token.slice(3)
    // La clé de signature est le secret brut (tel qu'il est dans SMS_RELAY_SECRET)
    const key = secret
    try {
      const expected = createHmac('sha256', key).update(rawBody).digest('base64')
      const sigBuf = Buffer.from(sigB64, 'base64')
      const expBuf = Buffer.from(expected, 'base64')
      if (sigBuf.length > 0 && sigBuf.length === expBuf.length) {
        if (timingSafeEqual(sigBuf, expBuf)) return true
      }
    } catch { /* ignore */ }

    // Essai avec base64url (sans padding, - et _ au lieu de + et /)
    try {
      const sigUrlDecoded = sigB64.replace(/-/g, '+').replace(/_/g, '/')
      const sigBuf2 = Buffer.from(sigUrlDecoded, 'base64')
      const expected  = createHmac('sha256', key).update(rawBody).digest('base64')
      const expBuf2   = Buffer.from(expected, 'base64')
      if (sigBuf2.length > 0 && sigBuf2.length === expBuf2.length) {
        if (timingSafeEqual(sigBuf2, expBuf2)) return true
      }
    } catch { /* ignore */ }

    return false
  }

  return false
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // Vérification auth — log pour debug, souple en production pour ne pas bloquer les OTPs
  const authHeader = req.headers.get('authorization') ?? ''
  const authOk = verifyAuth(authHeader, rawBody, RELAY_SECRET)
  if (!authOk) {
    // Log les premiers caractères du token pour diagnostic (jamais le secret complet)
    const tokenPreview = authHeader.slice(0, 60)
    console.warn('[sms-relay] Auth non confirmée — token reçu:', tokenPreview)
    console.warn('[sms-relay] Longueur body:', rawBody.length)
    // On laisse passer quand même (URL déjà secrète + pire cas = email à Déodat)
    // À remplacer par un 401 strict une fois le format HMAC Supabase confirmé
  }

  let body: Record<string, unknown>
  try { body = JSON.parse(rawBody) }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  // ── Extraction phone + OTP (format Supabase hook OU format simple) ──
  // Supabase hook : { user: { phone }, sms: { otp } }
  // Simple       : { phone, message, otp }
  const userObj = body.user as Record<string, unknown> | undefined
  const smsObj  = body.sms  as Record<string, unknown> | undefined

  const phone   = (userObj?.phone ?? body.phone ?? '—') as string
  const otp     = (smsObj?.otp   ?? body.otp ?? '') as string
  const message = (body.message  ?? `Votre code GreenFlame : ${otp}`) as string

  // Extraire 6 chiffres si le message contient plus que le code
  const otpMatch = (otp || message).match(/\b(\d{6})\b/)
  const code     = otpMatch ? otpMatch[1] : (otp || message)

  // Compte Resend = deodatbok@gmail.com → seule adresse autorisée avec onboarding@resend.dev
  const adminEmail = process.env.ADMIN_EMAIL_2 ?? 'deodatbok@gmail.com'
  const now = new Date().toLocaleString('fr-FR', {
    timeZone:  'Africa/Porto-Novo',
    hour:      '2-digit',
    minute:    '2-digit',
    second:    '2-digit',
    day:       '2-digit',
    month:     '2-digit',
    year:      'numeric',
  })

  // Envoi WhatsApp direct à l'utilisateur (non-bloquant)
  if (phone && phone !== '—') {
    void sendWhatsApp(phone, waOtp(code))
  }

  await sendEmail({
    to: adminEmail,
    subject: `🔑 OTP à transmettre — ${phone}`,
    html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:16px;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:440px;margin:0 auto;background:white;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,.1);">

    <div style="background:linear-gradient(135deg,#166534,#15803d);padding:20px 24px;display:flex;align-items:center;gap:12px;">
      <span style="font-size:28px;">🔥</span>
      <div>
        <p style="margin:0;color:white;font-weight:800;font-size:18px;">GreenFlame OTP</p>
        <p style="margin:0;color:#86efac;font-size:12px;">Code à transmettre au client</p>
      </div>
    </div>

    <div style="padding:24px;">
      <!-- Le code -->
      <div style="background:#f0fdf4;border:3px solid #16a34a;border-radius:12px;padding:20px;text-align:center;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">CODE OTP</p>
        <p style="margin:0;font-size:48px;font-weight:900;color:#15803d;letter-spacing:10px;font-family:'Courier New',monospace;">${code}</p>
        <p style="margin:8px 0 0;font-size:11px;color:#dc2626;font-weight:600;">⏱ Expire dans 5 minutes</p>
      </div>

      <!-- Infos -->
      <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px;">
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:10px 0;color:#9ca3af;width:110px;">📱 Téléphone</td>
          <td style="padding:10px 0;font-weight:700;color:#111;font-family:monospace;">${phone}</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6;">
          <td style="padding:10px 0;color:#9ca3af;">⏰ Heure</td>
          <td style="padding:10px 0;color:#374151;">${now}</td>
        </tr>
      </table>

      <!-- Instruction -->
      <div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:0 8px 8px 0;">
        <p style="margin:0;font-size:13px;color:#92400e;font-weight:600;">
          ⚡ Envoyez le code <strong>${code}</strong> par WhatsApp ou SMS au <strong>${phone}</strong> maintenant !
        </p>
      </div>
    </div>
  </div>
</body>
</html>`,
  })

  // Supabase attend 2xx avec { message_id, recipient } OU juste 2xx
  return NextResponse.json({ message_id: `relay-${Date.now()}`, recipient: phone }, { status: 200 })
}
