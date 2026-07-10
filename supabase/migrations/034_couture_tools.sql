-- Migration 034 — Gestionnaire d'atelier Couture & Mode
-- Tables: couture_clients, couture_commandes

-- ── Table clients couture ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.couture_clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT,
  -- Mesures en centimètres (nullable — remplies progressivement)
  tour_poitrine NUMERIC,     -- tour de poitrine
  tour_taille NUMERIC,       -- tour de taille
  tour_hanches NUMERIC,      -- tour de hanches
  longueur_dos NUMERIC,      -- longueur dos (épaule → taille)
  longueur_robe NUMERIC,     -- longueur robe (épaule → sol ou genou)
  longueur_pantalon NUMERIC, -- longueur pantalon (taille → cheville)
  epaules NUMERIC,           -- largeur épaules
  longueur_manche NUMERIC,   -- longueur manche
  tour_cou NUMERIC,          -- tour de cou
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.couture_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couture_clients_select" ON public.couture_clients;
DROP POLICY IF EXISTS "couture_clients_insert" ON public.couture_clients;
DROP POLICY IF EXISTS "couture_clients_update" ON public.couture_clients;
DROP POLICY IF EXISTS "couture_clients_delete" ON public.couture_clients;

DROP POLICY IF EXISTS "couture_clients_select" ON public.couture_clients;
CREATE POLICY "couture_clients_select" ON public.couture_clients
  FOR SELECT USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "couture_clients_insert" ON public.couture_clients;
CREATE POLICY "couture_clients_insert" ON public.couture_clients
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "couture_clients_update" ON public.couture_clients;
CREATE POLICY "couture_clients_update" ON public.couture_clients
  FOR UPDATE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "couture_clients_delete" ON public.couture_clients;
CREATE POLICY "couture_clients_delete" ON public.couture_clients
  FOR DELETE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_couture_clients_merchant ON public.couture_clients(merchant_id);

-- ── Table commandes couture ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.couture_commandes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.couture_clients(id) ON DELETE SET NULL,
  client_name_snapshot TEXT NOT NULL, -- dénormalisé en cas de suppression client
  modele_description TEXT NOT NULL,   -- description du vêtement / style
  tissu_metres NUMERIC DEFAULT 0,     -- mètres de tissu nécessaires
  tissu_prix_metre INTEGER DEFAULT 0, -- prix par mètre en FCFA
  accessoires_fcfa INTEGER DEFAULT 0, -- fermetures, boutons, fil…
  main_oeuvre_fcfa INTEGER DEFAULT 0, -- coût de main d'œuvre
  prix_total_fcfa INTEGER NOT NULL DEFAULT 0, -- prix total convenu
  avance_versee_fcfa INTEGER DEFAULT 0,       -- avance déjà payée
  date_livraison DATE,
  status TEXT NOT NULL DEFAULT 'en_cours'
    CHECK (status IN ('en_cours', 'pret', 'livre', 'annule')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.couture_commandes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "couture_commandes_select" ON public.couture_commandes;
DROP POLICY IF EXISTS "couture_commandes_insert" ON public.couture_commandes;
DROP POLICY IF EXISTS "couture_commandes_update" ON public.couture_commandes;
DROP POLICY IF EXISTS "couture_commandes_delete" ON public.couture_commandes;

DROP POLICY IF EXISTS "couture_commandes_select" ON public.couture_commandes;
CREATE POLICY "couture_commandes_select" ON public.couture_commandes
  FOR SELECT USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "couture_commandes_insert" ON public.couture_commandes;
CREATE POLICY "couture_commandes_insert" ON public.couture_commandes
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "couture_commandes_update" ON public.couture_commandes;
CREATE POLICY "couture_commandes_update" ON public.couture_commandes
  FOR UPDATE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "couture_commandes_delete" ON public.couture_commandes;
CREATE POLICY "couture_commandes_delete" ON public.couture_commandes
  FOR DELETE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_couture_commandes_merchant ON public.couture_commandes(merchant_id);
CREATE INDEX IF NOT EXISTS idx_couture_commandes_client   ON public.couture_commandes(client_id);
CREATE INDEX IF NOT EXISTS idx_couture_commandes_status   ON public.couture_commandes(merchant_id, status);
