import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return null
  const { data: profile } = await auth.from('users').select('role').eq('id', user.id).single()
  const ok = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  return ok ? user : null
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin()
  if (!admin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 })

  const { id } = await params
  const body = await req.json()
  const svc = createServiceClient()

  const allowed = ['commission_rate', 'is_active', 'is_verified', 'address_text', 'business_name', 'agent_service_active']
  const patch: Record<string, unknown> = {}

  for (const key of allowed) {
    if (key in body) {
      if (key === 'commission_rate') {
        const rate = parseFloat(body[key])
        if (isNaN(rate) || rate < 0 || rate > 0.5) {
          return NextResponse.json({ error: 'Taux invalide (0% - 50%)' }, { status: 400 })
        }
        patch[key] = rate
      } else {
        patch[key] = body[key]
      }
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Aucun champ valide' }, { status: 400 })
  }

  const { data, error } = await svc.from('merchants').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, merchant: data })
}
