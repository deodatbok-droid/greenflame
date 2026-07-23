import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'
import { insertNotification } from '@/lib/utils/notify'

function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'GF-'
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)]
  return code
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data: me } = await svc.from('users').select('role, full_name').eq('id', user.id).single()
  const isAgent = (me?.role ?? []).some((r: string) => ['field_agent', 'admin', 'platform_upline'].includes(r))
  if (!isAgent) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const formData   = await req.formData()
  const fullName   = (formData.get('full_name') as string | null)?.trim() ?? ''
  const phone      = (formData.get('phone') as string | null)?.trim() ?? ''
  const frontDoc   = formData.get('front_doc') as File | null
  const backDoc    = formData.get('back_doc') as File | null
  const photoDoc   = formData.get('photo') as File | null

  if (!fullName || !phone) {
    return NextResponse.json({ error: 'Nom et téléphone obligatoires' }, { status: 400 })
  }
  if (!frontDoc || frontDoc.size === 0) {
    return NextResponse.json({ error: 'Photo CNI recto obligatoire' }, { status: 400 })
  }

  const phoneNorm = normalizePhone(phone)

  // Vérifier si le numéro existe déjà
  const { data: existingUser } = await svc
    .from('users')
    .select('id')
    .eq('phone', phoneNorm)
    .maybeSingle()

  if (existingUser) {
    return NextResponse.json({ error: 'Un compte existe déjà pour ce numéro de téléphone' }, { status: 409 })
  }

  // Créer le compte Auth (phone_confirm: true = bypass OTP)
  const { data: authData, error: authErr } = await svc.auth.admin.createUser({
    phone:         phoneNorm,
    phone_confirm: true,
    user_metadata: { full_name: fullName },
  })

  if (authErr || !authData.user) {
    return NextResponse.json({ error: authErr?.message ?? 'Erreur création compte' }, { status: 500 })
  }

  const newUserId = authData.user.id

  // Générer un code de parrainage unique
  let referralCode = generateReferralCode()
  for (let i = 0; i < 5; i++) {
    const { data: clash } = await svc.from('users').select('id').eq('referral_code', referralCode).maybeSingle()
    if (!clash) break
    referralCode = generateReferralCode()
  }

  // Créer le profil utilisateur
  const { error: profileErr } = await svc.from('users').upsert({
    id:            newUserId,
    phone:         phoneNorm,
    full_name:     fullName,
    role:          ['consumer'],
    is_active:     true,
    kyc_level:     1,
    referral_code: referralCode,
    enrolled_by_id: user.id,
  }, { onConflict: 'id' })

  if (profileErr) {
    // Rollback auth user
    await svc.auth.admin.deleteUser(newUserId)
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  // Upload CNI recto
  const frontExt  = frontDoc.name.split('.').pop() ?? 'jpg'
  const frontPath = `kyc/${newUserId}/front_${Date.now()}.${frontExt}`
  const frontBuf  = Buffer.from(await frontDoc.arrayBuffer())
  await svc.storage.from('kyc-documents').upload(frontPath, frontBuf, { contentType: frontDoc.type })

  // Upload CNI verso (optionnel)
  let backPath: string | null = null
  if (backDoc && backDoc.size > 0) {
    const backExt = backDoc.name.split('.').pop() ?? 'jpg'
    backPath = `kyc/${newUserId}/back_${Date.now()}.${backExt}`
    const backBuf = Buffer.from(await backDoc.arrayBuffer())
    await svc.storage.from('kyc-documents').upload(backPath, backBuf, { contentType: backDoc.type })
  }

  // Upload photo biométrique (optionnel)
  if (photoDoc && photoDoc.size > 0) {
    const photoExt = photoDoc.name.split('.').pop() ?? 'jpg'
    const photoPath = `kyc/${newUserId}/biometric_${Date.now()}.${photoExt}`
    const photoBuf  = Buffer.from(await photoDoc.arrayBuffer())
    await svc.storage.from('kyc-documents').upload(photoPath, photoBuf, { contentType: photoDoc.type })
  }

  const now = new Date().toISOString()

  // Créer la soumission KYC pré-approuvée (agent a vérifié en personne)
  await svc.from('kyc_submissions').upsert({
    user_id:       newUserId,
    document_type: 'cni',
    front_path:    frontPath,
    back_path:     backPath,
    status:        'approved',
    reviewed_by:   user.id,
    reviewed_at:   now,
    updated_at:    now,
    ai_notes:      `Vérifié en personne par l'agent terrain ${me?.full_name ?? user.id}`,
  }, { onConflict: 'user_id' })

  void insertNotification({
    userId:  newUserId,
    type:    'account_created',
    title:   'Bienvenue sur GreenFlame !',
    body:    `Votre compte a été créé par notre équipe terrain. Connectez-vous avec votre numéro ${phone} pour accéder à la plateforme.`,
  })

  return NextResponse.json({ ok: true, userId: newUserId, referralCode })
}
