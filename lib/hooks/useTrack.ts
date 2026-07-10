'use client'

/**
 * useTrack — hook de tracking comportemental
 *
 * Usage :
 *   const track = useTrack()
 *   track('page_viewed', { page: '/network' })
 *   track('feature_used', { feature: 'referral_copy' })
 *
 * Fire-and-forget : ne bloque jamais, n'affiche jamais d'erreur.
 * Session ID auto-généré et persisté en mémoire pour la session courante.
 */

import { useCallback, useRef } from 'react'

// Session ID unique par onglet/session navigateur
const SESSION_ID = typeof crypto !== 'undefined'
  ? crypto.randomUUID()
  : Math.random().toString(36).slice(2)

export function useTrack() {
  const lastEvent = useRef<string | null>(null)

  const track = useCallback((
    eventType: string,
    metadata: Record<string, unknown> = {}
  ) => {
    // Dédoublonnage : ne pas envoyer deux fois le même event_type consécutif
    // (évite les loops infinis dans les composants qui re-rendent)
    if (lastEvent.current === eventType) return
    lastEvent.current = eventType

    // Reset après 500ms pour permettre des événements répétés légitimes
    setTimeout(() => { lastEvent.current = null }, 500)

    fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventType, metadata, sessionId: SESSION_ID }),
    }).catch(() => {}) // silencieux en cas d'erreur réseau

  }, [])

  return track
}

/**
 * trackServer — version serveur/API (sans hook)
 * À appeler depuis les route handlers avec le service client
 */
export async function trackServer(
  svc: ReturnType<typeof import('@/lib/supabase/server').createServiceClient>,
  userId: string,
  eventType: string,
  metadata: Record<string, unknown> = {}
) {
  try {
    await (await svc).from('user_events').insert({
      user_id:    userId,
      event_type: eventType,
      metadata,
    })
  } catch {
    // Silencieux — le tracking ne doit jamais casser une transaction
  }
}
