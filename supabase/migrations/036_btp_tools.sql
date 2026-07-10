-- Migration 036 — Estimateur chantier IA — BTP & Artisans
-- Tables: btp_materiaux, btp_chantiers, btp_chantier_materiaux

-- ── Table matériaux (bibliothèque de prix) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS public.btp_materiaux (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'sac',
  price_per_unit_fcfa INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'gros_oeuvre',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.btp_materiaux ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "btp_materiaux_select" ON public.btp_materiaux;
DROP POLICY IF EXISTS "btp_materiaux_insert" ON public.btp_materiaux;
DROP POLICY IF EXISTS "btp_materiaux_update" ON public.btp_materiaux;
DROP POLICY IF EXISTS "btp_materiaux_delete" ON public.btp_materiaux;

DROP POLICY IF EXISTS "btp_materiaux_select" ON public.btp_materiaux;
CREATE POLICY "btp_materiaux_select" ON public.btp_materiaux
  FOR SELECT USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "btp_materiaux_insert" ON public.btp_materiaux;
CREATE POLICY "btp_materiaux_insert" ON public.btp_materiaux
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "btp_materiaux_update" ON public.btp_materiaux;
CREATE POLICY "btp_materiaux_update" ON public.btp_materiaux
  FOR UPDATE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "btp_materiaux_delete" ON public.btp_materiaux;
CREATE POLICY "btp_materiaux_delete" ON public.btp_materiaux
  FOR DELETE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_btp_materiaux_merchant ON public.btp_materiaux(merchant_id);

-- ── Table chantiers ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.btp_chantiers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_phone TEXT,
  description TEXT NOT NULL,
  adresse TEXT,
  date_debut DATE,
  date_fin_prevue DATE,
  status TEXT NOT NULL DEFAULT 'en_cours' CHECK (status IN ('en_cours','termine','annule')),
  prix_total_fcfa INTEGER NOT NULL DEFAULT 0,
  avance_versee_fcfa INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.btp_chantiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "btp_chantiers_select" ON public.btp_chantiers;
DROP POLICY IF EXISTS "btp_chantiers_insert" ON public.btp_chantiers;
DROP POLICY IF EXISTS "btp_chantiers_update" ON public.btp_chantiers;
DROP POLICY IF EXISTS "btp_chantiers_delete" ON public.btp_chantiers;

DROP POLICY IF EXISTS "btp_chantiers_select" ON public.btp_chantiers;
CREATE POLICY "btp_chantiers_select" ON public.btp_chantiers
  FOR SELECT USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "btp_chantiers_insert" ON public.btp_chantiers;
CREATE POLICY "btp_chantiers_insert" ON public.btp_chantiers
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "btp_chantiers_update" ON public.btp_chantiers;
DROP POLICY IF EXISTS "btp_chantiers_update" ON public.btp_chantiers;
CREATE POLICY "btp_chantiers_update" ON public.btp_chantiers
  FOR UPDATE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "btp_chantiers_delete" ON public.btp_chantiers;
DROP POLICY IF EXISTS "btp_chantiers_delete" ON public.btp_chantiers;
CREATE POLICY "btp_chantiers_delete" ON public.btp_chantiers
  FOR DELETE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_btp_chantiers_merchant ON public.btp_chantiers(merchant_id);

-- ── Table matériaux par chantier ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.btp_chantier_materiaux (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  chantier_id UUID NOT NULL REFERENCES public.btp_chantiers(id) ON DELETE CASCADE,
  materiau_id UUID REFERENCES public.btp_materiaux(id) ON DELETE SET NULL,
  nom_materiau TEXT NOT NULL,
  unit TEXT NOT NULL DEFAULT 'pièce',
  quantity_needed NUMERIC NOT NULL DEFAULT 0,
  price_per_unit_fcfa INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.btp_chantier_materiaux ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "btp_chantier_materiaux_select" ON public.btp_chantier_materiaux;
DROP POLICY IF EXISTS "btp_chantier_materiaux_insert" ON public.btp_chantier_materiaux;
DROP POLICY IF EXISTS "btp_chantier_materiaux_update" ON public.btp_chantier_materiaux;
DROP POLICY IF EXISTS "btp_chantier_materiaux_delete" ON public.btp_chantier_materiaux;

DROP POLICY IF EXISTS "btp_chantier_materiaux_select" ON public.btp_chantier_materiaux;
DROP POLICY IF EXISTS "btp_chantier_materiaux_select" ON public.btp_chantier_materiaux;
CREATE POLICY "btp_chantier_materiaux_select" ON public.btp_chantier_materiaux
  FOR SELECT USING (
    chantier_id IN (
      SELECT id FROM public.btp_chantiers
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "btp_chantier_materiaux_insert" ON public.btp_chantier_materiaux;
DROP POLICY IF EXISTS "btp_chantier_materiaux_insert" ON public.btp_chantier_materiaux;
CREATE POLICY "btp_chantier_materiaux_insert" ON public.btp_chantier_materiaux
  FOR INSERT WITH CHECK (
    chantier_id IN (
      SELECT id FROM public.btp_chantiers
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "btp_chantier_materiaux_update" ON public.btp_chantier_materiaux;
DROP POLICY IF EXISTS "btp_chantier_materiaux_update" ON public.btp_chantier_materiaux;
CREATE POLICY "btp_chantier_materiaux_update" ON public.btp_chantier_materiaux
  FOR UPDATE USING (
    chantier_id IN (
      SELECT id FROM public.btp_chantiers
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "btp_chantier_materiaux_delete" ON public.btp_chantier_materiaux;
DROP POLICY IF EXISTS "btp_chantier_materiaux_delete" ON public.btp_chantier_materiaux;
CREATE POLICY "btp_chantier_materiaux_delete" ON public.btp_chantier_materiaux
  FOR DELETE USING (
    chantier_id IN (
      SELECT id FROM public.btp_chantiers
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_btp_chantier_materiaux_chantier ON public.btp_chantier_materiaux(chantier_id);
