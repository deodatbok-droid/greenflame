-- ================================================================
-- Migration 057 : Messagerie in-app — fondation
-- Tables : conversations, conversation_participants, messages,
--          conversation_invitations (palier 2), message_reports
-- ================================================================
-- Architecture confirmée le 18 juin 2026 (voir mémoire
-- greenflame-messaging-chatbot-architecture) : Supabase Realtime, pas de
-- Pusher/Stream/Twilio. Quatre portées, chacune avec son propre gate :
--
--   marchand_client  : conversation liée à une commande (transactions.id).
--                       Aucun verrou KYC — choix explicite et confirmé,
--                       relation contractuelle déjà établie par la commande.
--   tontine          : conversation de groupe par tontine existante
--                       (migrations 037/040), un thread par tontine.
--   cercle_upline    : "cercle Kingmaker ↔ réseau" — palier 1, débloqué dès
--                       le premier achat, SANS dépendre du KYC. Réutilise le
--                       graphe de parrainage déjà en base (users.upline_id)
--                       comme source de vérité pour l'appartenance : pas de
--                       table de membres dédiée, l'appartenance est calculée
--                       (voir is_conversation_member ci-dessous), pas stockée.
--   palier2          : achat ET KYC (kyc_level >= 1) → recherche + invitation
--                       vers n'importe quel utilisateur de la plateforme.
--                       Gate fort : pas de message direct ouvert, passage
--                       obligé par conversation_invitations (accepté/refusé/
--                       en attente) avant que la conversation n'existe.
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── CONVERSATIONS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.conversations (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  type            TEXT        NOT NULL
    CHECK (type IN ('marchand_client', 'tontine', 'cercle_upline', 'palier2')),
  -- Sens de reference_id selon le type :
  --   marchand_client → transactions.id (un thread par commande)
  --   tontine         → tontines.id
  --   cercle_upline   → users.id du Kingmaker racine du cercle
  --   palier2         → NULL (appartenance uniquement via conversation_participants,
  --                     créée à l'acceptation de l'invitation)
  reference_id    UUID        NULL,
  created_by      UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  last_message_at TIMESTAMPTZ DEFAULT NOW(),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Un seul thread par (type, reference_id) pour les portées à référence stable —
-- évite les doublons de conversation pour la même commande/tontine/cercle.
-- Index NON partiel délibérément : en SQL standard, NULL <> NULL dans une
-- contrainte unique, donc les lignes palier2 (reference_id toujours NULL)
-- ne se bloquent jamais entre elles — pas besoin de clause WHERE, et un
-- upsert PostgREST (`ON CONFLICT (type, reference_id)`, sans prédicat) peut
-- cibler cet index directement, ce qu'un index partiel ne permettrait pas.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_conversations_type_reference
  ON public.conversations(type, reference_id);

CREATE INDEX IF NOT EXISTS idx_conversations_last_message
  ON public.conversations(last_message_at DESC);

-- ── PARTICIPANTS ─────────────────────────────────────────────────────────
-- Utilisé pour marchand_client, tontine et palier2 (appartenance explicite).
-- PAS utilisé pour cercle_upline : l'appartenance s'y calcule directement
-- depuis users.upline_id (voir is_conversation_member), pas de duplication
-- d'état entre cette table et le graphe de parrainage.
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  last_read_at    TIMESTAMPTZ,
  joined_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_participants_user
  ON public.conversation_participants(user_id);

-- ── MESSAGES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID        NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content         TEXT        NOT NULL,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
  ON public.messages(conversation_id, created_at DESC);

-- ── INVITATIONS (palier 2 uniquement) ───────────────────────────────────
-- Pas de message direct ouvert : la conversation palier2 ne se crée que
-- lorsque le destinataire accepte. Évite la sollicitation non désirée
-- (hors-plateforme, harcèlement, arnaque) — risque direct pour le modèle de
-- revenu basé sur la taxe comportementale.
CREATE TABLE IF NOT EXISTS public.conversation_invitations (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id    UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id      UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'en_attente'
    CHECK (status IN ('en_attente', 'acceptee', 'refusee')),
  conversation_id UUID        REFERENCES public.conversations(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  responded_at    TIMESTAMPTZ,
  CHECK (from_user_id <> to_user_id)
);

-- Empêche le spam de relances multiples vers la même personne tant qu'une
-- invitation est encore en attente.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_invitation_pending
  ON public.conversation_invitations(from_user_id, to_user_id)
  WHERE status = 'en_attente';

CREATE INDEX IF NOT EXISTS idx_invitations_to_user
  ON public.conversation_invitations(to_user_id, status);

-- ── SIGNALEMENTS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_reports (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id  UUID        NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  reporter_id UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason      TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'ouvert'
    CHECK (status IN ('ouvert', 'traite', 'rejete')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_reports_status
  ON public.message_reports(status);

-- ================================================================
-- APPARTENANCE — fonction partagée par toutes les policies RLS
-- ================================================================
-- SECURITY DEFINER : exécutée avec les droits du propriétaire (postgres),
-- donc ses requêtes internes contournent RLS sur conversations/
-- conversation_participants/users — sans ça on aurait une évaluation RLS
-- récursive (la policy de `conversations` appellerait une fonction qui relit
-- `conversations` sous RLS, etc.). C'est le pattern standard Postgres pour
-- ce cas, pas un contournement de sécurité : la fonction elle-même reste
-- stricte (toujours scopée à auth.uid()).
CREATE OR REPLACE FUNCTION public.is_conversation_member(p_conversation_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM public.conversation_participants
      WHERE conversation_id = p_conversation_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = p_conversation_id
        AND c.type = 'cercle_upline'
        AND (
          c.reference_id = auth.uid()
          OR c.reference_id = (SELECT upline_id FROM public.users WHERE id = auth.uid())
        )
    );
$$;

-- ================================================================
-- RLS
-- ================================================================
ALTER TABLE public.conversations             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_invitations  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.message_reports           ENABLE ROW LEVEL SECURITY;

-- conversations — lecture si membre (calculé ou participant explicite)
DROP POLICY IF EXISTS "conversations_select" ON public.conversations;
CREATE POLICY "conversations_select" ON public.conversations
  FOR SELECT USING (public.is_conversation_member(id));

-- conversations — création : l'app crée via service role pour
-- marchand_client/tontine/cercle_upline (déclenché par un événement métier :
-- commande, appartenance tontine, premier achat). Un utilisateur authentifié
-- ne peut créer en direct qu'une conversation palier2 (issue d'une invitation
-- acceptée par lui).
DROP POLICY IF EXISTS "conversations_insert_own" ON public.conversations;
CREATE POLICY "conversations_insert_own" ON public.conversations
  FOR INSERT WITH CHECK (
    type = 'palier2' AND created_by = auth.uid()
  );

-- conversation_participants — lecture si on est soi-même dans la liste, ou
-- si on partage la conversation avec la personne listée.
DROP POLICY IF EXISTS "conversation_participants_select" ON public.conversation_participants;
CREATE POLICY "conversation_participants_select" ON public.conversation_participants
  FOR SELECT USING (public.is_conversation_member(conversation_id));

-- conversation_participants — un utilisateur ne s'ajoute jamais lui-même
-- (gates métier : commande, KYC, invitation acceptée) → pas de policy INSERT
-- pour authenticated, seul service_role écrit ici (voir policy service plus bas).

-- messages — lecture/écriture réservées aux membres de la conversation
DROP POLICY IF EXISTS "messages_select" ON public.messages;
CREATE POLICY "messages_select" ON public.messages
  FOR SELECT USING (public.is_conversation_member(conversation_id));

DROP POLICY IF EXISTS "messages_insert" ON public.messages;
CREATE POLICY "messages_insert" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND public.is_conversation_member(conversation_id)
  );

-- conversation_invitations — visible par l'émetteur et le destinataire
DROP POLICY IF EXISTS "conversation_invitations_select" ON public.conversation_invitations;
CREATE POLICY "conversation_invitations_select" ON public.conversation_invitations
  FOR SELECT USING (auth.uid() IN (from_user_id, to_user_id));

-- conversation_invitations — créer une invitation palier2 : achat ET KYC
-- requis (kyc_level >= 1, confirmé via app/api/kyc/review/route.ts ; achat =
-- au moins une transaction complétée en tant qu'acheteur).
DROP POLICY IF EXISTS "conversation_invitations_insert" ON public.conversation_invitations;
CREATE POLICY "conversation_invitations_insert" ON public.conversation_invitations
  FOR INSERT WITH CHECK (
    from_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND kyc_level >= 1)
    AND EXISTS (
      SELECT 1 FROM public.transactions
      WHERE buyer_id = auth.uid() AND status = 'completed'
    )
  );

-- conversation_invitations — seul le destinataire peut répondre (accepter/refuser)
DROP POLICY IF EXISTS "conversation_invitations_update" ON public.conversation_invitations;
CREATE POLICY "conversation_invitations_update" ON public.conversation_invitations
  FOR UPDATE USING (to_user_id = auth.uid())
  WITH CHECK (to_user_id = auth.uid());

-- message_reports — un membre de la conversation peut signaler un message
-- qu'il peut voir ; il ne voit que ses propres signalements (la modération
-- complète passe par le service role, voir admin à construire séparément).
DROP POLICY IF EXISTS "message_reports_select_own" ON public.message_reports;
CREATE POLICY "message_reports_select_own" ON public.message_reports
  FOR SELECT USING (reporter_id = auth.uid());

DROP POLICY IF EXISTS "message_reports_insert" ON public.message_reports;
CREATE POLICY "message_reports_insert" ON public.message_reports
  FOR INSERT WITH CHECK (
    reporter_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.messages m
      WHERE m.id = message_id AND public.is_conversation_member(m.conversation_id)
    )
  );

