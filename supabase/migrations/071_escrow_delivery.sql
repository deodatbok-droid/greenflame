-- ================================================================
-- 071 — ESCROW + GREENFLAME DELIVERY SYSTEM
-- ================================================================
-- Deux axes :
-- 1. Escrow : la transaction reste "held" jusqu'à confirmation
--    de réception par l'acheteur (ou auto-libération à 48h).
-- 2. Livraison : marketplace de prestataires, commandes livraison,
--    système de notation.
-- ================================================================

-- ── Étendre le CHECK status des transactions ──────────────────────
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
    CHECK (status IN (
      'pending',
      'processing',
      'completed',
      'failed',
      'refunded',
      'escrow',
      'disputed'
    ));

-- ── Nouvelles colonnes sur transactions ──────────────────────────
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS delivery_type TEXT
    CHECK (delivery_type IN ('pickup', 'delivery')),
  ADD COLUMN IF NOT EXISTS escrow_status TEXT
    CHECK (escrow_status IN ('held', 'released', 'disputed')),
  ADD COLUMN IF NOT EXISTS escrow_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivery_address TEXT;

CREATE INDEX IF NOT EXISTS idx_transactions_escrow
  ON public.transactions(escrow_status, escrow_expires_at)
  WHERE escrow_status = 'held';

-- ================================================================
-- DELIVERY PROVIDERS — livreurs (utilisateur / marchand / entreprise)
-- ================================================================
CREATE TABLE IF NOT EXISTS public.delivery_providers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider_type TEXT NOT NULL DEFAULT 'individual'
                CHECK (provider_type IN ('individual', 'merchant', 'company')),
  display_name  TEXT NOT NULL,
  phone         TEXT NOT NULL,
  service_area  TEXT,                       -- quartiers/villes couverts (texte libre)
  min_fee_fcfa  INTEGER NOT NULL DEFAULT 0,
  base_fee_fcfa INTEGER NOT NULL DEFAULT 500,
  fee_per_km    INTEGER NOT NULL DEFAULT 100,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
  avg_rating    DECIMAL(3,2),
  nb_deliveries INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_providers_user ON public.delivery_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_providers_active ON public.delivery_providers(is_active, is_verified);

