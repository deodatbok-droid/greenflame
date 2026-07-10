-- 044_couture_v2.sql
-- Accessoires catalog + per-commande accessories + urgent/etape on commandes

-- 1. Catalogue d'accessoires du tailleur
CREATE TABLE IF NOT EXISTS couture_accessoires (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id      UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  unit             TEXT NOT NULL DEFAULT 'pièce',
  price_per_unit_fcfa INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE couture_accessoires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchant owns their accessoires" ON couture_accessoires;
CREATE POLICY "Merchant owns their accessoires"
  ON couture_accessoires FOR ALL
  USING  (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- 2. Détail des accessoires par commande
CREATE TABLE IF NOT EXISTS couture_commande_accessoires (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commande_id             UUID NOT NULL REFERENCES couture_commandes(id) ON DELETE CASCADE,
  accessoire_id           UUID REFERENCES couture_accessoires(id) ON DELETE SET NULL,
  name_snapshot           TEXT NOT NULL,
  prix_unitaire_snapshot  INTEGER NOT NULL DEFAULT 0,
  quantite                INTEGER NOT NULL DEFAULT 1
);

ALTER TABLE couture_commande_accessoires ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Merchant owns their commande accessoires" ON couture_commande_accessoires;
CREATE POLICY "Merchant owns their commande accessoires"
  ON couture_commande_accessoires FOR ALL
  USING (
    commande_id IN (
      SELECT id FROM couture_commandes
      WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    commande_id IN (
      SELECT id FROM couture_commandes
      WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    )
  );

-- 3. Ajout colonnes urgent + etape sur couture_commandes
ALTER TABLE couture_commandes
  ADD COLUMN IF NOT EXISTS urgent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS etape  TEXT CHECK (etape IN ('mesures', 'coupe', 'couture', 'finitions'));
