-- ================================================================
-- Migration 009 : Décrémentation de stock sur vente
-- ================================================================

-- 1. Ajouter product_id (nullable) à transactions
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_product_id
  ON public.transactions(product_id)
  WHERE product_id IS NOT NULL;

-- 2. Trigger : décrémente stock quand la transaction passe à 'completed'
CREATE OR REPLACE FUNCTION public.decrement_product_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Seulement si : status → completed, product_id présent, stock géré (non NULL)
  IF NEW.status = 'completed'
     AND OLD.status IS DISTINCT FROM 'completed'
     AND NEW.product_id IS NOT NULL
  THEN
    UPDATE public.products
    SET
      stock_quantity = GREATEST(stock_quantity - 1, 0),
      is_available   = CASE
                         WHEN stock_quantity - 1 <= 0 THEN false
                         ELSE is_available
                       END
    WHERE id = NEW.product_id
      AND stock_quantity IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_stock ON public.transactions;
CREATE TRIGGER trg_decrement_stock
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_product_stock();

-- Aussi sur INSERT (paiements wallet_gf qui s'insèrent directement en 'completed')
CREATE OR REPLACE FUNCTION public.decrement_product_stock_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'completed' AND NEW.product_id IS NOT NULL THEN
    UPDATE public.products
    SET
      stock_quantity = GREATEST(stock_quantity - 1, 0),
      is_available   = CASE
                         WHEN stock_quantity - 1 <= 0 THEN false
                         ELSE is_available
                       END
    WHERE id = NEW.product_id
      AND stock_quantity IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_decrement_stock_insert ON public.transactions;
CREATE TRIGGER trg_decrement_stock_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_product_stock_insert();

-- ================================================================
-- VÉRIFICATION
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'transactions' AND column_name = 'product_id';
-- ================================================================
