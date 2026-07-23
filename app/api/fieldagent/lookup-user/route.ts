import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { normalizePhone } from '@/lib/utils/phone'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const isAgent = (me?.role ?? []).some((r: string) => ['field_agent', 'admin', 'platform_upline'].includes(r))
  if (!isAgent) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { phone } = await req.json() as { phone?: string }
  if (!phone?.trim()) return NextResponse.json({ error: 'Numéro requis' }, { status: 400 })

  const phoneNorm = normalizePhone(phone.trim())
  const { data: found } = await svc
    .from('users')
    .select('id, full_name, phone, kyc_level, role')
    .eq('phone', phoneNorm)
    .maybeSingle()

  if (!found) return NextResponse.json({ error: 'Aucun compte GreenFlame pour ce numéro' }, { status: 404 })
  return NextResponse.json(found)
}
