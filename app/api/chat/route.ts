import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getChatReply, type ChatMessage, type ChatLocale } from '@/lib/chat/core'

/**
 * app/api/chat/route.ts
 *
 * Backend unique du chatbot GreenFlame — multi-rôles (support client,
 * assistant outils sectoriels, accueil commercial/onboarding).
 *
 * Le rôle n'est pas routé en dur : le system prompt s'adapte au contexte
 * réel de l'utilisateur (profil, onboarding, secteur marchand). Réutilise
 * le pattern déjà en place dans /api/ai/suggest-category et lib/ai/kyc-analyzer.ts.
 *
 * Logique partagée avec la surface WhatsApp dans lib/chat/core.ts — voir
 * app/api/chat/whatsapp/route.ts (webhook Wasender, pas n8n/Meta Cloud API :
 * la tâche #47 ne couvrait que les rappels d'abonnement, pas le chat entrant).
 *
 * Garde-fou non négociable : cet endpoint ne déclenche jamais d'action
 * irréversible (retrait, reset PIN, validation KYC). Le bot lecture-only,
 * scoped à l'utilisateur connecté via le client Supabase RLS (jamais le
 * service client) — il ne peut pas voir les données d'un autre utilisateur.
 */

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => null) as { message?: string; history?: ChatMessage[]; locale?: string } | null
  const message = body?.message?.trim()
  if (!message) return NextResponse.json({ error: 'Message requis' }, { status: 400 })
  const locale: ChatLocale = body?.locale === 'en' ? 'en' : 'fr'

  try {
    const reply = await getChatReply({
      supabase,
      userId: user.id,
      message,
      history: body?.history ?? [],
      channel: 'app',
      locale,
    })
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[chat] error:', err)
    return NextResponse.json({ error: 'Assistant indisponible pour le moment' }, { status: 500 })
  }
}
