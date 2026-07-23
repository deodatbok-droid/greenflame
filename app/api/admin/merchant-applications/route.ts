import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const isAdmin = (me?.role ?? []).some((r: string) => ['admin', 'platform_upline'].includes(r))
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data, error } = await svc
    .from('merchant_applications')
    .select(`
      id, status, business_name, business_category,
      address_text, city, neighborhood,
      ifu, rccm,
      assigned_at, visit_done_at, reviewed_at, rejection_reason,
      created_at, updated_at,
      user_id,
      assigned_agent_id,
      applicant:users!merchant_applications_user_id_fkey(full_name, phone, email),
      agent:users!merchant_applications_assigned_agent_id_fkey(full_name)
    `)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data ?? [])
}
