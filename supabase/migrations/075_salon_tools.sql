-- ============================================================
-- 033_salon_tools.sql
-- Calculateur de rentabilité prestation — Coiffure/Beauté
-- ============================================================

-- Bibliothèque de produits du salon
CREATE TABLE IF NOT EXISTS public.salon_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'mL',
  package_quantity NUMERIC NOT NULL DEFAULT 1,
  package_cost_fcfa INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.salon_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salon_products_select" ON public.salon_products;
DROP POLICY IF EXISTS "salon_products_insert" ON public.salon_products;
DROP POLICY IF EXISTS "salon_products_update" ON public.salon_products;
DROP POLICY IF EXISTS "salon_products_delete" ON public.salon_products;

DROP POLICY IF EXISTS "salon_products_select" ON public.salon_products;
CREATE POLICY "salon_products_select" ON public.salon_products
  FOR SELECT USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "salon_products_insert" ON public.salon_products;
CREATE POLICY "salon_products_insert" ON public.salon_products
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "salon_products_update" ON public.salon_products;
CREATE POLICY "salon_products_update" ON public.salon_products
  FOR UPDATE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "salon_products_delete" ON public.salon_products;
CREATE POLICY "salon_products_delete" ON public.salon_products
  FOR DELETE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

-- Types de prestations
CREATE TABLE IF NOT EXISTS public.salon_prestations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  selling_price_fcfa INTEGER NOT NULL DEFAULT 0,
  duration_minutes INTEGER DEFAULT 60,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.salon_prestations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salon_prestations_select" ON public.salon_prestations;
DROP POLICY IF EXISTS "salon_prestations_insert" ON public.salon_prestations;
DROP POLICY IF EXISTS "salon_prestations_update" ON public.salon_prestations;
DROP POLICY IF EXISTS "salon_prestations_delete" ON public.salon_prestations;

DROP POLICY IF EXISTS "salon_prestations_select" ON public.salon_prestations;
CREATE POLICY "salon_prestations_select" ON public.salon_prestations
  FOR SELECT USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "salon_prestations_insert" ON public.salon_prestations;
CREATE POLICY "salon_prestations_insert" ON public.salon_prestations
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "salon_prestations_update" ON public.salon_prestations;
CREATE POLICY "salon_prestations_update" ON public.salon_prestations
  FOR UPDATE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "salon_prestations_delete" ON public.salon_prestations;
CREATE POLICY "salon_prestations_delete" ON public.salon_prestations
  FOR DELETE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

-- Produits utilisés par prestation (recettes)
CREATE TABLE IF NOT EXISTS public.salon_prestation_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  prestation_id UUID NOT NULL REFERENCES public.salon_prestations(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.salon_products(id) ON DELETE CASCADE,
  quantity_used NUMERIC NOT NULL DEFAULT 1,
  UNIQUE (prestation_id, product_id)
);

ALTER TABLE public.salon_prestation_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "salon_pp_select" ON public.salon_prestation_products;
DROP POLICY IF EXISTS "salon_pp_insert" ON public.salon_prestation_products;
DROP POLICY IF EXISTS "salon_pp_update" ON public.salon_prestation_products;
DROP POLICY IF EXISTS "salon_pp_delete" ON public.salon_prestation_products;

DROP POLICY IF EXISTS "salon_pp_select" ON public.salon_prestation_products;
CREATE POLICY "salon_pp_select" ON public.salon_prestation_products
  FOR SELECT USING (
    prestation_id IN (
      SELECT id FROM public.salon_prestations
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "salon_pp_insert" ON public.salon_prestation_products;
CREATE POLICY "salon_pp_insert" ON public.salon_prestation_products
  FOR INSERT WITH CHECK (
    prestation_id IN (
      SELECT id FROM public.salon_prestations
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "salon_pp_update" ON public.salon_prestation_products;
CREATE POLICY "salon_pp_update" ON public.salon_prestation_products
  FOR UPDATE USING (
    prestation_id IN (
      SELECT id FROM public.salon_prestations
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "salon_pp_delete" ON public.salon_prestation_products;
DROP POLICY IF EXISTS "salon_pp_delete" ON public.salon_prestation_products;
CREATE POLICY "salon_pp_delete" ON public.salon_prestation_products
  FOR DELETE USING (
    prestation_id IN (
      SELECT id FROM public.salon_prestations
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );

-- Indexes
CREATE INDEX IF NOT EXISTS idx_salon_products_merchant ON public.salon_products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_salon_prestations_merchant ON public.salon_prestations(merchant_id);
CREATE INDEX IF NOT EXISTS idx_salon_pp_prestation ON public.salon_prestation_products(prestation_id);
