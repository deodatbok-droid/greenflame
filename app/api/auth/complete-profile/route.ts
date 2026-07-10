import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { sendWelcomeEmail } from '@/lib/email'
import { hashPin } from '@/lib/utils/pin'
import { sendWhatsApp, ADMIN_PHONE, waAdminInscription, waWelcomeUser, waNewFilleul } from '@/lib/whatsapp/wasender'
import { normalizePhone } from '@/lib/utils/phone'
import { resolveSpilloverPlacement } from '@/lib/network/spillover'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const { fullName, phone, email, referralCode, newReferralCode, pin } = await req.json()
  if (!fullName?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
  if (!pin || !/^\d{6}$/.test(pin)) return NextResponse.json({ error: 'Code PIN invalide (6 chiffres requis)' }, { status: 400 })

  const service = createServiceClient()

  // Resoudre le code parrainage cote serveur (bypass RLS)
  // Accepte : code alphanumérique OU numéro de téléphone du parrain
  let enrollerId: string | null = null   // qui a physiquement recruté
  let uplineId:   string | null = null   // placement effectif dans l'arbre (peut différer)
  let uplineName: string | null = null
  let uplineRef:  string | null = null
  let spilloverQueued = false

  if (referralCode?.trim()) {
    const trimmedRef = referralCode.trim()
    const digitsOnly = trimmedRef.replace(/[\s\-().+]/g, '')
    const isPhoneLike = /^\d{8,}$/.test(digitsOnly)

    const query = isPhoneLike
      ? service.from('users').select('id, full_name, referral_code').eq('phone', normalizePhone(digitsOnly)).maybeSingle()
      : service.from('users').select('id, full_name, referral_code').eq('referral_code', trimmedRef.toUpperCase()).maybeSingle()

    const { data: uplineUser } = await query
    if (!uplineUser) {
      return NextResponse.json({
        error: isPhoneLike
          ? `Aucun compte GreenFlame trouvé pour le numéro ${trimmedRef}`
          : `Code d'invitation "${trimmedRef}" invalide`,
      }, { status: 400 })
    }
    enrollerId = uplineUser.id
    uplineName = uplineUser.full_name
    uplineRef  = uplineUser.referral_code
  }

  // ── Forced Matrix : créer d'abord l'utilisateur sans upline_id ──────────
  // Le placement BFS nécessite que l'utilisateur existe pour mettre à jour upline_id
  const { error: profileErr } = await service.from('users').insert({
    id: user.id,
    phone,
    full_name: fullName.trim(),
    email: email?.trim() || null,
    role: ['consumer'],
    upline_id: null,           // sera résolu juste après par BFS
    enrolled_by_id: enrollerId,
    referral_code: newReferralCode,
    transaction_pin: hashPin(pin),
  })

  if (profileErr) {
    if (profileErr.code === '23505') return NextResponse.json({ alreadyExists: true })
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  // ── Forced Matrix : résolution BFS du placement ──────────────────────────
  if (enrollerId) {
    const placement = await resolveSpilloverPlacement(enrollerId, user.id, service)
    uplineId = placement.placement_upline_id
    spilloverQueued = placement.queued

    // Mettre à jour upline_id (déclenche le trigger network_tree automatiquement)
    await service
      .from('users')
      .update({ upline_id: uplineId })
      .eq('id', user.id)
  }

  const { error: walletErr } = await service.from('wallets').insert({ user_id: user.id })
  if (walletErr && walletErr.code !== '23505') {
    return NextResponse.json({ error: walletErr.message }, { status: 500 })
  }

  // Email de bienvenue : vers l'utilisateur si email fourni, sinon notification admin
  sendWelcomeEmail(fullName.trim(), newReferralCode, phone, email?.trim() || null).catch(() => {})

  // Alerte WhatsApp admin (non-bloquant)
  sendWhatsApp(ADMIN_PHONE, waAdminInscription({
    name:       fullName.trim(),
    phone:      phone ?? '',
    refCode:    newReferralCode,
    uplineName,
    uplineRef,
  })).catch(() => {})

  // Message de bienvenue au nouvel utilisateur (non-bloquant)
  if (phone) {
    const firstName = fullName.trim().split(' ')[0]
    sendWhatsApp(phone, waWelcomeUser({
      firstName,
      referralCode: newReferralCode,
    })).catch(() => {})
  }

  // Notifications "nouveau filleul" — enrolleur + nœud de placement si spillover
  const firstName = fullName.trim().split(' ')[0]
  const notifyIds = new Set<string>()
  if (enrollerId) notifyIds.add(enrollerId)
  if (uplineId && uplineId !== enrollerId) notifyIds.add(uplineId)

  for (const notifyId of notifyIds) {
    ;(async () => {
      try {
        const { data: notifyUser } = await service
          .from('users')
          .select('phone, referral_code')
          .eq('id', notifyId)
          .single()
        if (notifyUser?.phone) {
          sendWhatsApp(notifyUser.phone, waNewFilleul({
            filleulFirstName: firstName,
            uplineCode:       notifyUser.referral_code ?? '',
          }))
        }
      } catch { /* non-bloquant */ }
    })()
  }

  return NextResponse.json({
    ok: true,
    userId: user.id,
    spilloverQueued,
    placedUnder: uplineId,
  })
}
