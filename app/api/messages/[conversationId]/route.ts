import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * app/api/messages/[conversationId]/route.ts
 *
 * Lecture/écriture des messages d'une conversation. Utilise toujours le
 * client RLS de l'utilisateur connecté (jamais le service client) : la
 * fonction public.is_conversation_member() (migration 057) fait tout le
 * travail d'autorisation — pas de vérification d'appartenance dupliquée ici.
 */

const PAGE_SIZE = 50

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const before = req.nextUrl.searchParams.get('before') // pagination — created_at ISO du plus ancien message déjà chargé

  let query = supabase
    .from('messages')
    .select('id, conversation_id, sender_id, message_type, content, created_at, sender:sender_id(full_name)')
    .eq('conversation_id', conversationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE)

  if (before) query = query.lt('created_at', before)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Marquer comme lu — non bloquant, best-effort.
  await supabase
    .from('conversation_participants')
    .update({ last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)

  return NextResponse.json({ messages: (data ?? []).reverse() })
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> }
) {
  const { conversationId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null) as { content?: string } | null
  const content = body?.content?.trim()
  if (!content) return NextResponse.json({ error: 'Message vide' }, { status: 400 })
  if (content.length > 4000) return NextResponse.json({ error: 'Message trop long' }, { status: 400 })

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: user.id, content })
    .select('id, conversation_id, sender_id, content, created_at')
    .single()

  // RLS rejette silencieusement (aucune ligne insérée, pas d'exception) si
  // l'utilisateur n'est pas membre — error est alors typiquement null mais
  // data aussi : on traite l'absence de data comme un refus d'accès.
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  if (!data) return NextResponse.json({ error: 'Accès refusé à cette conversation' }, { status: 403 })

  return NextResponse.json({ message: data })
}
