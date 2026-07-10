-- ================================================================
-- Migration 052 — Pack Mystère GreenFlame
-- Tables : pack_catalog, pack_item_catalog, mystery_pack_purchases,
--          mystery_pack_items, merchant_bons
-- ================================================================
-- Logique :
--   3 tiers : Bronze (100 F) / Argent (200 F) / Or (500 F)
--   Chaque pack garantit : X FA + boost cashback ×2 (prochaine transaction)
--   Item tiré aléatoirement selon poids de rareté (commun/rare/épique/légendaire)
--   Tous les items = coût nul pour GreenFlame :
--     - produits digitaux GreenFlame (formation, module, contenu)
--     - bons financés par les marchands partenaires
-- ================================================================

-- ─── PACK_CATALOG ─────────────────────────────────────────────────────────────
-- Définition des 3 tiers de pack (paramétrable par admin)
CREATE TABLE IF NOT EXISTS public.pack_catalog (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tier                TEXT        NOT NULL UNIQUE CHECK (tier IN ('bronze', 'argent', 'or')),
  price_fcfa          INTEGER     NOT NULL CHECK (price_fcfa > 0),
  -- FA garantis à l'ouverture du pack (indépendamment de l'item)
  fa_guaranteed       INTEGER     NOT NULL DEFAULT 0 CHECK (fa_guaranteed >= 0),
  -- Boost cashback × multiplicateur sur la PROCHAINE transaction
  boost_multiplier    NUMERIC(3,1) NOT NULL DEFAULT 2.0,
  -- Durée du boost (en heures) — 0 = illimité jusqu'à prochaine transaction
  boost_duration_hours INTEGER    NOT NULL DEFAULT 0,
  -- Nombre d'items révélés par pack (toujours 1 pour l'instant)
  items_per_pack      INTEGER     NOT NULL DEFAULT 1,
  description_fr      TEXT,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  sort_order          INTEGER     NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed des 3 tiers
INSERT INTO public.pack_catalog (tier, price_fcfa, fa_guaranteed, boost_multiplier, description_fr, sort_order)
VALUES
  ('bronze', 100, 2, 2.0, 'Le pack d''entrée : 2 Flammes garanties, boost ×2 et une surprise.', 1),
  ('argent', 200, 3, 2.0, 'Le pack intermédiaire : 3 Flammes garanties, boost ×2 et une surprise de meilleure qualité.', 2),
  ('or',     500, 5, 2.0, 'Le pack premium : 5 Flammes garanties, boost ×2 et une surprise exclusive.', 3)
ON CONFLICT (tier) DO NOTHING;

