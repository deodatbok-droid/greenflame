-- Migration 018 : Pool d'accumulation des frais marchands
-- Les frais (1%) s'accumulent par marchand dans ce pool.
-- Dès que le cumul atteint 10 FCFA, il est divisé en 2 parts égales :
--   floor(pool/2) → marchand (wallet)
--   floor(pool/2) → GreenFlame (platform_revenue_ledger)
-- Le FCFA résiduel (0 ou 1) reste en pool pour la transaction suivante.
-- Garantie : les deux parts sont toujours identiques, jamais de biais.
-- ================================================================

CREATE TABLE IF NOT EXISTS merchant_fee_accrual (
  merchant_id           UUID        PRIMARY KEY REFERENCES merchants(id) ON DELETE CASCADE,
  accrued_fcfa          BIGINT      NOT NULL DEFAULT 0 CHECK (accrued_fcfa >= 0),

  -- Métriques cumulées (audit)
  total_collected_fcfa  BIGINT      NOT NULL DEFAULT 0,   -- total frais reçus dans le pool
  total_disbursed_fcfa  BIGINT      NOT NULL DEFAULT 0,   -- total distribué (×2 = GF + marchand)
  disbursement_count    INTEGER     NOT NULL DEFAULT 0,   -- nombre de déclenchements pool

  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE merchant_fee_accrual IS
  'Pool d''accumulation des frais bons de retrait par marchand. Distribué 50/50 dès 10 FCFA.';

-- RLS : accès service_role uniquement (jamais exposé directement)
ALTER TABLE merchant_fee_accrual ENABLE ROW LEVEL SECURITY;
-- Aucune policy utilisateur — uniquement service_role (API routes)

-- Index déjà couvert par la PK sur merchant_id
