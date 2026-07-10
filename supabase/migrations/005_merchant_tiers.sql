-- ================================================================
-- GREENFLAME — Migration 005 : Abonnements marchands (freemium)
-- ================================================================
-- Tiers : free (défaut) | pro (10 000 FCFA/mois) | vip (à venir)
-- ================================================================

-- 1. Ajouter les colonnes sur la table merchants
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'pro', 'vip')),
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ;

-- 2. Table d'historique des abonnements (append-only, audit trail)
CREATE TABLE IF NOT EXISTS public.merchant_subscriptions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id      UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  tier             TEXT NOT NULL CHECK (tier IN ('pro', 'vip')),
  amount_fcfa      BIGINT NOT NULL DEFAULT 10000,
  payment_method   TEXT,          -- 'mtn_momo' | 'moov_money'
  payment_ref      TEXT,          -- référence opérateur
  started_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ NOT NULL,
  status           TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_merchant_subscriptions_merchant
  ON public.merchant_subscriptions(merchant_id);

CREATE INDEX IF NOT EXISTS idx_merchant_subscriptions_expires
  ON public.merchant_subscriptions(expires_at)
  WHERE status = 'active';

-- 4. RLS — les marchands voient leur propre historique
ALTER TABLE public.merchant_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_subscriptions_self_read" ON public.merchant_subscriptions;
CREATE POLICY "merchant_subscriptions_self_read"
  ON public.merchant_subscriptions FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

-- Seul le service role peut insérer (via API route sécurisée)
DROP POLICY IF EXISTS "merchant_subscriptions_service_insert" ON public.merchant_subscriptions;
CREATE POLICY "merchant_subscriptions_service_insert"
  ON public.merchant_subscriptions FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

-- 5. Fonction utilitaire : activer/renouveler un abonnement
--    Appelée par l'Edge Function ou l'API route après paiement confirmé
CREATE OR REPLACE FUNCTION public.activate_merchant_subscription(
  p_merchant_id  UUID,
  p_tier         TEXT,
  p_amount_fcfa  BIGINT,
  p_payment_ref  TEXT,
  p_method       TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now        TIMESTAMPTZ := NOW();
  v_expires_at TIMESTAMPTZ;
  v_current    TIMESTAMPTZ;
BEGIN
  -- Calculer la date d'expiration (renouvellement depuis la date actuelle si déjà actif)
  SELECT subscription_expires_at INTO v_current
  FROM public.merchants WHERE id = p_merchant_id;

  IF v_current IS NOT NULL AND v_current > v_now THEN
    -- Renouvellement : ajouter 30 jours à l'expiration actuelle
    v_expires_at := v_current + INTERVAL '30 days';
  ELSE
    -- Nouvelle souscription ou expirée
    v_expires_at := v_now + INTERVAL '30 days';
  END IF;

  -- Mettre à jour le marchand
  UPDATE public.merchants SET
    subscription_tier        = p_tier,
    subscription_expires_at  = v_expires_at,
    subscription_started_at  = COALESCE(subscription_started_at, v_now)
  WHERE id = p_merchant_id;

  -- Insérer dans l'historique
  INSERT INTO public.merchant_subscriptions
    (merchant_id, tier, amount_fcfa, payment_method, payment_ref, started_at, expires_at)
  VALUES
    (p_merchant_id, p_tier, p_amount_fcfa, p_method, p_payment_ref, v_now, v_expires_at);
END;
$$;

-- 6. Fonction de vérification du tier actif (utilisée dans les queries)
CREATE OR REPLACE FUNCTION public.merchant_active_tier(p_merchant_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT
    CASE
      WHEN subscription_expires_at > NOW() THEN subscription_tier
      ELSE 'free'
    END
  FROM public.merchants
  WHERE id = p_merchant_id;
$$;

-- 7. Vue pratique pour les dashboards admin
DROP VIEW IF EXISTS public.merchant_tier_stats CASCADE;
CREATE OR REPLACE VIEW public.merchant_tier_stats AS
SELECT
  subscription_tier,
  COUNT(*) AS count,
  COUNT(*) FILTER (WHERE subscription_expires_at > NOW()) AS active_count
FROM public.merchants
GROUP BY subscription_tier;