ALTER TABLE public.pack_catalog ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire le catalogue
DROP POLICY IF EXISTS "pack_catalog_select_all" ON public.pack_catalog;
CREATE POLICY "pack_catalog_select_all" ON public.pack_catalog
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "pack_catalog_admin_write" ON public.pack_catalog;
CREATE POLICY "pack_catalog_admin_write" ON public.pack_catalog
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- ─── PACK_ITEM_CATALOG ────────────────────────────────────────────────────────
-- Catalogue des items pouvant être révélés dans un pack
CREATE TABLE IF NOT EXISTS public.pack_item_catalog (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name_fr             TEXT        NOT NULL,
  description_fr      TEXT,
  -- 4 niveaux de rareté
  rarity              TEXT        NOT NULL CHECK (rarity IN ('commun', 'rare', 'épique', 'légendaire')),
  -- Type d'item (détermine comment il est livré)
  item_type           TEXT        NOT NULL CHECK (item_type IN (
    'gf_academie_module',  -- accès à 1 module académie GreenFlame
    'gf_formation_full',   -- accès complet à une formation
    'gf_gfp_bonus',        -- bonus en GFP (monnaie communautaire)
    'gf_fa_bonus',         -- FA bonus supplémentaires
    'gf_boost_cashback',   -- boost cashback prolongé
    'merchant_bon'         -- bon de réduction chez un marchand partenaire
  )),
  -- Valeur faciale (pour les bons marchands ou GFP)
  item_value          INTEGER     NOT NULL DEFAULT 0,
  -- Paramètre spécifique selon le type
  --   gf_academie_module : module_id
  --   gf_gfp_bonus       : montant_gfp
  --   gf_fa_bonus        : nb_fa
  --   gf_boost_cashback  : duration_hours
  --   merchant_bon       : merchant_category ou merchant_id (géré via merchant_bons)
  item_params         JSONB       NOT NULL DEFAULT '{}',
  -- Poids de probabilité par rareté (base 100 = commun)
  -- commun: 60 | rare: 25 | épique: 12 | légendaire: 3
  availability_weight INTEGER     NOT NULL DEFAULT 60 CHECK (availability_weight > 0),
  -- Tier minimum pour recevoir cet item (un pack Or peut révéler tout, bronze seulement commun/rare)
  min_tier            TEXT        NOT NULL DEFAULT 'bronze' CHECK (min_tier IN ('bronze', 'argent', 'or')),
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pack_item_rarity ON public.pack_item_catalog(rarity, is_active);
CREATE INDEX IF NOT EXISTS idx_pack_item_tier ON public.pack_item_catalog(min_tier, is_active);

-- Seed des items par défaut
INSERT INTO public.pack_item_catalog
  (name_fr, description_fr, rarity, item_type, item_value, item_params, availability_weight, min_tier)
VALUES
  -- COMMUN (60 poids)
  ('Module Gestion Quotidienne',
   'Accès au module F1 — Gérer son argent au quotidien',
   'commun', 'gf_academie_module', 0, '{"module_key":"F1"}', 60, 'bronze'),
  ('50 GFP Bonus',
   '50 points GreenFlame Points crédités sur ton compte',
   'commun', 'gf_gfp_bonus', 50, '{"montant_gfp":50}', 60, 'bronze'),
  ('3 Flammes Bonus',
   '3 Flammes d''Activité supplémentaires',
   'commun', 'gf_fa_bonus', 0, '{"nb_fa":3}', 60, 'bronze'),
  ('Boost Cashback 48h',
   'Multiplie ton cashback ×1.5 sur les 48 prochaines heures',
   'commun', 'gf_boost_cashback', 0, '{"multiplier":1.5,"duration_hours":48}', 60, 'bronze'),

  -- RARE (25 poids)
  ('Module Transformer son Savoir-Faire',
   'Accès au module F2 — Transformer son savoir-faire en revenu',
   'rare', 'gf_academie_module', 0, '{"module_key":"F2"}', 25, 'bronze'),
  ('200 GFP Bonus',
   '200 points GreenFlame Points crédités',
   'rare', 'gf_gfp_bonus', 200, '{"montant_gfp":200}', 25, 'bronze'),
  ('Bon Marchand 500 F',
   'Bon de réduction de 500 F chez un marchand partenaire',
   'rare', 'merchant_bon', 500, '{"merchant_category":"any"}', 25, 'bronze'),
  ('10 Flammes Bonus',
   '10 Flammes d''Activité supplémentaires',
   'rare', 'gf_fa_bonus', 0, '{"nb_fa":10}', 25, 'bronze'),

  -- ÉPIQUE (12 poids) — argent+
  ('Formation Complète Épargne',
   'Accès complet à la formation F3 — Épargner enfin',
   'épique', 'gf_formation_full', 0, '{"formation_key":"F3"}', 12, 'argent'),
  ('500 GFP Bonus',
   '500 points GreenFlame Points crédités',
   'épique', 'gf_gfp_bonus', 500, '{"montant_gfp":500}', 12, 'argent'),
  ('Bon Marchand 1 000 F',
   'Bon de réduction de 1 000 F chez un marchand partenaire',
   'épique', 'merchant_bon', 1000, '{"merchant_category":"any"}', 12, 'argent'),
  ('Boost Cashback 7 jours',
   'Multiplie ton cashback ×2 pendant 7 jours',
   'épique', 'gf_boost_cashback', 0, '{"multiplier":2.0,"duration_hours":168}', 12, 'argent'),

  -- LÉGENDAIRE (3 poids) — or uniquement
  ('Accès VIP 30 jours',
   'Upgrade VIP temporaire : toutes les formations + outils Pro pendant 30 jours',
   'légendaire', 'gf_formation_full', 0, '{"access_key":"vip_30d"}', 3, 'or'),
  ('Bon Marchand 2 500 F',
   'Bon de réduction de 2 500 F chez un marchand partenaire premium',
   'légendaire', 'merchant_bon', 2500, '{"merchant_category":"premium"}', 3, 'or'),
  ('1 000 GFP Bonus',
   '1 000 points GreenFlame Points — le jackpot !',
   'légendaire', 'gf_gfp_bonus', 1000, '{"montant_gfp":1000}', 3, 'or'),
  ('20 Flammes Bonus',
   '20 Flammes d''Activité + 5 Flammes d''Autonomie bonus',
   'légendaire', 'gf_fa_bonus', 0, '{"nb_fa":20,"nb_fau":5}', 3, 'or')
ON CONFLICT DO NOTHING;

ALTER TABLE public.pack_item_catalog ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pack_item_catalog_select_all" ON public.pack_item_catalog;
CREATE POLICY "pack_item_catalog_select_all" ON public.pack_item_catalog
  FOR SELECT TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "pack_item_catalog_admin_write" ON public.pack_item_catalog;
CREATE POLICY "pack_item_catalog_admin_write" ON public.pack_item_catalog
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- ─── MYSTERY_PACK_PURCHASES ───────────────────────────────────────────────────
-- Un achat de pack par un utilisateur
CREATE TABLE IF NOT EXISTS public.mystery_pack_purchases (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  pack_tier           TEXT        NOT NULL CHECK (pack_tier IN ('bronze', 'argent', 'or')),
  price_paid_fcfa     INTEGER     NOT NULL,
  -- FA attribués à l'ouverture (garantis par le tier)
  fa_granted          INTEGER     NOT NULL DEFAULT 0,
  -- Boost activé pour la prochaine transaction
  boost_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  boost_multiplier    NUMERIC(3,1) NOT NULL DEFAULT 2.0,
  -- Le boost expire à minuit du jour d'achat ou à la 1ère transaction (selon politique)
  boost_expires_at    TIMESTAMPTZ,
  boost_consumed_at   TIMESTAMPTZ,
  boost_consumed_tx   UUID,   -- transaction qui a consommé le boost
  -- Statut global de l'achat
  status              TEXT        NOT NULL DEFAULT 'purchased'
                                  CHECK (status IN ('purchased', 'opened', 'delivered')),
  opened_at           TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mystery_pack_user ON public.mystery_pack_purchases(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mystery_pack_boost ON public.mystery_pack_purchases(user_id, boost_active)
  WHERE boost_active = TRUE;

ALTER TABLE public.mystery_pack_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mystery_pack_select_own" ON public.mystery_pack_purchases;
CREATE POLICY "mystery_pack_select_own" ON public.mystery_pack_purchases
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "mystery_pack_insert_own" ON public.mystery_pack_purchases;
CREATE POLICY "mystery_pack_insert_own" ON public.mystery_pack_purchases
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mystery_pack_admin_all" ON public.mystery_pack_purchases;
CREATE POLICY "mystery_pack_admin_all" ON public.mystery_pack_purchases
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- ─── MYSTERY_PACK_ITEMS ───────────────────────────────────────────────────────
-- Items révélés par achat (1 item = 1 ligne)
CREATE TABLE IF NOT EXISTS public.mystery_pack_items (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id         UUID        NOT NULL REFERENCES public.mystery_pack_purchases(id) ON DELETE CASCADE,
  catalog_item_id     UUID        NOT NULL REFERENCES public.pack_item_catalog(id),
  -- Référence au bon marchand si item_type = 'merchant_bon'
  merchant_bon_id     UUID,       -- FK vers merchant_bons ajoutée après création
  -- Livraison
  delivered           BOOLEAN     NOT NULL DEFAULT FALSE,
  delivered_at        TIMESTAMPTZ,
  delivery_metadata   JSONB       NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mystery_pack_items_purchase ON public.mystery_pack_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_mystery_pack_items_delivered ON public.mystery_pack_items(delivered)
  WHERE delivered = FALSE;

ALTER TABLE public.mystery_pack_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mystery_pack_items_select_own" ON public.mystery_pack_items;
CREATE POLICY "mystery_pack_items_select_own" ON public.mystery_pack_items
  FOR SELECT TO authenticated
  USING (
    purchase_id IN (
      SELECT id FROM public.mystery_pack_purchases WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "mystery_pack_items_admin_all" ON public.mystery_pack_items;
CREATE POLICY "mystery_pack_items_admin_all" ON public.mystery_pack_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- ─── MERCHANT_BONS ────────────────────────────────────────────────────────────
-- Bons de réduction fournis par les marchands partenaires pour alimenter le pool
CREATE TABLE IF NOT EXISTS public.merchant_bons (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id         UUID        NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  -- Item du catalogue auquel ce bon est rattaché
  catalog_item_id     UUID        NOT NULL REFERENCES public.pack_item_catalog(id),
  -- Code unique à présenter chez le marchand
  code                TEXT        NOT NULL UNIQUE DEFAULT UPPER(ENCODE(GEN_RANDOM_BYTES(6), 'hex')),
  -- Valeur faciale du bon (en FCFA)
  value_fcfa          INTEGER     NOT NULL CHECK (value_fcfa > 0),
  -- Date d'expiration
  expiry_date         DATE        NOT NULL,
  -- Utilisé par
  claimed_by          UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  claimed_at          TIMESTAMPTZ,
  -- Le pack qui a distribué ce bon
  pack_item_id        UUID        REFERENCES public.mystery_pack_items(id),
  -- Conditions d'utilisation (optionnel)
  conditions_fr       TEXT,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_merchant_bons_merchant ON public.merchant_bons(merchant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_merchant_bons_code ON public.merchant_bons(code);
CREATE INDEX IF NOT EXISTS idx_merchant_bons_available ON public.merchant_bons(catalog_item_id, claimed_by)
  WHERE claimed_by IS NULL AND is_active = TRUE;

ALTER TABLE public.merchant_bons ENABLE ROW LEVEL SECURITY;

-- Le détenteur d'un bon peut le voir (après attribution)
DROP POLICY IF EXISTS "merchant_bons_select_own" ON public.merchant_bons;
CREATE POLICY "merchant_bons_select_own" ON public.merchant_bons
  FOR SELECT TO authenticated
  USING (claimed_by = auth.uid());

-- Le marchand voit ses propres bons
DROP POLICY IF EXISTS "merchant_bons_select_merchant" ON public.merchant_bons;
CREATE POLICY "merchant_bons_select_merchant" ON public.merchant_bons
  FOR SELECT TO authenticated
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "merchant_bons_admin_all" ON public.merchant_bons;
CREATE POLICY "merchant_bons_admin_all" ON public.merchant_bons
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- FK différée : mystery_pack_items → merchant_bons (FK circulaire évitée par ajout séparé)
ALTER TABLE public.mystery_pack_items
  DROP CONSTRAINT IF EXISTS fk_mystery_pack_items_bon;
ALTER TABLE public.mystery_pack_items
  ADD CONSTRAINT fk_mystery_pack_items_bon
  FOREIGN KEY (merchant_bon_id) REFERENCES public.merchant_bons(id)
  ON DELETE SET NULL;
