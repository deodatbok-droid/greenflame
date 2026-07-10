-- ================================================================
-- Migration 056 : Historique du chatbot GreenFlame
-- Table : chatbot_messages
-- ================================================================
-- La surface in-app garde l'historique en mémoire côté client (state React,
-- voir components/ChatWidget.tsx) — ça suffit puisque la conversation HTTP
-- et la session du navigateur vivent ensemble.
--
-- La surface WhatsApp (app/api/chat/whatsapp/route.ts) n'a pas cette chance :
-- chaque message entrant arrive comme un webhook indépendant, sans aucun
-- état côté client. Sans persistance serveur, l'assistant "oublierait" tout
-- entre deux messages WhatsApp, ce qui casserait toute conversation à
-- plusieurs tours (ex: "et mes 3 dernières transactions ?" après avoir parlé
-- du solde). Cette table comble ce manque en journalisant chaque tour
-- (utilisateur + assistant), pour les deux canaux, avec assez de contexte
-- pour reconstruire un historique récent.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.chatbot_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel     VARCHAR(20) NOT NULL CHECK (channel IN ('app', 'whatsapp')),
  role        VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour la reconstruction rapide de l'historique récent d'un utilisateur
-- sur un canal donné (la requête la plus fréquente : "les N derniers tours").
CREATE INDEX IF NOT EXISTS idx_chatbot_messages_user_channel
  ON public.chatbot_messages (user_id, channel, created_at DESC);

-- ================================================================
-- RLS — sécurité
-- ================================================================
ALTER TABLE public.chatbot_messages ENABLE ROW LEVEL SECURITY;

-- L'utilisateur connecté peut lire et insérer ses propres messages (surface
-- in-app, si on persiste un jour son historique aussi côté serveur).
DROP POLICY IF EXISTS "chatbot_messages_select_own" ON public.chatbot_messages;
CREATE POLICY "chatbot_messages_select_own" ON public.chatbot_messages
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "chatbot_messages_insert_own" ON public.chatbot_messages;
CREATE POLICY "chatbot_messages_insert_own" ON public.chatbot_messages
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Le webhook WhatsApp tourne sans session utilisateur (résolution par
-- numéro de téléphone) — il écrit/lit donc via le client service_role,
-- qui contourne RLS mais reste explicitement filtré par user_id dans le code
-- (voir lib/chat/core.ts et app/api/chat/whatsapp/route.ts).
DROP POLICY IF EXISTS "chatbot_messages_service_all" ON public.chatbot_messages;
CREATE POLICY "chatbot_messages_service_all" ON public.chatbot_messages
  FOR ALL USING (auth.role() = 'service_role');

-- ================================================================
-- VÉRIFICATION
SELECT count(*) AS chatbot_messages_count FROM public.chatbot_messages;
-- Doit retourner 0 juste après la migration (table neuve).
-- ================================================================
