-- ================================================================
-- GREENFLAME — Migration 017 : Tier VIP + Frais Bons de Retrait + Téléphone destinataire
-- ================================================================
-- Exécuter dans Supabase Dashboard > SQL Editor
-- ================================================================

-- ================================================================
-- 1. Colonnes supplémentaires sur withdrawal_vouchers
-- ================================================================

-- Téléphone du destinataire (obligatoire — doit être membre GreenFlame)
ALTER TABLE public.withdrawal_vouchers
  ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20);

-- Note: on ne met pas NOT NULL car les bons existants n'ont pas ce champ
-- L'API create/route.ts forcera la présence de ce champ pour les nouveaux bons

-- Frais de service 1% (total)
ALTER TABLE public.withdrawal_vouchers
  ADD COLUMN IF NOT EXISTS fee_fcfa BIGINT NOT NULL DEFAULT 0 CHECK (fee_fcfa >= 0);

-- Part du marchand (50% des frais)
ALTER TABLE public.withdrawal_vouchers
  ADD COLUMN IF NOT EXISTS merchant_fee_fcfa BIGINT NOT NULL DEFAULT 0 CHECK (merchant_fee_fcfa >= 0);

-- Part GreenFlame (50% des frais)
ALTER TABLE public.withdrawal_vouchers
  ADD COLUMN IF NOT EXISTS greenflame_fee_fcfa BIGINT NOT NULL DEFAULT 0 CHECK (greenflame_fee_fcfa >= 0);

-- ================================================================
-- 2. Étendre wallet_ledger.transaction_type pour les frais plateforme sur bons
-- ================================================================
ALTER TABLE public.wallet_ledger
  DROP CONSTRAINT IF EXISTS wallet_ledger_transaction_type_check;

ALTER TABLE public.wallet_ledger
  ADD CONSTRAINT wallet_ledger_transaction_type_check CHECK (
    transaction_type IN (
      'cashback',
      'commission_network',
      'platform_fee',
      'mobile_money_deposit',
      'mobile_money_withdrawal',
      'purchase_payment',
      'pgf_conversion',
      'spillover',
      'refund',
      'admin_credit',
      'admin_debit',
      'agent_deposit_in',
      'agent_withdrawal_out',
      'wallet_gf_payment',
      'voucher_reserve',            -- émetteur crée un bon (débit)
      'voucher_redemption',         -- marchand encaisse un bon (crédit brut)
      'voucher_cancel',             -- émetteur annule un bon (recrédit)
      'voucher_fee_merchant',       -- commission marchand sur encaissement (crédit)
      'voucher_fee_platform'        -- commission GreenFlame sur encaissement (revenus)
    )
  ) NOT VALID;

-- ================================================================
-- 3. Table de revenus plateforme GreenFlame (append-only)
-- ================================================================
-- Centralise toutes les sources de revenus GreenFlame :
--   a) commission_distributions (type='platform') depuis les transactions
--   b) frais sur bons de retrait (greenflame_fee_fcfa)
--   c) abonnements marchands (merchant_subscriptions)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.platform_revenue_ledger (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type  TEXT        NOT NULL
                 CHECK (source_type IN (
                   'transaction_platform_fee',   -- 45% des commissions transactions
                   'voucher_fee',                -- 0.5% des bons de retrait
                   'subscription'               -- abonnements Pro/VIP
                 )),
  source_id    UUID,        -- ID de la source (transaction, voucher, subscription)
  amount_fcfa  BIGINT       NOT NULL CHECK (amount_fcfa > 0),
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_source
  ON public.platform_revenue_ledger (source_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_date
  ON public.platform_revenue_ledger (created_at DESC);

-- RLS : uniquement lisible par service_role et admins
ALTER TABLE public.platform_revenue_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_revenue_admin_read" ON public.platform_revenue_ledger;
CREATE POLICY "platform_revenue_admin_read"
  ON public.platform_revenue_ledger FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND 'admin' = ANY(role)
    )
  );

-- ================================================================
-- 4. Vue analytique des revenus GreenFlame (admin dashboard)
-- ================================================================
DROP VIEW IF EXISTS public.v_platform_revenue CASCADE;
CREATE OR REPLACE VIEW public.v_platform_revenue AS
SELECT
  -- Revenus depuis les transactions (platform fee 45%)
  'transaction_platform_fee'::TEXT        AS source_type,
  SUM(cd.amount_fcfa)                     AS total_fcfa,
  COUNT(*)                                AS count,
  DATE_TRUNC('month', cd.created_at)      AS period_month
