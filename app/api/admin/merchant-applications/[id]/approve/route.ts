import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'
import { insertNotification } from '@/lib/utils/notify'

function toSlug(text: string): string {
  return (
    text.toLowerCase().normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    || 'boutique'
  ) + '-' + Date.now().toString(36)
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const isAdmin = (me?.role ?? []).some((r: string) => ['admin', 'platform_upline'].includes(r))
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data: app, error: appErr } = await svc
    .from('merchant_applications')
    .select('*')
    .eq('id', id)
    .single()

  if (appErr || !app) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  if (app.status === 'approved') return NextResponse.json({ error: 'Déjà approuvé' }, { status: 400 })

  const now = new Date().toISOString()

  // Vérifier qu'il n'est pas déjà marchand
  const { data: existingMerchant } = await svc
    .from('merchants')
    .select('id')
    .eq('user_id', app.user_id)
    .maybeSingle()

  let merchantId: string

  if (existingMerchant) {
    merchantId = existingMerchant.id
    // Réactiver si inactif
    await svc.from('merchants').update({ is_active: true }).eq('id', merchantId)
  } else {
    const { data: category } = await svc
      .from('merchant_categories')
      .select('commission_rate')
      .eq('code', app.business_category)
      .single()

    const { data: merchant, error: mErr } = await svc
      .from('merchants')
      .insert({
        user_id:           app.user_id,
        business_name:     app.business_name,
        business_category: app.business_category,
        commission_rate:   category?.commission_rate ?? 0.10,
        address_text:      app.address_text,
        city:              app.city,
        neighborhood:      app.neighborhood,
        location:          app.location,
        is_active:         true,
        onboarded_by:      user.id,
        public_slug:       toSlug(app.business_name),
      })
      .select('id')
      .single()

    if (mErr || !merchant) {
      return NextResponse.json({ error: mErr?.message ?? 'Erreur création boutique' }, { status: 500 })
    }
    merchantId = merchant.id

    // QR code
    const qrData    = `greenflame://pay?merchant_id=${merchantId}&v=1`
    const qrDataUrl = await QRCode.toDataURL(qrData, { errorCorrectionLevel: 'M', width: 400, margin: 2 })
    const qrBuffer  = Buffer.from(qrDataUrl.split(',')[1], 'base64')
    const { data: uploadData } = await svc.storage
      .from('merchant-qrcodes')
      .upload(`${merchantId}.png`, qrBuffer, { contentType: 'image/png', upsert: true })
    if (uploadData) {
      const { data: urlData } = svc.storage.from('merchant-qrcodes').getPublicUrl(`${merchantId}.png`)
      await svc.from('merchants').update({ qr_code_url: urlData.publicUrl }).eq('id', merchantId)
    }
  }

  // Ajouter le rôle merchant à l'utilisateur
  const { data: userProfile } = await svc.from('users').select('role').eq('id', app.user_id).single()
  if (userProfile && !userProfile.role.includes('merchant')) {
    await svc.from('users').update({ role: [...userProfile.role, 'merchant'] }).eq('id', app.user_id)
  }

  // Marquer le KYC comme approuvé si les docs sont dans la demande
  if (app.kyc_front_path && app.kyc_back_path) {
    await svc.from('kyc_submissions').upsert({
      user_id:       app.user_id,
      document_type: 'cni',
      front_path:    app.kyc_front_path,
      back_path:     app.kyc_back_path,
      status:        'approved',
      reviewed_by:   user.id,
      reviewed_at:   now,
      updated_at:    now,
    }, { onConflict: 'user_id' })

    await svc.from('users').update({ kyc_level: 1 }).eq('id', app.user_id)
  }

  // Mettre à jour la localisation du marchand si disponible
  if (app.location) {
    await svc.from('merchants').update({ location: app.location, city: app.city, neighborhood: app.neighborhood }).eq('id', merchantId)
  }

  // Mettre à jour la demande
  await svc.from('merchant_applications').update({
    status:      'approved',
    reviewed_by: user.id,
    reviewed_at: now,
  }).eq('id', id)

  // Notifier le demandeur
  void insertNotification({
    userId:      app.user_id,
    type:        'merchant_approved',
    title:       '🎉 Votre boutique est activée !',
    body:        `Félicitations ! Votre boutique "${app.business_name}" a été validée par l'équipe GreenFlame. Vous pouvez maintenant commencer à vendre.`,
    referenceId: merchantId,
  })

  return NextResponse.json({ ok: true, merchantId })
}
