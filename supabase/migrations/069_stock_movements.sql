-- ════════════════════════════════════════════════════════════════════════
-- Migration 069 — Mouvements de stock marchand
--
-- Objectif : tracer chaque entrée et sortie de stock pour les produits
-- des marchands. Jusqu'ici, stock_quantity sur la table products était
-- un chiffre statique mis à jour manuellement — impossible d'avoir
-- l'historique des mouvements, les raisons, ou d'automatiser les alertes.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID        NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  merchant_id   UUID        NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,

  -- Type de mouvement
  type          TEXT        NOT NULL
                CHECK (type IN (
                  'in',          -- approvisionnement / réception stock
                  'out',         -- vente manuelle (cash hors plateforme)
                  'adjustment',  -- correction d'inventaire
                  'loss'         -- perte / casse / vol
                )),

  quantity      INTEGER     NOT NULL,  -- positif pour in, négatif pour out/loss
  stock_after   INTEGER     NOT NULL,  -- stock résultant après ce mouvement

  -- Raison libre (ex: "Achat fournisseur Dantokpa", "Vente client en direct", "Inventaire mensuel")
  reason        TEXT,

  -- Lien optionnel à une transaction GreenFlame (pour les sorties auto)
  transaction_id UUID       REFERENCES public.transactions(id) ON DELETE SET NULL,

  created_by    UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seuil d'alerte stock bas par produit (optionnel, défaut NULL = pas d'alerte)
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_alert_threshold INTEGER DEFAULT NULL;

COMMENT ON COLUMN public.products.stock_alert_threshold IS
  'Seuil en dessous duquel une alerte stock bas est déclenchée. NULL = pas d''alerte configurée.';

-- Index
CREATE INDEX IF NOT EXISTS idx_stock_movements_product  ON public.stock_movements(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movements_merchant ON public.stock_movements(merchant_id, created_at DESC);

-- RLS
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchants manage own stock movements" ON public.stock_movements;
CREATE POLICY "merchants manage own stock movements" ON public.stock_movements
  FOR ALL
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "admin_read_stock_movements" ON public.stock_movements;
CREATE POLICY "admin_read_stock_movements" ON public.stock_movements
  FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND 'admin' = ANY(role)));
