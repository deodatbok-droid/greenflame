-- Migration 005: Rapports analytiques IA marchands
-- Applique dans Supabase SQL Editor après 004

CREATE TABLE IF NOT EXISTS merchant_reports (
  id                 uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id        uuid        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  period_date        date        NOT NULL,           -- Premier jour du mois du rapport (ex: 2026-07-01)
  generated_at       timestamptz NOT NULL DEFAULT now(),
  generated_by       text        NOT NULL DEFAULT 'manual',  -- 'manual' | 'cron'
  summary            text,
  highlights         jsonb       NOT NULL DEFAULT '[]',      -- Points forts
  improvements       jsonb       NOT NULL DEFAULT '[]',      -- Axes d'amélioration
  recommendations    jsonb       NOT NULL DEFAULT '[]',      -- Recommandations
  risk_level         text        NOT NULL DEFAULT 'normal'
                       CHECK (risk_level IN ('normal', 'attention', 'alert')),
  metrics_snapshot   jsonb,
  CONSTRAINT merchant_reports_uniq UNIQUE (merchant_id, period_date)
);

ALTER TABLE merchant_reports ENABLE ROW LEVEL SECURITY;

-- Le marchand peut lire ses propres rapports
CREATE POLICY "merchant_reports_select_own" ON merchant_reports
  FOR SELECT USING (
    merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );

-- Index pour les lectures fréquentes
CREATE INDEX IF NOT EXISTS idx_merchant_reports_merchant_period
  ON merchant_reports (merchant_id, period_date DESC);
