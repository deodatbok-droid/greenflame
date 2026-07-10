-- ============================================================================
-- 062 — Tontine-Produit : couche produit sur le moteur tontine existant
--
-- Principe : le moteur tontine (membres, cycles, cotisations, tirage) reste
-- intact. On ajoute un overlay produit via tontine_products (1:1 avec tontines)
-- et un suivi de livraison via tontine_delivery_orders (1 par cycle complété).
--
-- Le champ `type` sur tontines distingue 'cash' (défaut historique) de 'produit'.
-- Aucun code existant n'est cassé car le DEFAULT est 'cash'.
-- ============================================================================

-- ── 1. Colonne type sur tontines ─────────────────────────────────────────────
ALTER TABLE public.tontines
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'cash'
    CHECK (type IN ('cash', 'produit'));

COMMENT ON COLUMN public.tontines.type IS
  'cash = tontine rotative classique (argent). produit = tontine-produit liée à un article marchand.';

-- ── 2. tontine_products — overlay produit (1:1 avec tontines de type produit) ──
CREATE TABLE IF NOT EXISTS public.tontine_products (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tontine_id      UUID        NOT NULL UNIQUE REFERENCES public.tontines(id) ON DELETE CASCADE,
  product_id      UUID        NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  merchant_id     UUID        NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  product_name    TEXT        NOT NULL,
  unit_price_fcfa INTEGER     NOT NULL CHECK (unit_price_fcfa > 0),
  validated_at    TIMESTAMPTZ,                         -- NULL = en attente de validation marchand
  stock_committed BOOLEAN     NOT NULL DEFAULT false,  -- marchand a confirmé la réservation de stock
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.tontine_products IS
  'Overlay produit sur une tontine. Le moteur tontine ne connaît pas ce tableau — il orchestre les membres et les cycles indépendamment.';
COMMENT ON COLUMN public.tontine_products.validated_at IS
  'NULL = marchand pas encore validé. Renseigné quand le marchand confirme la disponibilité du stock.';

-- ── 3. tontine_delivery_orders — bon de livraison par cycle complété ─────────
CREATE TABLE IF NOT EXISTS public.tontine_delivery_orders (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tontine_id    UUID        NOT NULL REFERENCES public.tontines(id) ON DELETE CASCADE,
  membre_id     UUID        NOT NULL REFERENCES public.tontine_membres(id) ON DELETE CASCADE,
  cycle_number  INTEGER     NOT NULL CHECK (cycle_number >= 1),
  status        TEXT        NOT NULL DEFAULT 'en_attente'
    CHECK (status IN ('en_attente', 'prepare', 'livre', 'annule')),
  notified_at   TIMESTAMPTZ,
  delivered_at  TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tontine_id, cycle_number)   -- un seul bon par cycle
);

COMMENT ON TABLE public.tontine_delivery_orders IS
  'Créé automatiquement quand has_received_pot passe à true sur un membre d''une tontine-produit. Suivi de livraison côté marchand.';

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tontine_products_tontine_id   ON public.tontine_products(tontine_id);
CREATE INDEX IF NOT EXISTS idx_tontine_products_merchant_id  ON public.tontine_products(merchant_id);
CREATE INDEX IF NOT EXISTS idx_tontine_products_product_id   ON public.tontine_products(product_id);
CREATE INDEX IF NOT EXISTS idx_tontine_delivery_tontine_id   ON public.tontine_delivery_orders(tontine_id);
CREATE INDEX IF NOT EXISTS idx_tontine_delivery_membre_id    ON public.tontine_delivery_orders(membre_id);
CREATE INDEX IF NOT EXISTS idx_tontine_delivery_status       ON public.tontine_delivery_orders(status);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.tontine_products       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tontine_delivery_orders ENABLE ROW LEVEL SECURITY;

-- tontine_products SELECT : membres de la tontine OU le marchand concerné
DROP POLICY IF EXISTS "tp_select" ON public.tontine_products;
CREATE POLICY "tp_select" ON public.tontine_products FOR SELECT USING (
  tontine_id IN (
    SELECT id FROM public.tontines WHERE creator_id = auth.uid()
    UNION
    SELECT tontine_id FROM public.tontine_membres WHERE user_id = auth.uid()
  )
  OR merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
);

-- tontine_products INSERT : créateur de la tontine uniquement
DROP POLICY IF EXISTS "tp_insert" ON public.tontine_products;
CREATE POLICY "tp_insert" ON public.tontine_products FOR INSERT WITH CHECK (
  tontine_id IN (SELECT id FROM public.tontines WHERE creator_id = auth.uid())
);

-- tontine_products UPDATE : créateur OU marchand (validation + livraison)
DROP POLICY IF EXISTS "tp_update" ON public.tontine_products;
CREATE POLICY "tp_update" ON public.tontine_products FOR UPDATE USING (
  tontine_id IN (SELECT id FROM public.tontines WHERE creator_id = auth.uid())
  OR merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
);

-- delivery_orders SELECT : membres de la tontine OU marchand
DROP POLICY IF EXISTS "tdo_select" ON public.tontine_delivery_orders;
CREATE POLICY "tdo_select" ON public.tontine_delivery_orders FOR SELECT USING (
  tontine_id IN (
    SELECT id FROM public.tontines WHERE creator_id = auth.uid()
    UNION
    SELECT tontine_id FROM public.tontine_membres WHERE user_id = auth.uid()
    UNION
    SELECT tp.tontine_id FROM public.tontine_products tp
      WHERE tp.merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  )
);

-- delivery_orders INSERT : créateur (via PATCH membres, backend)
DROP POLICY IF EXISTS "tdo_insert" ON public.tontine_delivery_orders;
CREATE POLICY "tdo_insert" ON public.tontine_delivery_orders FOR INSERT WITH CHECK (
  tontine_id IN (SELECT id FROM public.tontines WHERE creator_id = auth.uid())
);

-- delivery_orders UPDATE : marchand (suivi livraison) OU créateur (annulation)
DROP POLICY IF EXISTS "tdo_update" ON public.tontine_delivery_orders;
CREATE POLICY "tdo_update" ON public.tontine_delivery_orders FOR UPDATE USING (
  tontine_id IN (
    SELECT tp.tontine_id FROM public.tontine_products tp
      WHERE tp.merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  )
  OR tontine_id IN (SELECT id FROM public.tontines WHERE creator_id = auth.uid())
);

-- ── Trigger updated_at sur tontine_products ───────────────────────────────────
DROP TRIGGER IF EXISTS tontine_products_updated_at ON public.tontine_products;
CREATE TRIGGER tontine_products_updated_at
  BEFORE UPDATE ON public.tontine_products
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
