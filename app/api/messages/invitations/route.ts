import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

/**
 * app/api/messages/invitations/route.ts
 *
 * Palier 2 — invitations à discuter entre deux utilisateurs de la
 * plateforme (achat ET KYC requis côté expéditeur).
 *
 * POST : créer une invitation. Utilise le client lié à RLS (pas
 * service_role) — la policy `conversation_invitations_insert` (migration
 * 057) encode déjà entièrement le verrou achat+KYC, donc aucune logique de
 * gate à dupliquer ici : si l'insert RLS échoue, c'est que le verrou n'est
 * pas satisfait.
 *
 * GET : lister mes invitations (envoyées + reçues), enrichies du nom de
 * l'autre partie (nécessite service_role : RLS sur `users` ne permet pas de
 * lire le profil d'un tiers).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const toUserId = body?.toUserId as string | undefined
  if (!toUserId) return NextResponse.json({ error: 'toUserId requis' }, { status: 400 })
  if (toUserId === user.id) return NextResponse.json({ error: 'Invitation invalide' }, { status: 400 })

  const { data, error } = await supabase
    .from('conversation_invitations')
    .insert({ from_user_id: user.id, to_user_id: toUserId })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Invitation déjà en attente pour ce membre' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Achat et vérification KYC requis pour inviter' }, { status: 403 })
  }

  return NextResponse.json({ id: data.id })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: rows, error } = await supabase
    .from('conversation_invitations')
    .select('id, from_user_id, to_user_id, status, conversation_id, created_at, responded_at')
    .or(`from_user_id.eq.${user.id},to_user_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const otherIds = Array.from(
    new Set((rows ?? []).map(r => (r.from_user_id === user.id ? r.to_user_id : r.from_user_id))),
  )

  let names: Record<string, { full_name: string; avatar_url: string | null }> = {}
  if (otherIds.length > 0) {
    const svc = createServiceClient()
    const { data: users } = await svc.from('users').select('id, full_name, avatar_url').in('id', otherIds)
    names = Object.fromEntries((users ?? []).map(u => [u.id, { full_name: u.full_name, avatar_url: u.avatar_url }]))
  }

  const invitations = (rows ?? []).map(r => {
    const direction = r.from_user_id === user.id ? 'envoyee' : 'recue'
    const otherId = direction === 'envoyee' ? r.to_user_id : r.from_user_id
    return {
      id: r.id,
      direction,
      status: r.status,
      conversationId: r.conversation_id,
      createdAt: r.created_at,
      otherUser: { id: otherId, ...(names[otherId] ?? { full_name: '—', avatar_url: null }) },
    }
  })

  return NextResponse.json({ invitations })
}
