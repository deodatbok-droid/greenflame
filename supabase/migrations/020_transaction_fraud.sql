-- Migration 020 : Analyse de fraude IA sur les transactions
-- Claude Opus analyse chaque transaction après sa création (non-bloquant).
-- L'admin voit les alertes rouge/orange dans le tableau de bord transactions.
-- ================================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS fraud_score     NUMERIC(4,3)
    CHECK (fraud_score >= 0 AND fraud_score <= 1),

  ADD COLUMN IF NOT EXISTS fraud_level     VARCHAR(10)
    CHECK (fraud_level IN ('low', 'medium', 'high')),

  ADD COLUMN IF NOT EXISTS fraud_flags     TEXT[],        -- règles déclenchées

  ADD COLUMN IF NOT EXISTS fraud_narrative TEXT,          -- explication Claude en français

  ADD COLUMN IF NOT EXISTS fraud_reviewed  BOOLEAN NOT NULL DEFAULT FALSE,

  ADD COLUMN IF NOT EXISTS fraud_analyzed_at TIMESTAMPTZ;

-- Index rapide pour filtrer les transactions suspectes
CREATE INDEX IF NOT EXISTS idx_transactions_fraud_high
  ON public.transactions (fraud_level, created_at DESC)
  WHERE fraud_level IN ('medium', 'high');

CREATE INDEX IF NOT EXISTS idx_transactions_fraud_unreviewed
  ON public.transactions (fraud_reviewed, fraud_level, created_at DESC)
  WHERE fraud_level IN ('medium', 'high') AND NOT fraud_reviewed;

COMMENT ON COLUMN public.transactions.fraud_score IS
  'Score de risque fraude (0.000 = sans risque, 1.000 = certain)';
COMMENT ON COLUMN public.transactions.fraud_level IS
  'Niveau de risque : low | medium | high';
COMMENT ON COLUMN public.transactions.fraud_flags IS
  'Règles IA déclenchées : AMOUNT_SPIKE, HIGH_VELOCITY, NEW_ACCOUNT_BIG_TX, etc.';
COMMENT ON COLUMN public.transactions.fraud_narrative IS
  'Explication Claude en français pour l''admin';
