import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/server'
import { getChatReply, MAX_HISTORY, type ChatMessage } from '@/lib/chat/core'
import { sendWhatsApp } from '@/lib/whatsapp/wasender'
import { normalizePhone } from '@/lib/utils/phone'

/**
 * app/api/chat/whatsapp/route.ts
 *
 * Webhook entrant Wasender (https://wasenderapi.com) — PAS n8n, PAS l'API
 * Meta Cloud directe. Investigation du 18 juin 2026 : la seule intégration
 * WhatsApp réellement en place dans ce code est lib/whatsapp/wasender.ts
 * (sortant uniquement, pour les notifications transactionnelles). Le seul
 * workflow n8n existant (tâche #23-26) gère les rappels d'expiration
 * d'abonnement, pas le chat — il n'y avait aucun pipeline entrant avant cette
 * route. Voir greenflame-messaging-chatbot-architecture.md (mémoire corrigée).
 *
 * Config requise côté dashboard Wasender (Session settings → Webhook) :
 *   - Webhook URL    : https://greenflame.app/api/chat/whatsapp
 *   - Webhook Secret : même valeur que WASENDER_WEBHOOK_SECRET ci-dessous
 *   - Événements     : messages.received uniquement (suffisant pour ce bot)
 *
 * Sécurité : Wasender envoie le secret brut dans l'en-tête
 * X-Webhook-Signature (ce n'est pas un HMAC malgré le nom — confirmé dans
 * leur propre doc/exemple). On fait une comparaison en temps constant.
 * Contrairement à app/api/auth/sms-relay/route.ts (qui fail-open pour ne
 * jamais bloquer un OTP critique), on fail-close ici : ce n'est pas un
 * chemin critique de connexion, et laisser passer un webhook non authentifié
 * permettrait à n'importe qui de faire "parler" le bot au nom d'un numéro
 * arbitraire dans nos logs.
 *
 * Garde-fou non négociable identique à la surface in-app (lib/chat/core.ts) :
 * lecture seule, jamais d'action irréversible déclenchée depuis ce webhook.
 */

type WasenderWebhookPayload = {
  event?: string
  data?: {
    messages?: {
      key?: {
        id?: string
        fromMe?: boolean
        remoteJid?: string
        cleanedSenderPn?: string
        senderPn?: string
      }
      messageBody?: string
      message?: { conversation?: string }
    }
  }
}

function verifySignature(req: NextRequest): boolean {
  const secret = process.env.WASENDER_WEBHOOK_SECRET?.trim()
  if (!secret) {
    console.error('[chat/whatsapp] WASENDER_WEBHOOK_SECRET manquant — webhook refusé')
    return false
  }
  const signature = req.headers.get('x-webhook-signature') ?? ''
  const a = Buffer.from(signature)
  const b = Buffer.from(secret)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

// Réponse neutre — toujours 200, pour les événements qu'on choisit d'ignorer
// (status updates, messages de groupe, médias non-texte, etc.) afin de ne
// jamais déclencher les retries de Wasender sur des cas normaux.
function ignored() {
  return NextResponse.json({ received: true })
}

export async function POST(req: NextRequest) {
  if (!verifySignature(req)) {
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 })
  }

  const body = await req.json().catch(() => null) as WasenderWebhookPayload | null
  if (!body) return ignored()

  // On ne traite que les messages entrants individuels — pas les statuts,
  // pas les groupes, pas nos propres messages sortants échoués en retour.
  if (body.event !== 'messages.received') return ignored()

  const msg = body.data?.messages
  if (!msg || msg.key?.fromMe) return ignored()

  const remoteJid = msg.key?.remoteJid ?? ''
  if (remoteJid.endsWith('@g.us')) return ignored() // chat de groupe — hors scope du bot

  const text = (msg.messageBody ?? msg.message?.conversation ?? '').trim()
  if (!text) return ignored() // média sans texte (image, audio, sticker…) — pas géré pour l'instant

  const rawPhone = msg.key?.cleanedSenderPn || msg.key?.senderPn || remoteJid.replace(/@.*$/, '')
  if (!rawPhone) return ignored()
  const phone = normalizePhone(rawPhone)

  const supabase = createServiceClient()

  const { data: user } = await supabase
    .from('users')
    .select('id')
    .eq('phone', phone)
    .maybeSingle()

  if (!user) {
    await sendWhatsApp(
      rawPhone,
      `🔥 *GreenFlame*\n\nJe ne retrouve pas de compte associé à ce numéro.\n\nInscris-toi en 2 minutes sur greenflame.africa, puis réécris-moi — je pourrai t'aider sur ton solde, tes achats, ton réseau et plus encore !`,
    )
    return ignored()
  }

  // Historique récent — reconstruit depuis chatbot_messages puisque chaque
  // appel webhook est indépendant (pas d'état côté client comme pour le
  // widget in-app, voir migration 056).
  const { data: historyRows } = await supabase
    .from('chatbot_messages')
    .select('role, content')
    .eq('user_id', user.id)
    .eq('channel', 'whatsapp')
    .order('created_at', { ascending: false })
    .limit(MAX_HISTORY)

  const history: ChatMessage[] = (historyRows ?? [])
    .reverse()
    .map(r => ({ role: r.role as ChatMessage['role'], content: r.content }))

  let reply: string
  try {
    reply = await getChatReply({
      supabase,
      userId: user.id,
      message: text,
      history,
      channel: 'whatsapp',
    })
  } catch (err) {
    console.error('[chat/whatsapp] error:', err)
    reply = "Désolé, je n'arrive pas à répondre pour le moment. Réessaie dans un instant ou contacte le support GreenFlame."
  }

  // Journalisation de l'échange — alimente l'historique du prochain message.
  await supabase.from('chatbot_messages').insert([
    { user_id: user.id, channel: 'whatsapp', role: 'user', content: text },
    { user_id: user.id, channel: 'whatsapp', role: 'assistant', content: reply },
  ])

  await sendWhatsApp(phone, reply)

  return ignored()
}
