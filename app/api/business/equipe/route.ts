import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: myMember } = await auth
    .from('biz_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!myMember) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  if (myMember.role === 'staff') return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 })

  const svc = createServiceClient()
  const { data, error } = await svc
    .from('biz_members')
    .select('id, user_id, role, invited_at, users(full_name, phone)')
    .eq('business_id', myMember.business_id)
    .order('invited_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const members = (data ?? []).map(m => ({
    id:         m.id,
    user_id:    m.user_id,
    role:       m.role,
    created_at: m.invited_at,
    profiles:   m.users ? { full_name: (m.users as { full_name: string }).full_name, phone: (m.users as { phone: string }).phone } : null,
  }))

  return NextResponse.json({ members })
}

export async function POST(req: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: myMember } = await auth
    .from('biz_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!myMember) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  if (myMember.role !== 'owner') return NextResponse.json({ error: 'Seul le propriétaire peut gérer l\'équipe' }, { status: 403 })

  const { phone, role } = await req.json()
  if (!phone) return NextResponse.json({ error: 'Numéro requis' }, { status: 400 })
  if (!['manager', 'staff'].includes(role)) return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })

  const svc = createServiceClient()

  // Chercher l'utilisateur par téléphone
  const cleanPhone = phone.trim().replace(/\s+/g, '')
  const { data: targetUser } = await svc
    .from('users')
    .select('id')
    .eq('phone', cleanPhone)
    .maybeSingle()

  if (!targetUser) return NextResponse.json({ error: 'Aucun compte GreenFlame trouvé pour ce numéro' }, { status: 404 })

  // Vérifier si déjà membre
  const { data: existing } = await svc
    .from('biz_members')
    .select('id')
    .eq('business_id', myMember.business_id)
    .eq('user_id', targetUser.id)
    .maybeSingle()

  if (existing) return NextResponse.json({ error: 'Cet utilisateur est déjà membre de votre équipe' }, { status: 409 })

  const { error } = await svc
    .from('biz_members')
    .insert({ business_id: myMember.business_id, user_id: targetUser.id, role })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const auth = await createClient()
  const { data: { user } } = await auth.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: myMember } = await auth
    .from('biz_members')
    .select('business_id, role')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!myMember || myMember.role !== 'owner') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const memberId = new URL(req.url).searchParams.get('member_id')
  if (!memberId) return NextResponse.json({ error: 'member_id requis' }, { status: 400 })

  const svc = createServiceClient()

  // Vérifier qu'on ne supprime pas le propriétaire
  const { data: target } = await svc
    .from('biz_members')
    .select('role')
    .eq('id', memberId)
    .eq('business_id', myMember.business_id)
    .maybeSingle()

  if (!target) return NextResponse.json({ error: 'Membre introuvable' }, { status: 404 })
  if (target.role === 'owner') return NextResponse.json({ error: 'Impossible de retirer le propriétaire' }, { status: 400 })

  await svc.from('biz_members').delete().eq('id', memberId).eq('business_id', myMember.business_id)
  return NextResponse.json({ success: true })
}
