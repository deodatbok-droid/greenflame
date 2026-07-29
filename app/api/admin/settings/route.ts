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

export async function GET() {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('platform_settings')
    .select('*')
    .order('category')
    .order('key')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function PATCH(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { key: string; value: unknown }
  const { key, value } = body
  if (!key || value === undefined) return NextResponse.json({ error: 'Missing key or value' }, { status: 400 })

  const svc = createServiceClient()

  // Lire l'ancienne valeur pour l'audit
  const { data: old } = await svc
    .from('platform_settings')
    .select('value, editable')
    .eq('key', key)
    .maybeSingle()

  if (old && !old.editable) {
    return NextResponse.json({ error: 'This setting is protected and cannot be modified' }, { status: 403 })
  }

  const { error } = await svc
    .from('platform_settings')
    .update({ value, updated_at: new Date().toISOString(), updated_by: user.id })
    .eq('key', key)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit
  await svc.from('platform_settings_audit').insert({
    table_name: 'platform_settings',
    key,
    old_value: old?.value ?? null,
    new_value: value,
    changed_by: user.id,
  })

  return NextResponse.json({ ok: true })
}
