-- ================================================================
-- GREENFLAME — Migration 007 : Séparation wallet perso / wallet marchand
-- ================================================================
-- wallet perso (wallets)   : cashback, commissions réseau, PGF
-- wallet boutique (merchant_wallets) : revenus ventes, float agent
-- ================================================================

-- ================================================================
-- 1. TABLE merchant_wallets (solde professionnel du marchand)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.merchant_wallets (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id          UUID UNIQUE NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  balance_fcfa         BIGINT DEFAULT 0 CHECK (balance_fcfa >= 0),
  locked_balance       BIGINT DEFAULT 0 CHECK (locked_balance >= 0),
  total_earned_fcfa    BIGINT DEFAULT 0,    -- cumul des revenus nets reçus
  total_withdrawn_fcfa BIGINT DEFAULT 0,    -- cumul des retraits effectués
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 2. TABLE merchant_wallet_ledger (journal immuable — append-only)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.merchant_wallet_ledger (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_wallet_id UUID NOT NULL REFERENCES public.merchant_wallets(id),
  amount             BIGINT NOT NULL,         -- + crédit, - débit
  transaction_type   VARCHAR(50) NOT NULL CHECK (
    transaction_type IN (
      'sale_revenue',          -- revenu net d'une vente (montant - commission)
      'agent_deposit_out',     -- dépôt agent : marchand crédite un client (débit wallet marchand)
      'agent_withdrawal_in',   -- retrait agent : client remet son wallet (crédit wallet marchand)
      'merchant_withdrawal',   -- retrait marchand vers MoMo
      'admin_adjustment'       -- correction admin
    )
  ),
  reference_id       UUID,                    -- transaction_id ou autre
  balance_after      BIGINT NOT NULL,
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- 3. Trigger : auto-créer un merchant_wallet à l'inscription du marchand
-- ================================================================
CREATE OR REPLACE FUNCTION public.create_merchant_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.merchant_wallets (merchant_id)
  VALUES (NEW.id)
  ON CONFLICT (merchant_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS merchant_created_create_wallet ON public.merchants;
CREATE TRIGGER merchant_created_create_wallet
  AFTER INSERT ON public.merchants
  FOR EACH ROW EXECUTE FUNCTION public.create_merchant_wallet();

-- Rétro-remplissage pour les marchands déjà existants
INSERT INTO public.merchant_wallets (merchant_id)
SELECT id FROM public.merchants
ON CONFLICT (merchant_id) DO NOTHING;

-- ================================================================
-- 4. Trigger : updated_at automatique
-- ================================================================
CREATE OR REPLACE FUNCTION public.update_merchant_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS merchant_wallet_updated_at_trigger ON public.merchant_wallets;
CREATE TRIGGER merchant_wallet_updated_at_trigger
  BEFORE UPDATE ON public.merchant_wallets
  FOR EACH ROW EXECUTE FUNCTION public.update_merchant_wallet_updated_at();

-- ================================================================
-- 5. Indexes
-- ================================================================
CREATE INDEX IF NOT EXISTS idx_merchant_wallets_merchant
  ON public.merchant_wallets(merchant_id);

CREATE INDEX IF NOT EXISTS idx_merchant_wallet_ledger_wallet
  ON public.merchant_wallet_ledger(merchant_wallet_id);

CREATE INDEX IF NOT EXISTS idx_merchant_wallet_ledger_created
  ON public.merchant_wallet_ledger(created_at DESC);

-- ================================================================
-- 6. RLS — merchant_wallets
-- ================================================================
ALTER TABLE public.merchant_wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_wallets_select_own" ON public.merchant_wallets;
CREATE POLICY "merchant_wallets_select_own" ON public.merchant_wallets
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "merchant_wallets_select_admin" ON public.merchant_wallets;
CREATE POLICY "merchant_wallets_select_admin" ON public.merchant_wallets
  FOR SELECT USING (public.is_admin() OR public.is_platform_upline());

DROP POLICY IF EXISTS "merchant_wallets_update_service" ON public.merchant_wallets;
CREATE POLICY "merchant_wallets_update_service" ON public.merchant_wallets
  FOR UPDATE USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "merchant_wallets_insert_service" ON public.merchant_wallets;
CREATE POLICY "merchant_wallets_insert_service" ON public.merchant_wallets
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- 7. RLS — merchant_wallet_ledger (append-only, no UPDATE/DELETE)
-- ================================================================
ALTER TABLE public.merchant_wallet_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_wallet_ledger_select_own" ON public.merchant_wallet_ledger;
CREATE POLICY "merchant_wallet_ledger_select_own" ON public.merchant_wallet_ledger
  FOR SELECT USING (
    merchant_wallet_id IN (
      SELECT mw.id FROM public.merchant_wallets mw
      JOIN public.merchants m ON mw.merchant_id = m.id
      WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "merchant_wallet_ledger_select_admin" ON public.merchant_wallet_ledger;
CREATE POLICY "merchant_wallet_ledger_select_admin" ON public.merchant_wallet_ledger
  FOR SELECT USING (public.is_admin() OR public.is_platform_upline());

DROP POLICY IF EXISTS "merchant_wallet_ledger_insert_service" ON public.merchant_wallet_ledger;
CREATE POLICY "merchant_wallet_ledger_insert_service" ON public.merchant_wallet_ledger
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- 8. Mettre à jour la contrainte wallet_ledger pour les opérations agent côté client
--    (les types côté marchand sont dans merchant_wallet_ledger)
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
      'agent_deposit_in',      -- client reçoit du cash de l'agent (crédit wallet perso)
      'agent_withdrawal_out',  -- client donne son wallet à l'agent (débit wallet perso)
      'wallet_gf_payment'      -- paiement via wallet GreenFlame (débit wallet perso acheteur)
    )
  ) NOT VALID;

-- ================================================================
-- 9. Fonction RPC : créditer le wallet boutique (service_role uniquement)
-- ================================================================
CREATE OR REPLACE FUNCTION public.merchant_wallet_credit(
  p_merchant_id    UUID,
  p_amount_fcfa    BIGINT,
  p_type           TEXT DEFAULT 'sale_revenue',
  p_reference_id   UUID DEFAULT NULL,
  p_notes          TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id   UUID;
  v_balance_after BIGINT;
BEGIN
  SELECT id INTO v_wallet_id FROM public.merchant_wallets WHERE merchant_id = p_merchant_id;
  IF v_wallet_id IS NULL THEN
    -- Auto-créer si le trigger n'a pas encore tourné
    INSERT INTO public.merchant_wallets (merchant_id) VALUES (p_merchant_id)
    RETURNING id INTO v_wallet_id;
  END IF;

  UPDATE public.merchant_wallets
  SET
    balance_fcfa      = balance_fcfa + p_amount_fcfa,
    total_earned_fcfa = total_earned_fcfa + p_amount_fcfa,
    updated_at        = NOW()
  WHERE id = v_wallet_id
  RETURNING balance_fcfa INTO v_balance_after;

  INSERT INTO public.merchant_wallet_ledger
    (merchant_wallet_id, amount, transaction_type, reference_id, balance_after, notes)
  VALUES
    (v_wallet_id, p_amount_fcfa, p_type, p_reference_id, v_balance_after, p_notes);

  RETURN jsonb_build_object('ok', true, 'balance_fcfa', v_balance_after);
END;
$$;

REVOKE ALL ON FUNCTION public.merchant_wallet_credit FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merchant_wallet_credit TO service_role;

-- ================================================================
-- VÉRIFICATION
-- ================================================================
SELECT 'merchant_wallets' AS table_name, count(*) AS rows FROM public.merchant_wallets
UNION ALL
SELECT 'merchant_wallet_ledger', count(*) FROM public.merchant_wallet_ledger;
