-- Migration 006 : outils sectoriels VIP
-- tool_subscriptions : outil activé pour un marchand VIP
-- tool_requests      : demande d'outil non encore disponible

-- ── tool_subscriptions ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tool_subscriptions (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id uuid NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  tool_slug   text NOT NULL,
  plan        text NOT NULL DEFAULT 'vip',
  started_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  CONSTRAINT tool_subscriptions_merchant_tool_unique UNIQUE (merchant_id, tool_slug)
);

ALTER TABLE tool_subscriptions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tool_subscriptions'
      AND policyname = 'tool_subscriptions_select_own'
  ) THEN
    CREATE POLICY "tool_subscriptions_select_own" ON tool_subscriptions
      FOR SELECT USING (
        merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tool_subscriptions_merchant
  ON tool_subscriptions (merchant_id, expires_at DESC);

-- ── tool_requests ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tool_requests (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id  uuid REFERENCES merchants(id) ON DELETE CASCADE,
  tool_slug    text,
  sector_label text NOT NULL,
  submitted_at timestamptz DEFAULT now(),
  status       text DEFAULT 'pending' CHECK (status IN ('pending', 'in_review', 'planned', 'declined'))
);

ALTER TABLE tool_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tool_requests'
      AND policyname = 'tool_requests_select_own'
  ) THEN
    CREATE POLICY "tool_requests_select_own" ON tool_requests
      FOR SELECT USING (
        merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
      );
  END IF;
END $$;
