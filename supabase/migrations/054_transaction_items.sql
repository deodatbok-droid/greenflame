-- ================================================================
-- Migration 054 — Lignes de commande panier
-- Table : transaction_items
-- Stocke le détail article par article pour les commandes passées
-- via le panier multi-produits.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.transaction_items (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID        NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  product_id      UUID        REFERENCES public.products(id) ON DELETE SET NULL,
  product_name    TEXT        NOT NULL,
  quantity        INTEGER     NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price_fcfa INTEGER     NOT NULL CHECK (unit_price_fcfa >= 0),
  emoji           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transaction_items_tx
  ON public.transaction_items(transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_items_product
  ON public.transaction_items(product_id);

ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

-- L'acheteur voit ses propres lignes (via la transaction)
DROP POLICY IF EXISTS "tx_items_select_buyer" ON public.transaction_items;
CREATE POLICY "tx_items_select_buyer" ON public.transaction_items
  FOR SELECT TO authenticated
  USING (
    transaction_id IN (
      SELECT id FROM public.transactions WHERE buyer_id = auth.uid()
    )
  );

-- Le marchand voit les lignes des transactions qui le concernent
DROP POLICY IF EXISTS "tx_items_select_merchant" ON public.transaction_items;
CREATE POLICY "tx_items_select_merchant" ON public.transaction_items
  FOR SELECT TO authenticated
  USING (
    transaction_id IN (
      SELECT t.id FROM public.transactions t
      JOIN public.merchants m ON m.id = t.merchant_id
      WHERE m.user_id = auth.uid()
    )
  );

-- Seul le service role peut insérer (via API cart/checkout)
DROP POLICY IF EXISTS "tx_items_insert_service" ON public.transaction_items;
CREATE POLICY "tx_items_insert_service" ON public.transaction_items
  FOR INSERT TO authenticated
  WITH CHECK (
    transaction_id IN (
      SELECT id FROM public.transactions WHERE buyer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "tx_items_admin_all" ON public.transaction_items;
CREATE POLICY "tx_items_admin_all" ON public.transaction_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- Ajouter marketplace_product_id à pack_catalog si absent
ALTER TABLE public.pack_catalog
  ADD COLUMN IF NOT EXISTS marketplace_product_id UUID
  REFERENCES public.products(id) ON DELETE SET NULL;
