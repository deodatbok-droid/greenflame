-- ══════════════════════════════════════════════════════════════════════
-- 030 — Float tracking & réconciliation manuelle
-- ══════════════════════════════════════════════════════════════════════

-- Table principale : chaque encaissement déclaré par l'admin
CREATE TABLE IF NOT EXISTS float_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type    TEXT NOT NULL CHECK (entry_type IN (
                  'cash_collected',    -- Cash reçu physiquement d'un marchand
                  'mtn_momo',          -- Dépôt confirmé depuis compte MTN Business
                  'moov_money',        -- Dépôt confirmé depuis compte Moov Business
                  'celtiis',           -- Dépôt confirmé depuis compte Celtiis Business
                  'adjustment_plus',   -- Correction positive (écart de comptage, etc.)
                  'adjustment_minus'   -- Correction négative
                )),
  amount_fcfa   INTEGER NOT NULL CHECK (amount_fcfa > 0),
  operator_ref  TEXT,                              -- Référence MoMo ou numéro de reçu
  merchant_id   UUID REFERENCES merchants(id) ON DELETE SET NULL,
  notes         TEXT,
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  recorded_by   UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_float_entries_date     ON float_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_float_entries_merchant ON float_entries(merchant_id);
CREATE INDEX IF NOT EXISTS idx_float_entries_type     ON float_entries(entry_type);

ALTER TABLE float_entries ENABLE ROW LEVEL SECURITY;

-- Seuls les admins et platform_upline peuvent lire/écrire
DROP POLICY IF EXISTS float_entries_admin ON float_entries;
CREATE POLICY float_entries_admin ON float_entries
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND (u.role::text ILIKE '%admin%' OR u.role::text ILIKE '%platform_upline%')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
        AND (u.role::text ILIKE '%admin%' OR u.role::text ILIKE '%platform_upline%')
    )
  );

-- ── Colonnes de suivi sur transactions ────────────────────────────────
-- Permet de savoir quelles transactions cash ont été physiquement collectées
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS float_collected     BOOLEAN     NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS float_collected_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS float_entry_id      UUID REFERENCES float_entries(id) ON DELETE SET NULL;

-- Index partiel pour requêtes rapides sur le cash non collecté
CREATE INDEX IF NOT EXISTS idx_transactions_uncollected_cash
  ON transactions(merchant_id, created_at)
  WHERE float_collected = FALSE AND payment_method = 'cash_confirmed';
