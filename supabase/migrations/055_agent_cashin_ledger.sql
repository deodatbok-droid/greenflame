-- Migration 055 : ajouter les types agent_cashin_debit et agent_cashin_credit
-- dans la contrainte CHECK de wallet_ledger.transaction_type

ALTER TABLE public.wallet_ledger
  DROP CONSTRAINT IF EXISTS wallet_ledger_transaction_type_check;

ALTER TABLE public.wallet_ledger
  ADD CONSTRAINT wallet_ledger_transaction_type_check
  CHECK (transaction_type IN (
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
    'agent_cashin_debit',
    'agent_cashin_credit'
  )) NOT VALID;
