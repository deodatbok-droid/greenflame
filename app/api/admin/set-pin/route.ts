import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { hashPin } from '@/lib/utils/pin'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { pin } = await req.json()
  if (!pin || pin.length < 4) return NextResponse.json({ error: 'PIN trop court' }, { status: 400 })
  if (!/^\d+$/.test(pin)) return NextResponse.json({ error: 'PIN numérique uniquement' }, { status: 400 })

  const hashed = hashPin(pin)

  const svc = createServiceClient()
  const { error } = await svc
    .from('users')
    .update({ admin_pin: hashed })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // PIN défini → poser le cookie de session admin immédiatement (4h)
  const cookieStore = await cookies()
  cookieStore.set('gf_admin_verified', `${user.id}:${Date.now()}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 4 * 60 * 60,
    path: '/admin',
  })

  return NextResponse.json({ ok: true })
}
