import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { randomBytes } from 'crypto'

function generateCode(): string {
  return randomBytes(4).toString('hex').toUpperCase()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { first_name, last_name, email, whatsapp, role, referred_by_code } = body

    if (!first_name?.trim() || !last_name?.trim() || !whatsapp?.trim() || !role) {
      return NextResponse.json({ error: 'Champs requis manquants.' }, { status: 400 })
    }

    const supabase = createServiceClient()

    let referred_by_id: string | null = null
    if (referred_by_code) {
      const { data: referrer } = await supabase
        .from('waitlist_entries')
        .select('id')
        .eq('referral_code', referred_by_code.trim().toUpperCase())
        .single()
      referred_by_id = referrer?.id ?? null
    }

    let referral_code = generateCode()
    for (let attempts = 0; attempts < 5; attempts++) {
      const { data: existing } = await supabase
        .from('waitlist_entries')
        .select('id')
        .eq('referral_code', referral_code)
        .single()
      if (!existing) break
      referral_code = generateCode()
    }

    const { data, error } = await supabase
      .from('waitlist_entries')
      .insert({
        first_name:    first_name.trim(),
        last_name:     last_name.trim(),
        email:         email?.trim() || null,
        whatsapp:      whatsapp.trim(),
        role,
        referral_code,
        referred_by_id,
      })
      .select('id, referral_code, first_name')
      .single()

    if (error) {
      console.error('Waitlist insert error:', error)
      return NextResponse.json({ error: "Erreur lors de l'inscription." }, { status: 500 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenflameafrica.com'
    const referral_url = `${appUrl}/pre-inscription?ref=${data.referral_code}`

    return NextResponse.json({
      success: true,
      referral_code: data.referral_code,
      referral_url,
      first_name: data.first_name,
    })
  } catch (err) {
    console.error('Waitlist error:', err)
    return NextResponse.json({ error: 'Erreur serveur.' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('ref')
  const supabase = createServiceClient()

  const [countRes, referrerRes] = await Promise.all([
    supabase.from('waitlist_entries').select('*', { count: 'exact', head: true }),
    code
      ? supabase
          .from('waitlist_entries')
          .select('first_name, last_name')
          .eq('referral_code', code.toUpperCase())
          .single()
      : Promise.resolve({ data: null }),
  ])

  return NextResponse.json({
    total: countRes.count ?? 0,
    referrer: referrerRes.data
      ? `${referrerRes.data.first_name} ${referrerRes.data.last_name}`
      : null,
  })
}
