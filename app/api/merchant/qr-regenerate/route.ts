import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import QRCode from 'qrcode'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  const { data: merchant } = await svc
    .from('merchants')
    .select('id, is_active')
    .eq('user_id', user.id)
    .single()

  if (!merchant?.is_active) {
    return NextResponse.json({ error: 'Boutique introuvable ou inactive' }, { status: 403 })
  }

  const qrData = `greenflame://pay?merchant_id=${merchant.id}&v=1`
  const qrDataUrl = await QRCode.toDataURL(qrData, {
    errorCorrectionLevel: 'M',
    width: 400,
    margin: 2,
    color: { dark: '#166534', light: '#FFFFFF' },
  })

  const qrBuffer = Buffer.from(qrDataUrl.split(',')[1], 'base64')
  const { data: uploadData } = await svc.storage
    .from('merchant-qrcodes')
    .upload(`${merchant.id}.png`, qrBuffer, { contentType: 'image/png', upsert: true })

  let qrCodeUrl = qrDataUrl
  if (uploadData) {
    const { data: urlData } = svc.storage
      .from('merchant-qrcodes')
      .getPublicUrl(`${merchant.id}.png`)
    qrCodeUrl = urlData.publicUrl
  }

  await svc
    .from('merchants')
    .update({ qr_code_url: qrCodeUrl })
    .eq('id', merchant.id)

  return NextResponse.json({ ok: true, qrCodeUrl })
}
