-- ================================================================
-- Migration 008 : Retraits wallet boutique (merchant_wallets)
-- ================================================================
-- Étend withdrawal_requests pour couvrir à la fois :
--   source = 'personal' → retrait depuis wallets (perso)
--   source = 'merchant' → retrait depuis merchant_wallets (boutique)
-- ================================================================

-- 1. Étendre la table withdrawal_requests
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS source      TEXT DEFAULT 'personal'
    CHECK (source IN ('personal', 'merchant')),
  ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.merchants(id);

-- 2. Index pour filtrage admin
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_source
  ON public.withdrawal_requests(source);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_merchant
  ON public.withdrawal_requests(merchant_id)
  WHERE merchant_id IS NOT NULL;

-- 3. Fonction RPC : créer une demande de retrait depuis merchant_wallets
--    Débite merchant_wallets atomiquement et crée la demande.
CREATE OR REPLACE FUNCTION public.request_merchant_withdrawal(
  p_merchant_id  UUID,
  p_amount_fcfa  BIGINT,
  p_operator     TEXT,
  p_phone        TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id     UUID;
  v_balance       BIGINT;
  v_balance_after BIGINT;
  v_request_id    UUID;
  v_merchant_uid  UUID;
BEGIN
  -- Récupérer le wallet boutique
  SELECT id, balance_fcfa INTO v_wallet_id, v_balance
  FROM public.merchant_wallets
  WHERE merchant_id = p_merchant_id;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet boutique introuvable';
  END IF;

  IF v_balance < p_amount_fcfa THEN
    RAISE EXCEPTION 'Solde insuffisant : % FCFA disponibles', v_balance;
  END IF;

  -- Récupérer user_id du marchand (pour withdrawal_requests)
  SELECT user_id INTO v_merchant_uid
  FROM public.merchants WHERE id = p_merchant_id;

  -- Débit atomique merchant_wallets
  v_balance_after := v_balance - p_amount_fcfa;
  UPDATE public.merchant_wallets
  SET
    balance_fcfa         = v_balance_after,
    total_withdrawn_fcfa = total_withdrawn_fcfa + p_amount_fcfa,
    updated_at           = NOW()
  WHERE id = v_wallet_id;

  -- Entrée ledger boutique
  INSERT INTO public.merchant_wallet_ledger
    (merchant_wallet_id, amount, transaction_type, balance_after, notes)
  VALUES
    (v_wallet_id, -p_amount_fcfa, 'merchant_withdrawal', v_balance_after,
     'Demande de retrait vers ' || p_operator || ' — ' || p_phone);

  -- Créer la demande de retrait
  INSERT INTO public.withdrawal_requests
    (user_id, amount_fcfa, currency_type, operator, phone, status, source, merchant_id)
  VALUES
    (v_merchant_uid, p_amount_fcfa, 'fcfa', p_operator, p_phone, 'pending', 'merchant', p_merchant_id)
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_merchant_withdrawal FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_merchant_withdrawal TO authenticated, service_role;

-- ================================================================
-- VÉRIFICATION
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'withdrawal_requests'
  AND column_name IN ('source', 'merchant_id');
-- ================================================================
