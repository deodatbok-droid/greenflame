import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateTontineConversation } from '@/lib/messaging/conversations'

/**
 * app/api/messages/conversations/tontine/[tontineId]/route.ts
 *
 * Résout (ou crée) la conversation de groupe d'une tontine. Service client
 * nécessaire pour la même raison que pour order/[transactionId] : ajouter
 * tous les membres ayant un compte comme participants en une seule requête,
 * pas seulement l'appelant. getOrCreateTontineConversation vérifie déjà que
 * l'appelant est membre (ou créateur) de la tontine avant d'agir.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ tontineId: string }> }
) {
  const { tontineId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const result = await getOrCreateTontineConversation(svc, tontineId, user.id)

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
