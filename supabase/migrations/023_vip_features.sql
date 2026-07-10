-- ================================================================
-- GREENFLAME — Migration 023 : VIP features + GreenFlame Hub
-- ================================================================
-- Contenu :
--   1. subscription_trigger sur products
--   2. public_slug sur merchants (vitrine publique)
--   3. featured_until sur products (boost auto VIP)
--   4. is_platform_hub sur merchants (GreenFlame Hub)
--   5. Table merchant_cashiers (multi-caissier VIP)
--   6. Mise à jour v_marketplace_products (featured boost +25)
--   7. Mise à jour activate_merchant_subscription (vip_upgrade 5 000 FCFA)
--   8. Fonction auto_slug_merchant (trigger)
--   9. Seed GreenFlame Hub + 4 produits platform
-- ================================================================

-- ────────────────────────────────────────────────────────────────
-- 1. subscription_trigger sur products
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subscription_trigger TEXT
    CHECK (subscription_trigger IN ('pro', 'vip', 'vip_upgrade', 'agent'));

-- ────────────────────────────────────────────────────────────────
-- 2. public_slug sur merchants
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS public_slug TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS is_platform_hub BOOLEAN NOT NULL DEFAULT FALSE;

-- Index pour la vitrine
CREATE INDEX IF NOT EXISTS idx_merchants_public_slug
  ON public.merchants(public_slug)
  WHERE public_slug IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- 3. featured_until sur products (boost auto nouveaux produits VIP)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_products_featured
  ON public.products(featured_until)
  WHERE featured_until IS NOT NULL;

