import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

const VALID_ROLES = ['consumer', 'admin', 'platform_upline', 'kingmaker', 'merchant', 'field_agent']

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 })

  // Seul un admin peut promouvoir
  const { data: caller } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (!caller?.role?.includes('admin')) {
    return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })
  }

  const { targetUserId, roles, email } = await req.json()
  if (!targetUserId || !Array.isArray(roles) || !roles.every((r: string) => VALID_ROLES.includes(r))) {
    return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 })
  }

  const service = createServiceClient()
  const update: Record<string, unknown> = { role: roles }
  if (email?.trim()) update.email = email.trim()

  const { error } = await service.from('users').update(update).eq('id', targetUserId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
