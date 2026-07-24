import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'

function toSlug(text: string): string {
  return (
    text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    || 'boutique'
  ) + '-' + Date.now().toString(36)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  const service = createServiceClient()

  // Si le marchand existe déjà (ex: seedé en mode démo), retourner succès directement
  const { data: existing } = await service.from('merchants').select('id').eq('user_id', user.id).maybeSingle()
  if (existing) return NextResponse.json({ ok: true, merchantId: existing.id })

  const { businessName, businessCategory, addressText } = await req.json()
  if (!businessName?.trim() || !businessCategory) {
    return NextResponse.json({ error: 'Nom et categorie requis' }, { status: 400 })
  }

  const { data: category } = await service
    .from('merchant_categories')
    .select('commission_rate')
    .eq('code', businessCategory)
    .single()

  const commissionRate = category?.commission_rate ?? 0.10

  const { data: merchant, error: merchantErr } = await service
    .from('merchants')
    .insert({
      user_id:           user.id,
      business_name:     businessName.trim(),
      business_category: businessCategory,
      commission_rate:   commissionRate,
      address_text:      addressText?.trim() || null,
      onboarded_by:      user.id,
      public_slug:       toSlug(businessName.trim()),
    })
    .select()
    .single()

  if (merchantErr || !merchant) {
    return NextResponse.json({ error: merchantErr?.message ?? 'Erreur creation boutique' }, { status: 500 })
  }

  // Ajouter le role merchant
  const { data: userProfile } = await service.from('users').select('role').eq('id', user.id).single()
  if (userProfile && !userProfile.role.includes('merchant')) {
    await service.from('users').update({ role: [...userProfile.role, 'merchant'] }).eq('id', user.id)
  }

  // Generer et stocker le QR code
  const qrData = `greenflame://pay?merchant_id=${merchant.id}&v=1`
  const qrDataUrl = await QRCode.toDataURL(qrData, {
    errorCorrectionLevel: 'M', width: 400, margin: 2,
    color: { dark: '#166534', light: '#FFFFFF' },
  })

  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64')
  const { data: uploadData } = await service.storage
    .from('merchant-qrcodes')
    .upload(`${merchant.id}.png`, qrBuffer, { contentType: 'image/png', upsert: true })

  let qrCodeUrl = qrDataUrl
  if (uploadData) {
    const { data: urlData } = service.storage.from('merchant-qrcodes').getPublicUrl(`${merchant.id}.png`)
    qrCodeUrl = urlData.publicUrl
  }

  await service.from('merchants').update({ qr_code_url: qrCodeUrl }).eq('id', merchant.id)

  return NextResponse.json({ ok: true, merchantId: merchant.id, qrCode: qrDataUrl })
}
