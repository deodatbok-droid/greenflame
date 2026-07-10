import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * lib/messaging/conversations.ts
 *
 * Helpers serveur pour la messagerie in-app (migration 057). Toujours
 * appelés avec un client service_role (createServiceClient()) car la
 * création d'une conversation/l'ajout de participants doit pouvoir
 * s'exécuter pour le compte des DEUX parties (acheteur + marchand), pas
 * seulement celle qui a déclenché l'appel — RLS bloquerait l'écriture du
 * participant qui n'est pas l'utilisateur connecté. La sécurité reste
 * garantie : chaque fonction ci-dessous résout elle-même les bons user_id
 * depuis la commande/le palier concerné, jamais depuis une entrée libre de
 * l'appelant.
 */

/**
 * Récupère (ou crée) la conversation marchand↔client liée à une commande.
 * Idempotent : repose sur la contrainte unique (type, reference_id) de la
 * migration 057 — deux appels concurrents pour la même commande convergent
 * vers la même conversation.
 *
 * Vérifie que `requestingUserId` est bien partie à cette commande (acheteur
 * ou marchand) avant de créer/retourner quoi que ce soit, pour qu'un appelant
 * authentifié ne puisse pas ouvrir le fil d'une commande qui n'est pas la
 * sienne en devinant un transactionId.
 */
export async function getOrCreateOrderConversation(
  svc: SupabaseClient,
  transactionId: string,
  requestingUserId: string,
): Promise<{ conversationId: string } | { error: string }> {
  const { data: tx } = await svc
    .from('transactions')
    .select('id, buyer_id, merchants(user_id)')
    .eq('id', transactionId)
    .maybeSingle()

  const merchant = tx?.merchants as unknown as { user_id: string } | null
  if (!tx || !merchant?.user_id) return { error: 'Commande introuvable' }

  const buyerId = tx.buyer_id as string
  const merchantUserId = merchant.user_id
  if (requestingUserId !== buyerId && requestingUserId !== merchantUserId) {
    return { error: 'Accès refusé à cette commande' }
  }

  const { data: conv, error } = await svc
    .from('conversations')
    .upsert(
      { type: 'marchand_client', reference_id: transactionId, created_by: buyerId },
      { onConflict: 'type,reference_id', ignoreDuplicates: false },
    )
    .select('id')
    .single()

  if (error || !conv) return { error: error?.message ?? 'Création de conversation impossible' }

  const { error: partErr } = await svc.from('conversation_participants').upsert(
    [
      { conversation_id: conv.id, user_id: buyerId },
      { conversation_id: conv.id, user_id: merchantUserId },
    ],
    { onConflict: 'conversation_id,user_id', ignoreDuplicates: true },
  )
  if (partErr) return { error: partErr.message }

  return { conversationId: conv.id as string }
}

/**
 * Récupère (ou crée) la conversation de groupe d'une tontine, et synchronise
 * les participants avec tontine_membres (membres ayant un compte GreenFlame
 * uniquement — les membres saisis sans compte, user_id NULL, ne peuvent pas
 * avoir d'accès RLS donc ne sont pas ajoutés).
 */
export async function getOrCreateTontineConversation(
  svc: SupabaseClient,
  tontineId: string,
  requestingUserId: string,
): Promise<{ conversationId: string } | { error: string }> {
  const { data: membre } = await svc
    .from('tontine_membres')
    .select('id')
    .eq('tontine_id', tontineId)
    .eq('user_id', requestingUserId)
    .maybeSingle()

  const { data: tontine } = await svc
    .from('tontines')
    .select('id, creator_id')
    .eq('id', tontineId)
    .maybeSingle()

  if (!tontine) return { error: 'Tontine introuvable' }
  if (!membre && tontine.creator_id !== requestingUserId) {
    return { error: 'Accès refusé à cette tontine' }
  }

  const { data: conv, error } = await svc
    .from('conversations')
    .upsert(
      { type: 'tontine', reference_id: tontineId, created_by: tontine.creator_id },
      { onConflict: 'type,reference_id', ignoreDuplicates: false },
    )
    .select('id')
    .single()

  if (error || !conv) return { error: error?.message ?? 'Création de conversation impossible' }

  const { data: membres } = await svc
    .from('tontine_membres')
    .select('user_id')
    .eq('tontine_id', tontineId)
    .not('user_id', 'is', null)

  const participants = (membres ?? []).map(m => ({ conversation_id: conv.id, user_id: m.user_id as string }))
  if (participants.length > 0) {
    const { error: partErr } = await svc
      .from('conversation_participants')
      .upsert(participants, { onConflict: 'conversation_id,user_id', ignoreDuplicates: true })
    if (partErr) return { error: partErr.message }
  }

  return { conversationId: conv.id as string }
}

/**
 * Récupère (ou crée) le cercle upline (palier 1) d'un Kingmaker. Aucune ligne
 * conversation_participants n'est créée — l'appartenance est calculée par
 * is_conversation_member() directement depuis users.upline_id (voir
 * migration 057), donc rien à synchroniser ici au-delà de l'existence de la
 * conversation elle-même.
 */
