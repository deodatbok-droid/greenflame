import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()

  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const isAdmin = (me?.role ?? []).some((r: string) => ['admin', 'platform_upline', 'field_agent'].includes(r))
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data, error } = await svc
    .from('merchant_applications')
    .select(`
      id, status, business_name, business_category,
      address_text, city, neighborhood,
      ifu, rccm,
      kyc_front_path, kyc_back_path, ifu_doc_path, rccm_doc_path,
      location_confirmed, visit_notes, visit_photo_path,
      assigned_at, visit_done_at, reviewed_at, rejection_reason,
      created_at,
      user_id, assigned_agent_id,
      applicant:users!merchant_applications_user_id_fkey(full_name, phone, email),
      agent:users!merchant_applications_assigned_agent_id_fkey(full_name)
    `)
    .eq('id', id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Introuvable' }, { status: 404 })
  return NextResponse.json(data)
}
