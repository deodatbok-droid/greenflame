import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: member } = await auth
    .from('biz_members')
    .select('business_id, role, biz_accounts(*)')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  return NextResponse.json({ account: (member as unknown as { biz_accounts: unknown }).biz_accounts })
}

export async function PATCH(req: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: member } = await auth
    .from('biz_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!member) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  if (member.role !== 'owner') return NextResponse.json({ error: 'Seul le propriétaire peut modifier les paramètres' }, { status: 403 })

  const body = await req.json()
  const allowed = ['name', 'country', 'currency', 'address', 'tax_id', 'default_tax_rate', 'invoice_prefix', 'invoice_notes']
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) patch[key] = body[key]
  }
  if (!patch.name) return NextResponse.json({ error: 'Nom requis' }, { status: 400 })

  patch.updated_at = new Date().toISOString()

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('biz_accounts')
    .update(patch)
    .eq('id', member.business_id)
    .select('id, name, slug, country, currency, plan, status, address, tax_id, default_tax_rate, invoice_prefix, invoice_notes')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ account: data })
}
