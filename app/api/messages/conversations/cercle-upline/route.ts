import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { getOrCreateCercleUplineConversation } from '@/lib/messaging/conversations'

/**
 * app/api/messages/conversations/cercle-upline/route.ts
 *
 * Palier 1 — cercle de l'upline direct. Aucun paramètre d'URL : la
 * conversation visée se déduit entièrement de l'appelant (son upline_id),
 * jamais d'un id fourni par le client. Gate : achat seul (au moins une
 * transaction "completed" en tant qu'acheteur), PAS de verrou KYC — décision
 * confirmée (voir migration 057, en-tête). reference_id de la conversation =
 * l'id du Kingmaker racine du cercle ; is_conversation_member() (migration
 * 057) accepte aussi bien ce Kingmaker (reference_id = auth.uid()) que ses
 * filleuls directs (reference_id = leur upline_id).
 */
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('upline_id')
    .eq('id', user.id)
    .single()

  // Palier 1 : aucun gate achat — tout utilisateur authentifié peut accéder
  // à son cercle communautaire (upline direct). Décision : même sans KYC ni
  // achat, l'utilisateur doit pouvoir discuter avec sa communauté.

  // Sans parrain (racine du réseau) : on est soi-même le centre du cercle.
  const kingmakerId = profile?.upline_id ?? user.id

  const svc = createServiceClient()
  const result = await getOrCreateCercleUplineConversation(svc, kingmakerId)

  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 400 })
  return NextResponse.json(result)
}
