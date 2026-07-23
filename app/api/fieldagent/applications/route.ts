import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const isAgent = (me?.role ?? []).some((r: string) => ['field_agent', 'admin', 'platform_upline'].includes(r))
  if (!isAgent) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data, error } = await svc
    .from('merchant_applications')
    .select(`
      id, status, business_name, business_category,
      address_text, city, neighborhood,
      assigned_at, visit_done_at, created_at,
      applicant:users!merchant_applications_user_id_fkey(full_name, phone)
    `)
    .eq('assigned_agent_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