export async function getOrCreateCercleUplineConversation(
  svc: SupabaseClient,
  kingmakerId: string,
): Promise<{ conversationId: string } | { error: string }> {
  const { data: conv, error } = await svc
    .from('conversations')
    .upsert(
      { type: 'cercle_upline', reference_id: kingmakerId, created_by: kingmakerId },
      { onConflict: 'type,reference_id', ignoreDuplicates: false },
    )
    .select('id')
    .single()

  if (error || !conv) return { error: error?.message ?? 'Création de conversation impossible' }
  return { conversationId: conv.id as string }
}

/**
 * Accepte une invitation palier2 et crée la conversation + les deux
 * participants. Appelé avec un client service_role car l'ajout du
 * participant `from_user_id` (qui n'est pas l'appelant — c'est le
 * destinataire qui accepte) n'est pas permis sous RLS authenticated. La
 * vérification d'autorisation reste stricte : on ne lit/n'agit que sur
 * l'invitation précise, et seulement si `requestingUserId` est bien le
 * destinataire (to_user_id) et que l'invitation est encore en attente.
 */
export async function acceptInvitation(
  svc: SupabaseClient,
  invitationId: string,
  requestingUserId: string,
): Promise<{ conversationId: string } | { error: string }> {
  const { data: invitation } = await svc
    .from('conversation_invitations')
    .select('id, from_user_id, to_user_id, status, conversation_id')
    .eq('id', invitationId)
    .maybeSingle()

  if (!invitation) return { error: 'Invitation introuvable' }
  if (invitation.to_user_id !== requestingUserId) return { error: 'Accès refusé à cette invitation' }

  // Idempotent : si déjà acceptée, renvoyer la conversation existante plutôt
  // que d'échouer (double-clic, retry réseau).
  if (invitation.status === 'acceptee' && invitation.conversation_id) {
    return { conversationId: invitation.conversation_id as string }
  }
  if (invitation.status !== 'en_attente') return { error: 'Invitation déjà traitée' }

  const { data: conv, error: convErr } = await svc
    .from('conversations')
    .insert({ type: 'palier2', created_by: requestingUserId })
    .select('id')
    .single()

  if (convErr || !conv) return { error: convErr?.message ?? 'Création de conversation impossible' }

  const { error: partErr } = await svc.from('conversation_participants').insert([
    { conversation_id: conv.id, user_id: invitation.from_user_id },
    { conversation_id: conv.id, user_id: invitation.to_user_id },
  ])
  if (partErr) return { error: partErr.message }

  const { error: updErr } = await svc
    .from('conversation_invitations')
    .update({ status: 'acceptee', conversation_id: conv.id, responded_at: new Date().toISOString() })
    .eq('id', invitationId)
  if (updErr) return { error: updErr.message }

  return { conversationId: conv.id as string }
}

/**
 * Poste un message SYSTÈME (sender_id NULL, message_type='system') dans une
 * conversation déjà existante — preuve sociale auto-générée pour un
 * événement métier réel (montée de rang, gain cagnotte, tour de tontine
 * complété). Jamais une promesse, jamais de contenu inventé : le texte posté
 * doit toujours décrire un fait déjà survenu. Toujours appelé avec
 * service_role (migration 059 : la policy messages_insert exige
 * sender_id = auth.uid(), donc un utilisateur authentifié ne peut pas écrire
 * un message système — seul ce helper, derrière service_role, le peut).
 *
 * Volontairement non bloquant pour l'appelant : un échec d'envoi du message
 * social ne doit jamais faire échouer l'événement métier qui le déclenche
 * (un rang up ou un gain cagnotte doit toujours réussir même si ceci échoue).
 * Les appelants doivent donc catcher/ignorer l'erreur, pas la propager.
 */
export async function postSystemMessage(
  svc: SupabaseClient,
  conversationId: string,
  content: string,
): Promise<{ messageId: string } | { error: string }> {
  const { data, error } = await svc
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: null, message_type: 'system', content })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Message système non envoyé' }
  return { messageId: data.id as string }
}

/**
 * Résout l'id du cercle upline (palier 1) "propre" d'un utilisateur — même
 * logique que app/api/messages/conversations/cercle-upline/route.ts : le
 * cercle d'un utilisateur est ancré sur son upline_id, ou sur lui-même s'il
 * n'a pas d'upline (racine de réseau). Centralisé ici pour que les hooks
 * d'événements métier (Flamme, Cagnotte) n'aient pas à dupliquer cette règle.
 */
export async function resolveOwnCircleId(
  svc: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: profile } = await svc
    .from('users')
    .select('upline_id')
    .eq('id', userId)
    .maybeSingle()
  return (profile?.upline_id as string | null) ?? userId
}

/**
 * Combine resolveOwnCircleId + getOrCreateCercleUplineConversation +
 * postSystemMessage en un seul appel pratique pour les hooks d'événements
 * métier qui annoncent quelque chose dans le cercle PROPRE d'un utilisateur
 * (pas un broadcast plateforme). Avale silencieusement les erreurs — voir la
 * note de postSystemMessage : un échec ici ne doit jamais remonter à
 * l'appelant ni faire échouer l'événement métier déclencheur.
 */
export async function announceInOwnCircle(
  svc: SupabaseClient,
  userId: string,
  content: string,
): Promise<void> {
  try {
    const circleId = await resolveOwnCircleId(svc, userId)
    const conv = await getOrCreateCercleUplineConversation(svc, circleId)
    if ('error' in conv) return
    await postSystemMessage(svc, conv.conversationId, content)
  } catch {
    // silencieux — preuve sociale, jamais bloquant
  }
}