-- ================================================================
-- DELIVERY ORDERS — commandes de livraison liées à une transaction
-- ================================================================
CREATE TABLE IF NOT EXISTS public.delivery_orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id      UUID NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,
  buyer_id            UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  merchant_id         UUID NOT NULL REFERENCES public.merchants(id) ON DELETE RESTRICT,
  provider_id         UUID REFERENCES public.delivery_providers(id) ON DELETE SET NULL,
  status              TEXT NOT NULL DEFAULT 'pending_assignment'
                      CHECK (status IN (
                        'pending_assignment',   -- en attente d'un livreur
                        'assigned',             -- livreur accepté
                        'picked_up',            -- livreur a pris le colis
                        'in_transit',           -- en route
                        'delivered',            -- remis à l'acheteur
                        'failed_delivery',      -- échec (absent, adresse erronée…)
                        'cancelled'
                      )),
  delivery_address    TEXT NOT NULL,
  delivery_fee_fcfa   INTEGER NOT NULL DEFAULT 0,
  commission_fcfa     INTEGER NOT NULL DEFAULT 0,  -- 5% de delivery_fee prélevé par GreenFlame
  pickup_address      TEXT,                        -- adresse du marchand
  notes               TEXT,
  assigned_at         TIMESTAMPTZ,
  picked_up_at        TIMESTAMPTZ,
  delivered_at        TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_delivery_orders_tx ON public.delivery_orders(transaction_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_buyer ON public.delivery_orders(buyer_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_merchant ON public.delivery_orders(merchant_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_provider ON public.delivery_orders(provider_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_status ON public.delivery_orders(status);

-- ================================================================
-- DELIVERY RATINGS — notation des livreurs par les acheteurs
-- ================================================================
CREATE TABLE IF NOT EXISTS public.delivery_ratings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id UUID NOT NULL REFERENCES public.delivery_orders(id) ON DELETE CASCADE,
  buyer_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  provider_id     UUID NOT NULL REFERENCES public.delivery_providers(id) ON DELETE CASCADE,
  rating          SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (delivery_order_id, buyer_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_ratings_provider ON public.delivery_ratings(provider_id);

-- Trigger pour recalculer avg_rating après chaque notation
CREATE OR REPLACE FUNCTION update_provider_avg_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE public.delivery_providers
  SET
    avg_rating    = (SELECT ROUND(AVG(rating)::NUMERIC, 2) FROM public.delivery_ratings WHERE provider_id = NEW.provider_id),
    nb_deliveries = (SELECT COUNT(*) FROM public.delivery_ratings WHERE provider_id = NEW.provider_id),
    updated_at    = NOW()
  WHERE id = NEW.provider_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_delivery_rating_avg ON public.delivery_ratings;
CREATE TRIGGER trg_delivery_rating_avg
  AFTER INSERT OR UPDATE ON public.delivery_ratings
  FOR EACH ROW EXECUTE FUNCTION update_provider_avg_rating();

-- ================================================================
-- ESCROW NOTIFICATIONS LOG — pour éviter les doublons de notifs
-- ================================================================
CREATE TABLE IF NOT EXISTS public.escrow_notifications (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  notif_type     TEXT NOT NULL CHECK (notif_type IN ('12h', '24h', 'released', 'disputed')),
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (transaction_id, notif_type)
);

-- ================================================================
-- RLS POLICIES
-- ================================================================

-- delivery_providers —————————————————————————————
ALTER TABLE public.delivery_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_providers_read_public" ON public.delivery_providers;
CREATE POLICY "delivery_providers_read_public"
  ON public.delivery_providers FOR SELECT
  USING (is_active = TRUE);

DROP POLICY IF EXISTS "delivery_providers_write_own" ON public.delivery_providers;
CREATE POLICY "delivery_providers_write_own"
  ON public.delivery_providers FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "delivery_providers_admin" ON public.delivery_providers;
CREATE POLICY "delivery_providers_admin"
  ON public.delivery_providers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND (role @> ARRAY['admin'] OR role @> ARRAY['platform_upline'])
    )
  );

-- delivery_orders —————————————————————————————
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_orders_buyer" ON public.delivery_orders;
CREATE POLICY "delivery_orders_buyer"
  ON public.delivery_orders FOR SELECT
  USING (buyer_id = auth.uid());

DROP POLICY IF EXISTS "delivery_orders_merchant" ON public.delivery_orders;
CREATE POLICY "delivery_orders_merchant"
  ON public.delivery_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.merchants m
      WHERE m.id = merchant_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delivery_orders_provider" ON public.delivery_orders;
CREATE POLICY "delivery_orders_provider"
  ON public.delivery_orders FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = provider_id AND dp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delivery_orders_provider_update" ON public.delivery_orders;
CREATE POLICY "delivery_orders_provider_update"
  ON public.delivery_orders FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.delivery_providers dp
      WHERE dp.id = provider_id AND dp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "delivery_orders_admin" ON public.delivery_orders;
CREATE POLICY "delivery_orders_admin"
  ON public.delivery_orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND (role @> ARRAY['admin'] OR role @> ARRAY['platform_upline'])
    )
  );

-- delivery_ratings —————————————————————————————
ALTER TABLE public.delivery_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "delivery_ratings_read" ON public.delivery_ratings;
CREATE POLICY "delivery_ratings_read"
  ON public.delivery_ratings FOR SELECT
  USING (TRUE);

DROP POLICY IF EXISTS "delivery_ratings_write_buyer" ON public.delivery_ratings;
CREATE POLICY "delivery_ratings_write_buyer"
  ON public.delivery_ratings FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

-- escrow_notifications —————————————————————————
ALTER TABLE public.escrow_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "escrow_notif_service_only" ON public.escrow_notifications;
CREATE POLICY "escrow_notif_service_only"
  ON public.escrow_notifications FOR ALL
  USING (FALSE); -- service_role only via RLS bypass
