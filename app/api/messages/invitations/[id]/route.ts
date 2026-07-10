import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { acceptInvitation } from '@/lib/messaging/conversations'

/**
 * app/api/messages/invitations/[id]/route.ts
 *
 * Réponse à une invitation palier2. `refuser` est une simple UPDATE sous
 * RLS (policy conversation_invitations_update : to_user_id = auth.uid()).
 * `accepter` nécessite un client service_role car conversation_participants
 * n'a pas de policy INSERT pour authenticated (voir acceptInvitation).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null)
  const action = body?.action as 'accept' | 'refuse' | undefined
  if (action !== 'accept' && action !== 'refuse') {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  }

  if (action === 'refuse') {
    const { error } = await supabase
      .from('conversation_invitations')
      .update({ status: 'refusee', responded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('to_user_id', user.id)
      .eq('status', 'en_attente')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  const svc = createServiceClient()
  const result = await acceptInvitation(svc, id, user.id)
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
