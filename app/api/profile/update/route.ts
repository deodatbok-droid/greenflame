import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { full_name } = body as { full_name?: string }

  if (!full_name?.trim()) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
  if (full_name.trim().length < 2) return NextResponse.json({ error: 'Nom trop court' }, { status: 400 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('users')
    .update({ full_name: full_name.trim() })
    .eq('id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
