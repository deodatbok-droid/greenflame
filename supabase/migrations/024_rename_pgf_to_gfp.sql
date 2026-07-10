-- ================================================================
-- Migration 024 : Renommage PGF → GFP (GreenFlame Points)
-- ================================================================

-- 1. Renommer balance_pgf → balance_gfp dans wallets (si pas déjà fait)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='wallets' AND column_name='balance_pgf') THEN
    ALTER TABLE public.wallets RENAME COLUMN balance_pgf TO balance_gfp;
  END IF;
END $$;

-- 2. Mettre à jour la contrainte CHECK sur balance_gfp
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_balance_pgf_check;
ALTER TABLE public.wallets DROP CONSTRAINT IF EXISTS wallets_balance_gfp_check;
ALTER TABLE public.wallets ADD CONSTRAINT wallets_balance_gfp_check CHECK (balance_gfp >= 0);

-- 3. Renommer is_pgf → is_gfp dans commission_distributions (si pas déjà fait)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='commission_distributions' AND column_name='is_pgf') THEN
    ALTER TABLE public.commission_distributions RENAME COLUMN is_pgf TO is_gfp;
  END IF;
END $$;

-- 4. wallet_ledger currency_type : passer pgf → gfp
ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_currency_type_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_currency_type_check CHECK (currency_type IN ('fcfa', 'gfp'));
UPDATE public.wallet_ledger SET currency_type = 'gfp' WHERE currency_type = 'pgf';

-- 5. wallet_ledger transaction_type : pgf_conversion → gfp_conversion
ALTER TABLE public.wallet_ledger DROP CONSTRAINT IF EXISTS wallet_ledger_transaction_type_check;
ALTER TABLE public.wallet_ledger ADD CONSTRAINT wallet_ledger_transaction_type_check
  CHECK (transaction_type IN (
    'cashback','commission_network','platform_fee','mobile_money_deposit','mobile_money_withdrawal',
    'wallet_gf_payment','purchase_payment','gfp_conversion','spillover','refund',
    'admin_credit','agent_deposit_in','agent_deposit_out'
  )) NOT VALID;
UPDATE public.wallet_ledger SET transaction_type = 'gfp_conversion' WHERE transaction_type = 'pgf_conversion';

-- 6. Renommer pgf_ledger → gfp_ledger (si elle existe)
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'pgf_ledger' AND table_schema = 'public') THEN
    ALTER TABLE public.pgf_ledger RENAME TO gfp_ledger;
  END IF;
END $$;

-- 7. Vue wallet_summary
DROP VIEW IF EXISTS public.wallet_summary CASCADE;
CREATE OR REPLACE VIEW public.wallet_summary AS
  SELECT w.user_id, w.balance_fcfa, w.balance_gfp, w.total_earned_fcfa, w.total_spent_fcfa, w.updated_at
  FROM public.wallets w;
GRANT SELECT ON public.wallet_summary TO authenticated;

-- 8. Recalculer total_earned_fcfa
UPDATE public.wallets w
SET total_earned_fcfa = COALESCE((
  SELECT SUM(cd.amount_fcfa) FROM public.commission_distributions cd
  WHERE cd.recipient_id = w.user_id AND cd.distribution_type IN ('cashback', 'network')
), 0);