-- ── notifications ────────────────────────────────────────────────────────────
-- Table de notifications utilisateur (côté serveur → insertNotification)
-- RLS : chaque utilisateur ne voit que les siennes, peut les marquer lues.

CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type         VARCHAR(64) NOT NULL,
  title        VARCHAR(128) NOT NULL,
  body         TEXT NOT NULL,
  reference_id UUID NULL,
  is_read      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx ON public.notifications(user_id, is_read) WHERE is_read = false;

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Lire ses propres notifications
DROP POLICY IF EXISTS "user_read_own_notifications" ON public.notifications;
CREATE POLICY "user_read_own_notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Marquer ses propres notifications comme lues (UPDATE is_read uniquement)
DROP POLICY IF EXISTS "user_update_own_notifications" ON public.notifications;
CREATE POLICY "user_update_own_notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- INSERT réservé au service role (via createServiceClient)
-- Pas de politique INSERT pour les utilisateurs normaux → seul le service role peut insérer
