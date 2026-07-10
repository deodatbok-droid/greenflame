/**
 * POST /api/events
 *
 * Route ultra-légère pour capturer les signaux comportementaux.
 * Appelée silencieusement depuis le frontend à chaque interaction clé.
 * Ne bloque jamais l'UX — fire-and-forget côté client.
 *
 * Body : { eventType, metadata?, sessionId? }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/utils/rateLimit'

// Types d'événements autorisés depuis le client
// (le service role peut en envoyer d'autres via createServiceClient)
const CLIENT_ALLOWED_EVENTS = new Set([
  'app_opened',
  'session_started',
  'page_viewed',
  'feature_used',
  'notification_opened',
  'cashback_viewed',
  'referral_link_copied',
  'referral_link_shared',
  'network_viewed',
  'network_level_expanded',
  'profile_viewed',
  'merchant_searched',
  'merchant_profile_viewed',
  'merchant_qr_scanned',
  'upgrade_page_viewed',
  'wallet_viewed',
])

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    // Rate limit souple : 120 événements/minute (usage normal)
    const rl = checkRateLimit(`events:${user.id}`, 120, 60_000)
    if (!rl.allowed) {
      // On ne bloque pas — on drop silencieusement pour ne pas gêner l'UX
      return NextResponse.json({ ok: true, dropped: true })
    }

    let body: { eventType: string; metadata?: Record<string, unknown>; sessionId?: string }
    try { body = await req.json() }
    catch { return NextResponse.json({ ok: false }, { status: 400 }) }

    const { eventType, metadata = {}, sessionId } = body

    // Valider que l'événement est dans la liste autorisée côté client
    if (!CLIENT_ALLOWED_EVENTS.has(eventType)) {
      return NextResponse.json({ ok: false, error: 'Event type not allowed' }, { status: 400 })
    }

    const svc = createServiceClient()
    await svc.from('user_events').insert({
      user_id:    user.id,
      event_type: eventType,
      session_id: sessionId ?? null,
      metadata,
    })

    return NextResponse.json({ ok: true })

  } catch {
    // Jamais d'erreur visible — le logging ne doit pas gêner l'UX
    return NextResponse.json({ ok: true, error: 'silenced' })
  }
}
