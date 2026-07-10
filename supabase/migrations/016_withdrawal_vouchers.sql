-- Migration 016 : Bons de retrait (withdrawal vouchers)
-- Permet à un utilisateur de créer un bon qu'un tiers peut encaisser
-- chez un marchand GreenFlame (cash-out). Pas un transfert P2P direct.

CREATE TABLE IF NOT EXISTS withdrawal_vouchers (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Émetteur
  sender_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_fcfa         BIGINT      NOT NULL CHECK (amount_fcfa >= 500),

  -- Code de retrait partagé avec le bénéficiaire
  code                VARCHAR(12) NOT NULL UNIQUE,   -- ex: GF-A7K2M9X3

  -- Statut
  status              TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'redeemed', 'expired', 'cancelled')),

  -- Encaissement
  redeemed_by_merchant_id UUID    REFERENCES merchants(id) ON DELETE SET NULL,
  redeemed_at         TIMESTAMPTZ,

  -- Métadonnées
  note                TEXT,                          -- message optionnel de l''émetteur
  expires_at          TIMESTAMPTZ NOT NULL,          -- défaut 48h après création
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour lookup rapide par code (merchant dashboard)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vouchers_code
  ON withdrawal_vouchers (code);

-- Index pour historique par émetteur
CREATE INDEX IF NOT EXISTS idx_vouchers_sender
  ON withdrawal_vouchers (sender_id, created_at DESC);

-- Index pour historique par marchand
CREATE INDEX IF NOT EXISTS idx_vouchers_merchant
  ON withdrawal_vouchers (redeemed_by_merchant_id, redeemed_at DESC);

-- Index pour nettoyage des bons expirés
CREATE INDEX IF NOT EXISTS idx_vouchers_expires
  ON withdrawal_vouchers (status, expires_at)
  WHERE status = 'active';

-- RLS : chaque utilisateur voit uniquement ses propres bons
ALTER TABLE withdrawal_vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sender_sees_own_vouchers" ON withdrawal_vouchers;
CREATE POLICY "sender_sees_own_vouchers"
  ON withdrawal_vouchers FOR SELECT
  USING (auth.uid() = sender_id);

DROP POLICY IF EXISTS "sender_creates_vouchers" ON withdrawal_vouchers;
CREATE POLICY "sender_creates_vouchers"
  ON withdrawal_vouchers FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Annulation : uniquement si statut active
DROP POLICY IF EXISTS "sender_cancels_own_vouchers" ON withdrawal_vouchers;
CREATE POLICY "sender_cancels_own_vouchers"
  ON withdrawal_vouchers FOR UPDATE
  USING (auth.uid() = sender_id AND status = 'active');

-- Marchands et admins accèdent via service_role (API routes)

COMMENT ON TABLE withdrawal_vouchers IS
  'Bons de retrait cash : l''émetteur réserve des fonds, le bénéficiaire les retire chez un marchand.';

-- ================================================================
-- Étendre le CHECK sur wallet_ledger.transaction_type
-- pour les nouvelles opérations voucher
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
      'voucher_reserve',       -- émetteur crée un bon (débit)
      'voucher_redemption',    -- marchand encaisse un bon (crédit)
      'voucher_cancel'         -- émetteur annule un bon (recrédit)
    )
  ) NOT VALID;
