import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data: me } = await svc.from('users').select('role').eq('id', user.id).single()
  const canView = (me?.role ?? []).some((r: string) => ['field_agent', 'admin', 'platform_upline'].includes(r))
  if (!canView) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data, error } = await svc
    .from('kyc_submissions')
    .select(`
      id, status, document_type, front_path, back_path,
      created_at, updated_at,
      ai_pre_decision, ai_confidence, ai_extracted_name,
      owner:users!kyc_submissions_user_id_fkey(id, full_name, phone, kyc_level)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
