import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function getAdminUser() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return null
  const { data: profile } = await auth.from('users').select('role').eq('id', user.id).single()
  const ok = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  return ok ? user : null
}

// GET /api/admin/flags/[key]/overrides — liste les overrides d'un flag
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { key } = await params
  const svc = createServiceClient()

  const { data, error } = await svc
    .from('feature_flag_overrides')
    .select('user_id, allowed, note, created_at, users:user_id(full_name, phone)')
    .eq('flag_key', key)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST /api/admin/flags/[key]/overrides — ajouter un override
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { key } = await params
  const body = await request.json() as { user_id: string; allowed: boolean; note?: string }
  const { user_id, allowed, note } = body
  if (!user_id) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('feature_flag_overrides')
    .upsert({ flag_key: key, user_id, allowed, note: note ?? null, created_by: user.id }, { onConflict: 'flag_key,user_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE /api/admin/flags/[key]/overrides?user_id=xxx — supprimer un override
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { key } = await params
  const userId = request.nextUrl.searchParams.get('user_id')
  if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 })

  const svc = createServiceClient()
  const { error } = await svc
    .from('feature_flag_overrides')
    .delete()
    .eq('flag_key', key)
    .eq('user_id', userId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