-- service_role — accès complet sur toutes les tables (création de
-- conversations marchand_client/tontine/cercle_upline, ajout de
-- participants, modération des signalements). Toujours scopé par user_id/
-- conversation_id explicite dans le code applicatif, jamais de requête non
-- filtrée — même convention que chatbot_messages (migration 056).
DROP POLICY IF EXISTS "conversations_service_all" ON public.conversations;
CREATE POLICY "conversations_service_all" ON public.conversations
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "conversation_participants_service_all" ON public.conversation_participants;
CREATE POLICY "conversation_participants_service_all" ON public.conversation_participants
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "conversation_invitations_service_all" ON public.conversation_invitations;
CREATE POLICY "conversation_invitations_service_all" ON public.conversation_invitations
  FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "message_reports_service_all" ON public.message_reports;
CREATE POLICY "message_reports_service_all" ON public.message_reports
  FOR ALL USING (auth.role() = 'service_role');

-- ── updated_at + last_message_at ─────────────────────────────────────────
-- Réutilise public.set_updated_at() déjà défini en migration 040.
DROP TRIGGER IF EXISTS conversations_updated_at ON public.conversations;
CREATE TRIGGER conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS messages_bump_last_message ON public.messages;
CREATE TRIGGER messages_bump_last_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

-- ================================================================
-- VÉRIFICATION
SELECT count(*) AS conversations_count FROM public.conversations;
-- Doit retourner 0 juste après la migration (tables neuves).
-- ================================================================
