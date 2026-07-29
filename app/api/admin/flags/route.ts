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
    .from('feature_flags')
    .select('*')
    .order('category')
    .order('label')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { key: string; label: string; description?: string; category: string; enabled?: boolean }
  const { key, label, description, category, enabled = false } = body
  if (!key || !label || !category) return NextResponse.json({ error: 'Missing key, label or category' }, { status: 400 })

  const safeKey = key.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/__+/g, '_')

  const svc = createServiceClient()
  const { error } = await svc.from('feature_flags').insert({
    key: safeKey, label, description: description ?? null, category, enabled,
    updated_by: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await svc.from('platform_settings_audit').insert({
    table_name: 'feature_flags', key: safeKey,
    old_value: null, new_value: { label, category, enabled },
    changed_by: user.id,
  })

  return NextResponse.json({ ok: true, key: safeKey })
}

export async function PATCH(request: NextRequest) {
  const user = await getAdminUser()
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json() as { key: string; enabled?: boolean; mode?: string }
  const { key, enabled, mode } = body
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  const svc = createServiceClient()

  // Lire l'ancienne valeur pour l'audit
  const { data: old } = await svc
    .from('feature_flags')
    .select('enabled, mode')
    .eq('key', key)
    .maybeSingle()

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString(), updated_by: user.id }
  if (enabled !== undefined) updates.enabled = enabled
  if (mode    !== undefined) updates.mode    = mode

  const { error } = await svc
    .from('feature_flags')
    .update(updates)
    .eq('key', key)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Audit
  await svc.from('platform_settings_audit').insert({
    table_name: 'feature_flags',
    key,
    old_value: old ? { enabled: old.enabled, mode: old.mode } : null,
    new_value: { enabled: updates.enabled ?? old?.enabled, mode: updates.mode ?? old?.mode },
    changed_by: user.id,
  })

  return NextResponse.json({ ok: true })
}
