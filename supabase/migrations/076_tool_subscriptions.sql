-- Migration 037 — Abonnements aux outils sectoriels
-- Table: tool_subscriptions (salon | couture | btp | resto)

CREATE TABLE IF NOT EXISTS public.tool_subscriptions (
  id           UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id  UUID    NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  tool_slug    TEXT    NOT NULL CHECK (tool_slug IN ('salon', 'couture', 'btp', 'resto')),
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL,
  amount_fcfa  INTEGER NOT NULL DEFAULT 10000,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (merchant_id, tool_slug)
);

ALTER TABLE public.tool_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tool_subs_select" ON public.tool_subscriptions;
DROP POLICY IF EXISTS "tool_subs_insert" ON public.tool_subscriptions;
DROP POLICY IF EXISTS "tool_subs_update" ON public.tool_subscriptions;

DROP POLICY IF EXISTS "tool_subs_select" ON public.tool_subscriptions;
CREATE POLICY "tool_subs_select" ON public.tool_subscriptions
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "tool_subs_insert" ON public.tool_subscriptions;
CREATE POLICY "tool_subs_insert" ON public.tool_subscriptions
  FOR INSERT WITH CHECK (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "tool_subs_update" ON public.tool_subscriptions;
CREATE POLICY "tool_subs_update" ON public.tool_subscriptions
  FOR UPDATE USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_tool_subs_merchant      ON public.tool_subscriptions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tool_subs_merchant_slug ON public.tool_subscriptions(merchant_id, tool_slug);
