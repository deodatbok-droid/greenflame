import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateOrderConversation } from '@/lib/messaging/conversations'

/**
 * app/api/messages/conversations/order/[transactionId]/route.ts
 *
 * Point d'entrée du chat marchand↔client : résout (ou crée) la conversation
 * liée à une commande, pour l'acheteur ou le marchand. Pas de verrou KYC —
 * choix explicite confirmé (voir mémoire greenflame-messaging-chatbot-architecture).
 *
 * Utilise le service client uniquement parce que la création doit pouvoir
 * ajouter les DEUX parties comme participants (RLS empêcherait un client
 * authentifié d'insérer une ligne conversation_participants pour l'autre
 * partie) — getOrCreateOrderConversation vérifie elle-même que l'appelant
 * fait bien partie de la commande avant d'agir.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  const { transactionId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const svc = createServiceClient()
  const result = await getOrCreateOrderConversation(svc, transactionId, user.id)

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
