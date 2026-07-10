import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  if (!code) return NextResponse.json({ valid: false })

  const service = createServiceClient()
  const trimmed = code.trim()

  // Si ça ressemble à un numéro de téléphone (≥8 chiffres), lookup par phone
  const digitsOnly = trimmed.replace(/[\s\-().+]/g, '')
  if (/^\d{8,}$/.test(digitsOnly)) {
    const normalized = normalizePhone(digitsOnly)
    const { data } = await service
      .from('users')
      .select('id, full_name')
      .eq('phone', normalized)
      .maybeSingle()
    if (!data) return NextResponse.json({ valid: false })
    return NextResponse.json({ valid: true, name: data.full_name, id: data.id })
  }

  // Lookup par code alphanumérique
  const { data } = await service
    .from('users')
    .select('id, full_name')
    .eq('referral_code', trimmed.toUpperCase())
    .maybeSingle()

  if (!data) return NextResponse.json({ valid: false })
  return NextResponse.json({ valid: true, name: data.full_name, id: data.id })
}
