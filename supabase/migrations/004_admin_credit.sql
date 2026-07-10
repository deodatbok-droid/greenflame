-- ================================================================
-- 004 — Admin wallet credit tool
-- Apply after 001, 002, 003
-- ================================================================

-- Add admin_credit to the wallet_ledger transaction_type check
ALTER TABLE public.wallet_ledger
  DROP CONSTRAINT IF EXISTS wallet_ledger_transaction_type_check;

ALTER TABLE public.wallet_ledger
  ADD CONSTRAINT wallet_ledger_transaction_type_check CHECK (
    transaction_type IN (
      'cashback', 'commission_network', 'platform_fee',
      'mobile_money_deposit', 'mobile_money_withdrawal',
      'purchase_payment', 'pgf_conversion', 'spillover', 'refund',
      'admin_credit'
    )
  ) NOT VALID;

-- wallet_credit: SECURITY DEFINER function callable by admins via service role
CREATE OR REPLACE FUNCTION public.wallet_credit(
  p_user_id     UUID,
  p_amount_fcfa BIGINT DEFAULT 0,
  p_amount_pgf  BIGINT DEFAULT 0,
  p_reason      TEXT   DEFAULT 'admin_credit'
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet_id  UUID;
  v_fcfa_after BIGINT := 0;
  v_pgf_after  BIGINT := 0;
BEGIN
  SELECT id INTO v_wallet_id FROM public.wallets WHERE user_id = p_user_id;
  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet introuvable pour l''utilisateur %', p_user_id;
  END IF;

  IF p_amount_fcfa > 0 THEN
    UPDATE public.wallets
    SET
      balance_fcfa      = balance_fcfa + p_amount_fcfa,
      total_earned_fcfa = total_earned_fcfa + p_amount_fcfa,
      updated_at        = NOW()
    WHERE id = v_wallet_id
    RETURNING balance_fcfa INTO v_fcfa_after;

    INSERT INTO public.wallet_ledger
      (wallet_id, amount, currency_type, transaction_type, balance_after)
    VALUES
      (v_wallet_id, p_amount_fcfa, 'fcfa', 'admin_credit', v_fcfa_after);
  END IF;

  IF p_amount_pgf > 0 THEN
    UPDATE public.wallets
    SET
      balance_pgf = balance_pgf + p_amount_pgf,
      updated_at  = NOW()
    WHERE id = v_wallet_id
    RETURNING balance_pgf INTO v_pgf_after;
  END IF;

  RETURN jsonb_build_object(
    'ok',          true,
    'balance_fcfa', COALESCE(v_fcfa_after, (SELECT balance_fcfa FROM public.wallets WHERE id = v_wallet_id)),
    'balance_pgf',  COALESCE(v_pgf_after,  (SELECT balance_pgf  FROM public.wallets WHERE id = v_wallet_id))
  );
END;
$$;

-- Allow the service role to call it (anon/authenticated cannot)
REVOKE ALL ON FUNCTION public.wallet_credit(UUID, BIGINT, BIGINT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.wallet_credit(UUID, BIGINT, BIGINT, TEXT) TO service_role;
