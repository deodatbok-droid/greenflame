import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const serviceClient = createServiceClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  // Verifier que l'utilisateur est admin ou kingmaker
  const { data: userProfile } = await serviceClient
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const canCreateMerchant =
    userProfile?.role?.includes('admin') ||
    userProfile?.role?.includes('kingmaker') ||
    userProfile?.role?.includes('platform_upline')

  if (!canCreateMerchant) {
    return NextResponse.json({ error: 'Permissions insuffisantes' }, { status: 403 })
  }

  const body = await req.json()
  const { userId, businessName, businessCategory, addressText, latitude, longitude } = body

  if (!userId || !businessName || !businessCategory) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }

  // Recuperer le taux de commission de la categorie
  const { data: category } = await serviceClient
    .from('merchant_categories')
    .select('commission_rate')
    .eq('code', businessCategory)
    .single()

  const commissionRate = category?.commission_rate ?? 0.10

  // Creer le marchand
  const { data: merchant, error: merchantErr } = await serviceClient
    .from('merchants')
    .insert({
      user_id: userId,
      business_name: businessName,
      business_category: businessCategory,
      commission_rate: commissionRate,
      address_text: addressText,
      latitude,
      longitude,
      onboarded_by: user.id,
    })
    .select()
    .single()

  if (merchantErr || !merchant) {
    return NextResponse.json({ error: merchantErr?.message ?? 'Erreur creation marchand' }, { status: 500 })
  }

  // Ajouter le role merchant a l'utilisateur
  const { data: targetUser } = await serviceClient
    .from('users')
    .select('role')
    .eq('id', userId)
    .single()

  if (targetUser && !targetUser.role.includes('merchant')) {
    await serviceClient
      .from('users')
      .update({ role: [...targetUser.role, 'merchant'] })
      .eq('id', userId)
  }

  // Generer le QR code
  const qrData = `greenflame://pay?merchant_id=${merchant.id}&v=1`
  const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
    errorCorrectionLevel: 'M',
    width: 400,
    margin: 2,
    color: { dark: '#166534', light: '#FFFFFF' },
  })

  // Stocker le QR code dans Supabase Storage
  const qrBuffer = Buffer.from(qrCodeDataUrl.split(',')[1], 'base64')
  const { data: uploadData } = await serviceClient.storage
    .from('merchant-qrcodes')
    .upload(`${merchant.id}.png`, qrBuffer, {
      contentType: 'image/png',
      upsert: true,
    })

  let qrCodeUrl = qrCodeDataUrl  // fallback: data URL
  if (uploadData) {
    const { data: urlData } = serviceClient.storage
      .from('merchant-qrcodes')
      .getPublicUrl(`${merchant.id}.png`)
    qrCodeUrl = urlData.publicUrl
  }

  await serviceClient
    .from('merchants')
    .update({ qr_code_url: qrCodeUrl })
    .eq('id', merchant.id)

  return NextResponse.json({
    merchant: { ...merchant, qr_code_url: qrCodeUrl },
    qrCode: qrCodeDataUrl,
  })
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const merchantId = searchParams.get('id')

  if (merchantId) {
    const { data, error } = await supabase
      .from('merchants')
      .select('*, users(full_name, phone)')
      .eq('id', merchantId)
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 404 })
    return NextResponse.json(data)
  }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })
  }

  const { data, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}
