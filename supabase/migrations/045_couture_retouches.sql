-- Migration 045 : Suivi des retouches par commande couture
-- Chaque retouche enregistre : ce qui a été demandé/fait, par qui,
-- les implications (temps, tissu), le coût supplémentaire et le statut.

CREATE TABLE IF NOT EXISTS couture_retouches (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id               UUID        NOT NULL REFERENCES couture_commandes(id) ON DELETE CASCADE,
  merchant_id               UUID        NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  description               TEXT        NOT NULL,
  demandeur                 TEXT        NOT NULL DEFAULT 'client',  -- 'client' | 'tailleur' | 'necessaire'
  implications              TEXT,
  cout_supplementaire_fcfa  INTEGER     NOT NULL DEFAULT 0,
  statut                    TEXT        NOT NULL DEFAULT 'en_cours', -- 'en_cours' | 'faite'
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE couture_retouches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_retouches_access" ON couture_retouches;
CREATE POLICY "merchant_retouches_access" ON couture_retouches
  FOR ALL TO authenticated
  USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  )
  WITH CHECK (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS couture_retouches_commande_idx ON couture_retouches(commande_id);
CREATE INDEX IF NOT EXISTS couture_retouches_merchant_idx ON couture_retouches(merchant_id);
