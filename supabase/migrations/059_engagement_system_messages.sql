-- ================================================================
-- Migration 059 : Fondation engagement réel (sans promesse)
-- ================================================================
-- Trois chantiers décidés le 20 juin 2026, ancrés sur des mécaniques
-- déjà actives (pas de nouvelle promesse financière) :
--   1. Messages SYSTÈME dans les conversations (rang up, cagnotte,
--      tontine) — preuve sociale via le vrai graphe d'utilisateurs.
--   2. Alerte avant la chute de rang inactivité (60j) — visibilité
--      d'un risque réel, pas une récompense fictive.
--   3. Throttle des nudges IA proactifs — réutilise les colonnes déjà
--      présentes sur user_ai_profile (029), rien à ajouter ici.
-- ================================================================

-- ── 1. Messages système ──────────────────────────────────────────
-- sender_id devient nullable : un message système n'a pas d'émetteur
-- humain. message_type distingue les deux cas, avec une contrainte
-- qui empêche tout état incohérent (système + sender, ou utilisateur
-- sans sender).
ALTER TABLE public.messages
  ALTER COLUMN sender_id DROP NOT NULL;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'user'
    CHECK (message_type IN ('user', 'system'));

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_sender_type_consistency;
ALTER TABLE public.messages
  ADD CONSTRAINT messages_sender_type_consistency CHECK (
    (message_type = 'user'   AND sender_id IS NOT NULL) OR
    (message_type = 'system' AND sender_id IS NULL)
  );

-- La policy d'insertion existante (messages_insert) exige
-- sender_id = auth.uid(), donc un utilisateur authentifié ne peut
-- jamais insérer un message système — seul service_role (qui
-- contourne RLS) peut le faire. Rien à modifier sur la policy elle-
-- même, mais on documente l'intention pour éviter qu'une future
-- migration n'ouvre involontairement la porte.
COMMENT ON COLUMN public.messages.message_type IS
  'user = écrit par un humain (sender_id requis) ; system = événement métier auto-posté par service_role (sender_id NULL). Jamais écrit par un utilisateur authentifié — la policy messages_insert l''interdit déjà via sender_id = auth.uid().';

-- ── 2. Alerte pré-rupture Flamme (inactivité) ────────────────────
-- Throttle pour éviter un envoi WhatsApp répété chaque nuit pendant
-- toute la fenêtre d'alerte (45-59j) — un seul envoi par cycle
-- d'inactivité, réinitialisé dès qu'un nouvel événement FA/connexion
-- réactive le compte (voir lib/flamme/engine.ts).
ALTER TABLE public.user_flammes
  ADD COLUMN IF NOT EXISTS last_inactivity_warning_at TIMESTAMPTZ;

-- ================================================================
-- VÉRIFICATION
SELECT count(*) FROM public.messages WHERE message_type = 'system';
-- Doit retourner 0 juste après la migration (aucun message système
-- n'existe encore).
-- ================================================================
