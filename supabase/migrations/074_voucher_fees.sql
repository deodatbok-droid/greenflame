-- Migration 017 : Frais et destinataire sur les bons de retrait
-- + Table platform_revenue_ledger pour les revenus plateforme
-- ================================================================

-- 1. Nouvelles colonnes sur withdrawal_vouchers
-- -----------------------------------------------

-- Numéro du destinataire autorisé (optionnel — vérification côté marchand)
ALTER TABLE withdrawal_vouchers
  ADD COLUMN IF NOT EXISTS recipient_phone VARCHAR(20);

-- Détail des frais à l'encaissement (1% total)
ALTER TABLE withdrawal_vouchers
  ADD COLUMN IF NOT EXISTS fee_fcfa BIGINT NOT NULL DEFAULT 0;

ALTER TABLE withdrawal_vouchers
  ADD COLUMN IF NOT EXISTS merchant_fee_fcfa BIGINT NOT NULL DEFAULT 0;

ALTER TABLE withdrawal_vouchers
  ADD COLUMN IF NOT EXISTS greenflame_fee_fcfa BIGINT NOT NULL DEFAULT 0;

-- Index pour chercher par destinataire
CREATE INDEX IF NOT EXISTS idx_vouchers_recipient_phone
  ON withdrawal_vouchers (recipient_phone)
  WHERE recipient_phone IS NOT NULL;

-- 2. Table platform_revenue_ledger
-- -----------------------------------------------
-- Traçabilité des revenus GreenFlame (frais bons de retrait, abonnements, etc.)
CREATE TABLE IF NOT EXISTS platform_revenue_ledger (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type  VARCHAR(50) NOT NULL,    -- 'voucher_fee', 'subscription', 'commission_platform', etc.
  source_id    UUID,                    -- référence à la transaction/bon d'origine
  amount_fcfa  BIGINT      NOT NULL CHECK (amount_fcfa > 0),
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_type
  ON platform_revenue_ledger (source_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_platform_revenue_created
  ON platform_revenue_ledger (created_at DESC);

-- RLS : seuls les admins lisent (service_role écrit)
ALTER TABLE platform_revenue_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_read_platform_revenue" ON platform_revenue_ledger;
CREATE POLICY "admins_read_platform_revenue"
  ON platform_revenue_ledger FOR SELECT
  USING (public.is_admin() OR public.is_platform_upline());

COMMENT ON TABLE platform_revenue_ledger IS
  'Revenus GreenFlame : frais bons de retrait (0,5%), abonnements marchands, etc.';