-- ────────────────────────────────────────────────────────────────
-- 4. Table merchant_cashiers (multi-caissier — VIP uniquement)
-- ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.merchant_cashiers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
  label       TEXT,                        -- "Caissier 1", "Vendeur marché", etc.
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(merchant_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_merchant_cashiers_merchant
  ON public.merchant_cashiers(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_cashiers_user
  ON public.merchant_cashiers(user_id);

-- RLS
ALTER TABLE public.merchant_cashiers ENABLE ROW LEVEL SECURITY;

-- Le marchand voit et gère ses caissiers
DROP POLICY IF EXISTS "cashiers_merchant_manage" ON public.merchant_cashiers;
CREATE POLICY "cashiers_merchant_manage"
  ON public.merchant_cashiers
  FOR ALL
  USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  )
  WITH CHECK (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

-- Un caissier voit sa propre entrée
DROP POLICY IF EXISTS "cashiers_self_read" ON public.merchant_cashiers;
CREATE POLICY "cashiers_self_read"
  ON public.merchant_cashiers FOR SELECT
  USING (user_id = auth.uid());

-- Service role accès total
DROP POLICY IF EXISTS "cashiers_service_all" ON public.merchant_cashiers;
CREATE POLICY "cashiers_service_all"
  ON public.merchant_cashiers FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ────────────────────────────────────────────────────────────────
-- 5. Mise à jour v_marketplace_products avec featured boost
-- ────────────────────────────────────────────────────────────────
DROP VIEW IF EXISTS public.v_marketplace_products CASCADE;
CREATE OR REPLACE VIEW public.v_marketplace_products AS
SELECT
  p.id,
  p.name,
  p.description,
  p.price_fcfa,
  p.emoji,
  p.image_url,
  p.category,
  p.stock_quantity,
  p.is_available,
  p.featured_until,
  p.created_at                                          AS product_created_at,
  p.marketplace_category_id,
  p.marketplace_subcategory_id,
  mc.slug                                               AS category_slug,
  mc.name                                               AS category_name,
  mc.color_bg                                           AS category_color_bg,
  mc.color_icon                                         AS category_color_icon,
  msc.slug                                              AS subcategory_slug,
  msc.name                                              AS subcategory_name,
  m.id                                                  AS merchant_id,
  m.business_name,
  m.public_slug                                         AS merchant_slug,
  m.subscription_tier,
  m.subscription_expires_at,
  m.is_active                                           AS merchant_active,
  m.is_platform_hub,
  m.user_id                                             AS merchant_user_id,
  -- Score de classement
  (
    -- Tier boost
    CASE m.subscription_tier
      WHEN 'vip' THEN
        CASE WHEN m.subscription_expires_at > now() THEN 30 ELSE 0 END
      WHEN 'pro' THEN 15
      ELSE 0
    END
    -- Popularité : transactions des 30 derniers jours
    + COALESCE((
        SELECT COUNT(*)::int * 2
        FROM public.transactions t
        WHERE t.product_id = p.id
          AND t.status = 'completed'
          AND t.created_at > now() - INTERVAL '30 days'
      ), 0)
    -- Fraîcheur
    + CASE
        WHEN p.created_at > now() - INTERVAL '7 days'  THEN 10
        WHEN p.created_at > now() - INTERVAL '14 days' THEN 5
        ELSE 0
      END
    -- Featured boost (nouveaux produits VIP mis en avant 7 jours)
    + CASE
        WHEN p.featured_until IS NOT NULL AND p.featured_until > now() THEN 25
        ELSE 0
      END
  )                                                     AS ranking_score
FROM public.products p
JOIN public.merchants m ON m.id = p.merchant_id
LEFT JOIN public.marketplace_categories mc  ON mc.id = p.marketplace_category_id
LEFT JOIN public.marketplace_categories msc ON msc.id = p.marketplace_subcategory_id
WHERE p.is_available = true
  AND m.is_active = true
  AND (p.subscription_trigger IS NULL);

COMMENT ON VIEW public.v_marketplace_products IS
  'Produits marketplace avec score de classement. featured_until ajoute +25 (VIP auto-boost 7j).';

-- ────────────────────────────────────────────────────────────────
-- 6. Mise à jour activate_merchant_subscription
--    Gère : pro (10 000), vip (20 000), vip_upgrade depuis pro (5 000)
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_merchant_subscription(
  p_merchant_id  UUID,
  p_tier         TEXT,
  p_amount_fcfa  BIGINT,
  p_payment_ref  TEXT,
  p_method       TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now          TIMESTAMPTZ := NOW();
  v_expires_at   TIMESTAMPTZ;
  v_current_exp  TIMESTAMPTZ;
  v_target_tier  TEXT;
BEGIN
  -- vip_upgrade = upgrade Pro→VIP (5 000 FCFA), on cible 'vip'
  v_target_tier := CASE WHEN p_tier = 'vip_upgrade' THEN 'vip' ELSE p_tier END;

  SELECT subscription_expires_at INTO v_current_exp
  FROM public.merchants WHERE id = p_merchant_id;

  -- Expiration : prolonge depuis l'expiration actuelle si encore active, sinon depuis maintenant
  IF v_current_exp IS NOT NULL AND v_current_exp > v_now THEN
    v_expires_at := v_current_exp + INTERVAL '30 days';
  ELSE
    v_expires_at := v_now + INTERVAL '30 days';
  END IF;

  -- Mettre à jour le marchand
  UPDATE public.merchants SET
    subscription_tier       = v_target_tier,
    subscription_expires_at = v_expires_at,
    subscription_started_at = COALESCE(subscription_started_at, v_now)
  WHERE id = p_merchant_id;

  -- Historique
  INSERT INTO public.merchant_subscriptions
    (merchant_id, tier, amount_fcfa, payment_method, payment_ref, started_at, expires_at)
  VALUES
    (p_merchant_id, v_target_tier, p_amount_fcfa, p_method, p_payment_ref, v_now, v_expires_at);
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 7. Fonction : activer le service agent via subscription_trigger
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.activate_agent_service(p_merchant_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.merchants SET
    agent_service_active = TRUE,
    agent_activated_at   = NOW()
  WHERE id = p_merchant_id;
END;
$$;

-- ────────────────────────────────────────────────────────────────
-- 8. Trigger : générer public_slug automatiquement à l'activation
-- ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.generate_merchant_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_base TEXT;
  v_slug TEXT;
  v_counter INT := 0;
BEGIN
  -- Générer un slug depuis le nom de la boutique
  v_base := lower(
    regexp_replace(
      unaccent(NEW.business_name),
      '[^a-z0-9]+', '-', 'g'
    )
  );
  v_base := trim(both '-' from v_base);
  v_slug := v_base;

  -- Vérifier l'unicité
  WHILE EXISTS (SELECT 1 FROM public.merchants WHERE public_slug = v_slug AND id != NEW.id) LOOP
    v_counter := v_counter + 1;
    v_slug := v_base || '-' || v_counter;
  END LOOP;

  NEW.public_slug := v_slug;
  RETURN NEW;
END;
$$;

-- Installer le trigger sur les nouvelles boutiques
DROP TRIGGER IF EXISTS trg_merchant_slug ON public.merchants;
CREATE TRIGGER trg_merchant_slug
  BEFORE INSERT ON public.merchants
  FOR EACH ROW
  WHEN (NEW.public_slug IS NULL)
  EXECUTE FUNCTION public.generate_merchant_slug();

-- Générer les slugs pour les marchands existants sans slug
UPDATE public.merchants SET public_slug = NULL WHERE public_slug IS NULL;
-- (le trigger ne joue pas sur UPDATE, on fait ça via DO block)
DO $$
DECLARE
  r RECORD;
  v_base TEXT;
  v_slug TEXT;
  v_counter INT;
BEGIN
  FOR r IN SELECT id, business_name FROM public.merchants WHERE public_slug IS NULL ORDER BY created_at LOOP
    v_base := lower(regexp_replace(r.business_name, '[^a-z0-9]+', '-', 'g'));
    v_base := trim(both '-' from v_base);
    v_slug := v_base;
    v_counter := 0;
    WHILE EXISTS (SELECT 1 FROM public.merchants WHERE public_slug = v_slug AND id != r.id) LOOP
      v_counter := v_counter + 1;
      v_slug := v_base || '-' || v_counter;
    END LOOP;
    UPDATE public.merchants SET public_slug = v_slug WHERE id = r.id;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────
-- 9. GreenFlame Hub — seed produits platform
--    Nécessite : un marchand avec is_platform_hub = TRUE
--    (créer via admin panel, puis exécuter le bloc ci-dessous)
-- ────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_hub_id UUID;
BEGIN
  SELECT id INTO v_hub_id FROM public.merchants WHERE is_platform_hub = TRUE LIMIT 1;

  IF v_hub_id IS NULL THEN
    RAISE NOTICE 'GreenFlame Hub non trouvé. Créez le compte Hub via le panel admin puis relancez ce bloc.';
    RETURN;
  END IF;

  -- Supprimer les anciens produits Hub pour idempotence
  DELETE FROM public.products WHERE merchant_id = v_hub_id AND subscription_trigger IS NOT NULL;

  -- Insérer les 4 produits platform
  INSERT INTO public.products
    (merchant_id, name, description, price_fcfa, emoji, is_available, sort_order, subscription_trigger)
  VALUES
    (v_hub_id,
     'Abonnement Marchand Pro',
     'Accès illimité aux produits, devis PDF, factures, analytics avancés et badge Pro sur la marketplace. Durée : 30 jours.',
     10000, '🚀', TRUE, 1, 'pro'),

    (v_hub_id,
     'Abonnement Marchand VIP',
     'Tout le Pro + vitrine publique partageable, multi-caissier, support prioritaire et mise en avant automatique de vos nouveaux produits pendant 7 jours. Durée : 30 jours.',
     20000, '👑', TRUE, 2, 'vip'),

    (v_hub_id,
     'Upgrade Pro → VIP',
     'Passez de Pro à VIP en complétant seulement 5 000 FCFA. Réservé aux abonnés Pro actifs.',
     5000, '⬆️', TRUE, 3, 'vip_upgrade'),

    (v_hub_id,
     'Activation Service Agent',
     'Devenez point de liquidité GreenFlame : déposez et retirez du cash pour les membres de votre communauté. Activation permanente.',
     10000, '🏦', TRUE, 4, 'agent');

  RAISE NOTICE 'Produits GreenFlame Hub insérés pour le marchand %', v_hub_id;
END $$;

-- ────────────────────────────────────────────────────────────────
-- Vérifications finales
-- ────────────────────────────────────────────────────────────────
SELECT 'merchants colonnes' AS check,
  column_name, data_type
FROM information_schema.columns
WHERE table_name = 'merchants'
  AND column_name IN ('public_slug', 'is_platform_hub')
UNION ALL
SELECT 'products colonnes',
  column_name, data_type
FROM information_schema.columns
WHERE table_name = 'products'
  AND column_name IN ('subscription_trigger', 'featured_until');
