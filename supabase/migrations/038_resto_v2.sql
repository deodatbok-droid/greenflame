-- Migration 038 — Restauration v2 : Menus du jour, Clients, Commandes

-- ── Menus du jour ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resto_menus (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID    NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  date        DATE    NOT NULL DEFAULT CURRENT_DATE,
  titre       TEXT,
  statut      TEXT    NOT NULL DEFAULT 'brouillon'
                CHECK (statut IN ('brouillon', 'publié', 'archivé')),
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.resto_menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resto_menus_select" ON public.resto_menus;
DROP POLICY IF EXISTS "resto_menus_insert" ON public.resto_menus;
DROP POLICY IF EXISTS "resto_menus_update" ON public.resto_menus;
DROP POLICY IF EXISTS "resto_menus_delete" ON public.resto_menus;

DROP POLICY IF EXISTS "resto_menus_select" ON public.resto_menus;
CREATE POLICY "resto_menus_select" ON public.resto_menus
  FOR SELECT USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_menus_insert" ON public.resto_menus;
CREATE POLICY "resto_menus_insert" ON public.resto_menus
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_menus_update" ON public.resto_menus;
CREATE POLICY "resto_menus_update" ON public.resto_menus
  FOR UPDATE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_menus_delete" ON public.resto_menus;
CREATE POLICY "resto_menus_delete" ON public.resto_menus
  FOR DELETE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_resto_menus_merchant      ON public.resto_menus(merchant_id);
CREATE INDEX IF NOT EXISTS idx_resto_menus_merchant_date ON public.resto_menus(merchant_id, date);

-- ── Plats du menu ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resto_menu_plats (
  id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  menu_id         UUID    NOT NULL REFERENCES public.resto_menus(id) ON DELETE CASCADE,
  nom_plat        TEXT    NOT NULL,
  description     TEXT,
  categorie       TEXT    NOT NULL DEFAULT 'plat'
                    CHECK (categorie IN ('plat', 'sauce', 'accompagnement', 'boisson', 'dessert', 'autre')),
  prix_vente_fcfa INTEGER NOT NULL DEFAULT 0,
  recette_id      UUID    REFERENCES public.resto_recettes(id) ON DELETE SET NULL,
  disponible      BOOLEAN NOT NULL DEFAULT true,
  position        INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.resto_menu_plats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resto_menu_plats_select" ON public.resto_menu_plats;
DROP POLICY IF EXISTS "resto_menu_plats_insert" ON public.resto_menu_plats;
DROP POLICY IF EXISTS "resto_menu_plats_update" ON public.resto_menu_plats;
DROP POLICY IF EXISTS "resto_menu_plats_delete" ON public.resto_menu_plats;

DROP POLICY IF EXISTS "resto_menu_plats_select" ON public.resto_menu_plats;
CREATE POLICY "resto_menu_plats_select" ON public.resto_menu_plats
  FOR SELECT USING (
    menu_id IN (
      SELECT id FROM public.resto_menus
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "resto_menu_plats_insert" ON public.resto_menu_plats;
CREATE POLICY "resto_menu_plats_insert" ON public.resto_menu_plats
  FOR INSERT WITH CHECK (
    menu_id IN (
      SELECT id FROM public.resto_menus
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "resto_menu_plats_update" ON public.resto_menu_plats;
CREATE POLICY "resto_menu_plats_update" ON public.resto_menu_plats
  FOR UPDATE USING (
    menu_id IN (
      SELECT id FROM public.resto_menus
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "resto_menu_plats_delete" ON public.resto_menu_plats;
CREATE POLICY "resto_menu_plats_delete" ON public.resto_menu_plats
  FOR DELETE USING (
    menu_id IN (
      SELECT id FROM public.resto_menus
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_resto_menu_plats_menu ON public.resto_menu_plats(menu_id);

-- ── Clients du restaurant ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resto_clients (
  id                   UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id          UUID    NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  nom                  TEXT    NOT NULL,
  telephone            TEXT,
  email                TEXT,
  notes                TEXT,
  preferences          TEXT,
  nb_visites           INTEGER NOT NULL DEFAULT 0,
  total_depenses_fcfa  INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.resto_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resto_clients_select" ON public.resto_clients;
DROP POLICY IF EXISTS "resto_clients_insert" ON public.resto_clients;
DROP POLICY IF EXISTS "resto_clients_update" ON public.resto_clients;
DROP POLICY IF EXISTS "resto_clients_delete" ON public.resto_clients;

DROP POLICY IF EXISTS "resto_clients_select" ON public.resto_clients;
CREATE POLICY "resto_clients_select" ON public.resto_clients
  FOR SELECT USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_clients_insert" ON public.resto_clients;
CREATE POLICY "resto_clients_insert" ON public.resto_clients
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_clients_update" ON public.resto_clients;
CREATE POLICY "resto_clients_update" ON public.resto_clients
  FOR UPDATE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_clients_delete" ON public.resto_clients;
CREATE POLICY "resto_clients_delete" ON public.resto_clients
  FOR DELETE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_resto_clients_merchant   ON public.resto_clients(merchant_id);
CREATE INDEX IF NOT EXISTS idx_resto_clients_telephone  ON public.resto_clients(telephone);

-- ── Commandes ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resto_commandes (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID    NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  client_id   UUID    REFERENCES public.resto_clients(id) ON DELETE SET NULL,
  nom_client  TEXT,
  table_num   TEXT,
  nb_couverts INTEGER NOT NULL DEFAULT 1,
  statut      TEXT    NOT NULL DEFAULT 'en_cours'
                CHECK (statut IN ('en_cours', 'servi', 'payé', 'annulé')),
  notes       TEXT,
  total_fcfa  INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.resto_commandes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resto_commandes_select" ON public.resto_commandes;
DROP POLICY IF EXISTS "resto_commandes_insert" ON public.resto_commandes;
DROP POLICY IF EXISTS "resto_commandes_update" ON public.resto_commandes;
DROP POLICY IF EXISTS "resto_commandes_delete" ON public.resto_commandes;

DROP POLICY IF EXISTS "resto_commandes_select" ON public.resto_commandes;
CREATE POLICY "resto_commandes_select" ON public.resto_commandes
  FOR SELECT USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_commandes_insert" ON public.resto_commandes;
CREATE POLICY "resto_commandes_insert" ON public.resto_commandes
  FOR INSERT WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_commandes_update" ON public.resto_commandes;
CREATE POLICY "resto_commandes_update" ON public.resto_commandes
  FOR UPDATE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "resto_commandes_delete" ON public.resto_commandes;
CREATE POLICY "resto_commandes_delete" ON public.resto_commandes
  FOR DELETE USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_resto_commandes_merchant ON public.resto_commandes(merchant_id);
CREATE INDEX IF NOT EXISTS idx_resto_commandes_statut   ON public.resto_commandes(merchant_id, statut);
CREATE INDEX IF NOT EXISTS idx_resto_commandes_date     ON public.resto_commandes(merchant_id, created_at);

-- ── Plats commandés ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.resto_commande_plats (
  id                UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  commande_id       UUID    NOT NULL REFERENCES public.resto_commandes(id) ON DELETE CASCADE,
  nom_plat          TEXT    NOT NULL,
  prix_unitaire_fcfa INTEGER NOT NULL DEFAULT 0,
  quantite          INTEGER NOT NULL DEFAULT 1,
  notes             TEXT
);

ALTER TABLE public.resto_commande_plats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "resto_commande_plats_select" ON public.resto_commande_plats;
DROP POLICY IF EXISTS "resto_commande_plats_insert" ON public.resto_commande_plats;
DROP POLICY IF EXISTS "resto_commande_plats_update" ON public.resto_commande_plats;
DROP POLICY IF EXISTS "resto_commande_plats_delete" ON public.resto_commande_plats;

DROP POLICY IF EXISTS "resto_commande_plats_select" ON public.resto_commande_plats;
CREATE POLICY "resto_commande_plats_select" ON public.resto_commande_plats
  FOR SELECT USING (
    commande_id IN (
      SELECT id FROM public.resto_commandes
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "resto_commande_plats_insert" ON public.resto_commande_plats;
CREATE POLICY "resto_commande_plats_insert" ON public.resto_commande_plats
  FOR INSERT WITH CHECK (
    commande_id IN (
      SELECT id FROM public.resto_commandes
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "resto_commande_plats_update" ON public.resto_commande_plats;
CREATE POLICY "resto_commande_plats_update" ON public.resto_commande_plats
  FOR UPDATE USING (
    commande_id IN (
      SELECT id FROM public.resto_commandes
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "resto_commande_plats_delete" ON public.resto_commande_plats;
CREATE POLICY "resto_commande_plats_delete" ON public.resto_commande_plats
  FOR DELETE USING (
    commande_id IN (
      SELECT id FROM public.resto_commandes
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS idx_resto_commande_plats_cmd ON public.resto_commande_plats(commande_id);
