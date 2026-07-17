/**
 * GET /api/admin/users-list
 * Retourne la liste simplifiée de tous les membres (id, full_name, phone).
 * Réservé aux admins — utilisé par le formulaire d'émission UCP et autres outils admin.
 */
import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const { data: profile } = await svc.from('users').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role?.includes('admin') || profile?.role?.includes('platform_upline')
  if (!isAdmin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data, error } = await svc
    .from('users')
    .select('id, full_name, phone, ucp_unlocked')
    .order('full_name')
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data ?? [] })
}
