-- Migration 035 — Calculateur de recettes & devis traiteur (Restauration)
-- Tables: resto_ingredients, resto_recettes, resto_recette_ingredients

-- ── Table ingrédients ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resto_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  price_per_unit_fcfa NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.resto_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resto_ingredients_select" ON public.resto_ingredients;
DROP POLICY IF EXISTS "resto_ingredients_insert" ON public.resto_ingredients;
DROP POLICY IF EXISTS "resto_ingredients_update" ON public.resto_ingredients;
DROP POLICY IF EXISTS "resto_ingredients_delete" ON public.resto_ingredients;

DROP POLICY IF EXISTS "resto_ingredients_select" ON public.resto_ingredients;
CREATE POLICY "resto_ingredients_select" ON public.resto_ingredients
  FOR SELECT USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_ingredients_insert" ON public.resto_ingredients;
CREATE POLICY "resto_ingredients_insert" ON public.resto_ingredients
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_ingredients_update" ON public.resto_ingredients;
CREATE POLICY "resto_ingredients_update" ON public.resto_ingredients
  FOR UPDATE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_ingredients_delete" ON public.resto_ingredients;
CREATE POLICY "resto_ingredients_delete" ON public.resto_ingredients
  FOR DELETE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_resto_ingredients_merchant ON public.resto_ingredients(merchant_id);

-- ── Table recettes ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resto_recettes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  portions INTEGER NOT NULL DEFAULT 1,
  selling_price_per_portion_fcfa INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'plat',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.resto_recettes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resto_recettes_select" ON public.resto_recettes;
DROP POLICY IF EXISTS "resto_recettes_insert" ON public.resto_recettes;
DROP POLICY IF EXISTS "resto_recettes_update" ON public.resto_recettes;
DROP POLICY IF EXISTS "resto_recettes_delete" ON public.resto_recettes;

DROP POLICY IF EXISTS "resto_recettes_select" ON public.resto_recettes;
CREATE POLICY "resto_recettes_select" ON public.resto_recettes
  FOR SELECT USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_recettes_insert" ON public.resto_recettes;
CREATE POLICY "resto_recettes_insert" ON public.resto_recettes
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_recettes_update" ON public.resto_recettes;
DROP POLICY IF EXISTS "resto_recettes_update" ON public.resto_recettes;
CREATE POLICY "resto_recettes_update" ON public.resto_recettes
  FOR UPDATE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_recettes_delete" ON public.resto_recettes;
DROP POLICY IF EXISTS "resto_recettes_delete" ON public.resto_recettes;
CREATE POLICY "resto_recettes_delete" ON public.resto_recettes
  FOR DELETE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_resto_recettes_merchant ON public.resto_recettes(merchant_id);

-- ── Table liaison recette ↔ ingrédients ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resto_recette_ingredients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  recette_id UUID NOT NULL REFERENCES public.resto_recettes(id) ON DELETE CASCADE,
  ingredient_id UUID NOT NULL REFERENCES public.resto_ingredients(id) ON DELETE CASCADE,
  quantity_used NUMERIC NOT NULL DEFAULT 0,
  UNIQUE (recette_id, ingredient_id)
);

ALTER TABLE public.resto_recette_ingredients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resto_recette_ingredients_select" ON public.resto_recette_ingredients;
DROP POLICY IF EXISTS "resto_recette_ingredients_insert" ON public.resto_recette_ingredients;
DROP POLICY IF EXISTS "resto_recette_ingredients_update" ON public.resto_recette_ingredients;
DROP POLICY IF EXISTS "resto_recette_ingredients_delete" ON public.resto_recette_ingredients;

DROP POLICY IF EXISTS "resto_recette_ingredients_select" ON public.resto_recette_ingredients;
DROP POLICY IF EXISTS "resto_recette_ingredients_select" ON public.resto_recette_ingredients;
CREATE POLICY "resto_recette_ingredients_select" ON public.resto_recette_ingredients
  FOR SELECT USING (
    recette_id IN (
      SELECT id FROM public.resto_recettes
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "resto_recette_ingredients_insert" ON public.resto_recette_ingredients;
DROP POLICY IF EXISTS "resto_recette_ingredients_insert" ON public.resto_recette_ingredients;
CREATE POLICY "resto_recette_ingredients_insert" ON public.resto_recette_ingredients
  FOR INSERT WITH CHECK (
    recette_id IN (
      SELECT id FROM public.resto_recettes
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "resto_recette_ingredients_update" ON public.resto_recette_ingredients;
DROP POLICY IF EXISTS "resto_recette_ingredients_update" ON public.resto_recette_ingredients;
CREATE POLICY "resto_recette_ingredients_update" ON public.resto_recette_ingredients
  FOR UPDATE USING (
    recette_id IN (
      SELECT id FROM public.resto_recettes
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "resto_recette_ingredients_delete" ON public.resto_recette_ingredients;
DROP POLICY IF EXISTS "resto_recette_ingredients_delete" ON public.resto_recette_ingredients;
CREATE POLICY "resto_recette_ingredients_delete" ON public.resto_recette_ingredients
  FOR DELETE USING (
    recette_id IN (
      SELECT id FROM public.resto_recettes
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_resto_recette_ingredients_recette ON public.resto_recette_ingredients(recette_id);
CREATE INDEX IF NOT EXISTS idx_resto_recette_ingredients_ingredient ON public.resto_recette_ingredients(ingredient_id);
