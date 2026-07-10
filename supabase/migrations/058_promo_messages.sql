-- ============================================================
-- 058 — Messages promotionnels marchands Pro/VIP
-- ============================================================

-- Solde de crédits promo par marchand (1 crédit = 1 message envoyé)
CREATE TABLE IF NOT EXISTS public.promo_message_credits (
  merchant_id  UUID PRIMARY KEY REFERENCES public.merchants(id) ON DELETE CASCADE,
  balance      INT  NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_used   INT  NOT NULL DEFAULT 0,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Opt-out : un utilisateur bloque les promos d'un marchand précis
CREATE TABLE IF NOT EXISTS public.promo_opt_outs (
  user_id     UUID NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, merchant_id)
);

-- Colonne action_url sur notifications (lien CTA, ex. boutique)
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS action_url TEXT;

-- ── RLS ──────────────────────────────────────────────────────

ALTER TABLE public.promo_message_credits ENABLE ROW LEVEL SECURITY;
-- Le marchand ne voit que son propre solde
DROP POLICY IF EXISTS "promo_credits_own" ON public.promo_message_credits;
CREATE POLICY "promo_credits_own" ON public.promo_message_credits
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

ALTER TABLE public.promo_opt_outs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "promo_optout_select" ON public.promo_opt_outs;
CREATE POLICY "promo_optout_select" ON public.promo_opt_outs
  FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "promo_optout_insert" ON public.promo_opt_outs;
CREATE POLICY "promo_optout_insert" ON public.promo_opt_outs
  FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "promo_optout_delete" ON public.promo_opt_outs;
CREATE POLICY "promo_optout_delete" ON public.promo_opt_outs
  FOR DELETE USING (user_id = auth.uid());