FROM public.commission_distributions cd
WHERE cd.distribution_type = 'platform'
GROUP BY DATE_TRUNC('month', cd.created_at)

UNION ALL

-- Revenus depuis les bons de retrait (GreenFlame part)
SELECT
  'voucher_fee'::TEXT                     AS source_type,
  SUM(wv.greenflame_fee_fcfa)             AS total_fcfa,
  COUNT(*)                                AS count,
  DATE_TRUNC('month', wv.redeemed_at)     AS period_month
FROM public.withdrawal_vouchers wv
WHERE wv.status = 'redeemed'
  AND wv.greenflame_fee_fcfa > 0
  AND wv.redeemed_at IS NOT NULL
GROUP BY DATE_TRUNC('month', wv.redeemed_at)

UNION ALL

-- Revenus depuis les abonnements marchands
SELECT
  'subscription'::TEXT                    AS source_type,
  SUM(ms.amount_fcfa)                     AS total_fcfa,
  COUNT(*)                                AS count,
  DATE_TRUNC('month', ms.created_at)      AS period_month
FROM public.merchant_subscriptions ms
WHERE ms.status IN ('active', 'expired')
GROUP BY DATE_TRUNC('month', ms.created_at);

-- ================================================================
-- 5. Vue résumé global des revenus (totaux par source)
-- ================================================================
DROP VIEW IF EXISTS public.v_platform_revenue CASCADE;
DROP VIEW IF EXISTS public.v_platform_revenue_summary CASCADE;
CREATE OR REPLACE VIEW public.v_platform_revenue_summary AS
SELECT
  source_type,
  SUM(total_fcfa) AS total_all_time_fcfa,
  SUM(count)      AS total_count
FROM public.v_platform_revenue
GROUP BY source_type;

-- ================================================================
-- 6. Mettre à jour activate_merchant_subscription pour lever
--    toute restriction résiduelle sur le tier VIP
--    (La fonction accepte déjà n'importe quel TEXT — on ajoute juste
--     une entrée dans platform_revenue_ledger à l'activation)
-- ================================================================
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
  v_sub_id     UUID;
BEGIN
  -- Valider le tier
  IF p_tier NOT IN ('pro', 'vip') THEN
    RAISE EXCEPTION 'Tier invalide : %', p_tier;
  END IF;

  -- Calculer la date d'expiration
  SELECT subscription_expires_at INTO v_current
  FROM public.merchants WHERE id = p_merchant_id;

  IF v_current IS NOT NULL AND v_current > v_now THEN
    v_expires_at := v_current + INTERVAL '30 days';
  ELSE
    v_expires_at := v_now + INTERVAL '30 days';
  END IF;

  -- Mettre à jour le marchand
  UPDATE public.merchants SET
    subscription_tier        = p_tier,
    subscription_expires_at  = v_expires_at,
    subscription_started_at  = COALESCE(subscription_started_at, v_now)
  WHERE id = p_merchant_id;

  -- Insérer dans l'historique des abonnements
  INSERT INTO public.merchant_subscriptions
    (merchant_id, tier, amount_fcfa, payment_method, payment_ref, started_at, expires_at)
  VALUES
    (p_merchant_id, p_tier, p_amount_fcfa, p_method, p_payment_ref, v_now, v_expires_at)
  RETURNING id INTO v_sub_id;

  -- Enregistrer dans le ledger des revenus plateforme
  INSERT INTO public.platform_revenue_ledger
    (source_type, source_id, amount_fcfa, description)
  VALUES (
    'subscription',
    v_sub_id,
    p_amount_fcfa,
    FORMAT('Abonnement %s — marchand %s via %s', UPPER(p_tier), p_merchant_id, p_method)
  );
END;
$$;

-- ================================================================
-- 7. Index sur recipient_phone pour la validation membre GreenFlame
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_vouchers_recipient_phone
  ON public.withdrawal_vouchers (recipient_phone)
  WHERE recipient_phone IS NOT NULL;

-- ================================================================
-- VÉRIFICATION
-- ================================================================
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'withdrawal_vouchers'
  AND column_name IN ('recipient_phone', 'fee_fcfa', 'merchant_fee_fcfa', 'greenflame_fee_fcfa')
ORDER BY column_name;
