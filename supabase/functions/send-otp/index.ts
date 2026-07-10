// Edge Function : send-otp
// Hook Supabase Auth (custom SMS sender)
// Payload : { user: { phone: "..." }, sms: { otp: "..." } }
//
// Priorité :
//   1. Africa's Talking (si AT_API_KEY configurée)
//   2. Resend email aux admins (fallback demo)
//   3. Log console uniquement (dev)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  let payload: { user?: { phone?: string }; sms?: { otp?: string } }
  try {
    payload = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 })
  }

  const phone = payload?.user?.phone
  const otp = payload?.sms?.otp

  if (!phone || !otp) {
    console.error('Missing phone or otp:', JSON.stringify(payload))
    return new Response(JSON.stringify({ error: 'phone and otp required' }), { status: 400 })
  }

  const atApiKey = Deno.env.get('AT_API_KEY')
  const resendKey = Deno.env.get('RESEND_API_KEY')
  const adminEmail1 = Deno.env.get('ADMIN_EMAIL') ?? 'aurelioteam229@gmail.com'
  const adminEmail2 = Deno.env.get('ADMIN_EMAIL_2') ?? 'deodatbok@gmail.com'

  // ── 1. Africa's Talking ──────────────────────────────────────────────────
  if (atApiKey) {
    const username = Deno.env.get('AT_USERNAME') ?? 'sandbox'
    const sender = Deno.env.get('AT_SMS_SENDER') ?? 'GRFLAME'
    const isSandbox = username === 'sandbox'
    const baseUrl = isSandbox
      ? 'https://api.sandbox.africastalking.com/version1/messaging'
      : 'https://api.africastalking.com/version1/messaging'

    const message = `Votre code GreenFlame : ${otp}. Valide 10 min.`
    const params = new URLSearchParams({ username, to: phone, message, from: sender })

    try {
      const res = await fetch(baseUrl, {
        method: 'POST',
        headers: { Accept: 'application/json', apiKey: atApiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      })
      if (res.ok) {
        console.log(`[AT] OTP ${otp} → ${phone}`)
        return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } })
      }
      console.warn(`[AT] Échec ${res.status} — bascule sur Resend`)
    } catch (e) {
      console.warn('[AT] Erreur réseau — bascule sur Resend:', e)
    }
  }

  // ── 2. Resend email (fallback) ───────────────────────────────────────────
  if (resendKey) {
    const body = JSON.stringify({
      from: 'GreenFlame OTP <onboarding@resend.dev>',
      to: [adminEmail1, adminEmail2],
      subject: `[GreenFlame OTP] ${phone}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#fff;padding:24px;border-radius:12px;border:1px solid #e5e7eb">
          <h2 style="color:#16a34a;margin-top:0">🔥 Code OTP GreenFlame</h2>
          <p>Demande de connexion pour le numéro :</p>
          <p style="font-size:18px;font-weight:600;color:#111">${phone}</p>
          <div style="background:#f0fdf4;border:2px solid #16a34a;border-radius:8px;padding:20px;text-align:center;margin:16px 0">
            <p style="margin:0;font-size:36px;font-weight:bold;color:#16a34a;letter-spacing:8px;font-family:monospace">${otp}</p>
          </div>
          <p style="color:#6b7280;font-size:13px">Transmettez ce code à l'utilisateur. Valide <strong>10 minutes</strong>.</p>
        </div>
      `,
    })

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body,
      })
      if (res.ok) {
        console.log(`[Resend] OTP ${otp} pour ${phone} → admins`)
        return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } })
      }
      const errText = await res.text()
      console.error(`[Resend] Échec ${res.status}: ${errText}`)
    } catch (e) {
      console.error('[Resend] Erreur réseau:', e)
    }
  }

  // ── 3. Fallback console (dev local) ─────────────────────────────────────
  console.log(`[DEV] OTP pour ${phone} : ${otp}`)
  // Retourner succès quand même — l'OTP est généré côté Supabase Auth
  return new Response(JSON.stringify({}), { headers: { 'Content-Type': 'application/json' } })
})
