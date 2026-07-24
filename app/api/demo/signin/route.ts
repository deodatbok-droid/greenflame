import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { DEMO_EMAIL, DEMO_PASSWORD, DEMO_PHONE } from '@/lib/demo/data'

async function ensureProfile(svc: ReturnType<typeof createServiceClient>, uid: string) {
  await svc.from('users').upsert({
    id:             uid,
    phone:          DEMO_PHONE,
    full_name:      'GreenFlame Demo',
    email:          DEMO_EMAIL,
    role:           'consumer',
    is_active:      true,
    referral_code:  'GF-DEMO2024',
  }, { onConflict: 'id' })
}

export async function POST() {
  const svc      = createServiceClient()
  const supabase = await createClient()

  // ── 1. Essai direct (email+password déjà configuré) ───────────────────────
  const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
    email:    DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })
  if (!signInErr && signInData.user) {
    // Garantir que le profil public existe (supprimé par reset)
    await ensureProfile(svc, signInData.user.id)
    return NextResponse.json({ ok: true })
  }

  // ── 2. Créer l'utilisateur email démo (sans téléphone, évite listUsers) ───
  const { data: created, error: createErr } = await svc.auth.admin.createUser({
    email:         DEMO_EMAIL,
    password:      DEMO_PASSWORD,
    email_confirm: true,
    app_metadata:  { is_demo: true },
    user_metadata: { full_name: 'GreenFlame Demo' },
  })

  if (createErr) {
    // Email déjà enregistré (mauvais mot de passe) → fallback magic link
    if (createErr.message.toLowerCase().includes('already')) {
      const { data: linkData } = await svc.auth.admin.generateLink({
        type:  'magiclink',
        email: DEMO_EMAIL,
      })
      const actionLink = (linkData as any)?.properties?.action_link ?? ''
      if (actionLink) {
        const token = new URL(actionLink).searchParams.get('token') ?? ''
        const { error: otpErr } = await supabase.auth.verifyOtp({
          email: DEMO_EMAIL,
          token,
          type:  'magiclink',
        })
        if (!otpErr) return NextResponse.json({ ok: true })
        return NextResponse.json({ error: 'magiclink: ' + otpErr.message }, { status: 401 })
      }
    }
    return NextResponse.json({ error: 'create: ' + createErr.message }, { status: 500 })
  }

  // ── 3. Connexion après création ────────────────────────────────────────────
  const { error: retryErr } = await supabase.auth.signInWithPassword({
    email:    DEMO_EMAIL,
    password: DEMO_PASSWORD,
  })
  if (retryErr) return NextResponse.json({ error: 'signin: ' + retryErr.message }, { status: 401 })

  if (created?.user?.id) {
    await ensureProfile(svc, created.user.id)
  }

  return NextResponse.json({ ok: true })
}
