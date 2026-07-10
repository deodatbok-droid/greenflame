import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyPin } from '@/lib/utils/pin'
import { cookies } from 'next/headers'

/** Vérifier si le PIN admin est déjà défini ET si le cookie de session est encore valide */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ hasPin: false, alreadyVerified: false })

  const { data: profile } = await supabase
    .from('users')
    .select('role, admin_pin')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  if (!isAdmin) return NextResponse.json({ hasPin: false, alreadyVerified: false })

  const cookieStore = await cookies()
  const adminCookie = cookieStore.get('gf_admin_verified')
  const alreadyVerified = adminCookie?.value?.startsWith(user.id) ?? false

  return NextResponse.json({
    hasPin: !!profile?.admin_pin,
    alreadyVerified,
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role, admin_pin')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  // PIN pas encore défini → demander à le définir
  if (!profile?.admin_pin) {
    return NextResponse.json({ error: 'PIN non défini', needsSetup: true }, { status: 400 })
  }

  const { pin } = await req.json()
  if (!pin) return NextResponse.json({ error: 'PIN requis' }, { status: 400 })

  const valid = profile.admin_pin.includes(':')
    ? verifyPin(pin, profile.admin_pin)
    : profile.admin_pin === pin

  if (!valid) return NextResponse.json({ error: 'PIN incorrect' }, { status: 401 })

  // Créer un cookie de session admin (valide 4h)
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
