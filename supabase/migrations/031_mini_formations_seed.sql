-- ============================================================
-- 031_mini_formations_seed.sql
-- Seed 3 mini-formations GreenFlame Hub dans la table products
-- Propriétaire : marchand GreenFlame Hub (is_platform_hub = true)
-- Catégorie    : Services / Enseignement & formation
-- ============================================================
-- Idempotent : protégé par WHERE NOT EXISTS sur (name, merchant_id)
-- Ne pas exécuter manuellement — passe par le dashboard Supabase.
-- ============================================================

DO $$
DECLARE
  v_merchant_id          UUID;
  v_category_id          UUID;   -- Services (parent)
  v_subcategory_id       UUID;   -- Enseignement & formation
BEGIN

  -- 1. Résoudre l'id du marchand Hub
  SELECT id INTO v_merchant_id
  FROM public.merchants
  WHERE is_platform_hub = TRUE
  LIMIT 1;

  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'Aucun marchand avec is_platform_hub = true trouvé. Veuillez d''abord créer le GreenFlame Hub.';
  END IF;

  -- 2. Résoudre la catégorie parent "Services"
  SELECT id INTO v_category_id
  FROM public.marketplace_categories
  WHERE slug = 'services'
    AND parent_id IS NULL
  LIMIT 1;

  -- 3. Résoudre la sous-catégorie "Enseignement & formation"
  SELECT id INTO v_subcategory_id
  FROM public.marketplace_categories
  WHERE slug = 'enseignement-formation'
  LIMIT 1;

  -- 4. Insérer le produit 1 — Gestion d'argent au quotidien
  INSERT INTO public.products (
    merchant_id,
    name,
    description,
    price_fcfa,
    emoji,
    is_available,
    sort_order,
    marketplace_category_id,
    marketplace_subcategory_id
  )
  SELECT
    v_merchant_id,
    'Gestion d''argent au quotidien (mini-formation)',
    'Tu gagnes de l''argent, et pourtant il disparaît avant la fin du mois sans que tu saches vraiment où il est passé ? Ce n''est pas un problème de volonté, c''est un problème de méthode — et la bonne nouvelle, c''est qu''elle s''apprend en dix minutes. Découvre les 5 règles que les gens qui s''en sortent appliquent presque sans y penser, fais le test pour voir où part réellement ton argent, et repars avec un plan simple à suivre dès aujourd''hui. Mini-formation interactive avec quiz et certificat.',
    200,
    '💰',
    TRUE,
    1,
    v_category_id,
    v_subcategory_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE merchant_id = v_merchant_id
      AND name = 'Gestion d''argent au quotidien (mini-formation)'
  );

  -- 5. Insérer le produit 2 — Transformer ce que tu sais faire
  INSERT INTO public.products (
    merchant_id,
    name,
    description,
    price_fcfa,
    emoji,
    is_available,
    sort_order,
    marketplace_category_id,
    marketplace_subcategory_id
  )
  SELECT
    v_merchant_id,
    'Transformer ce que tu sais déjà faire en revenu (mini-formation)',
    'Tu n''as pas besoin d''un local, d''un stock ou d''un compte en banque bien rempli pour commencer à gagner de l''argent. Tu as déjà quelque chose de plus précieux : un savoir-faire, un réseau, du temps, de l''énergie — et la plupart des gens ne savent simplement pas comment transformer ça en activité. Cette mini-formation t''aide à repérer ce que tu as déjà sous la main et à faire ton premier pas concret cette semaine. Avec quiz et certificat.',
    200,
    '🚀',
    TRUE,
    2,
    v_category_id,
    v_subcategory_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE merchant_id = v_merchant_id
      AND name = 'Transformer ce que tu sais déjà faire en revenu (mini-formation)'
  );

  -- 6. Insérer le produit 3 — Pourquoi tu n'arrives jamais à épargner
  INSERT INTO public.products (
    merchant_id,
    name,
    description,
    price_fcfa,
    emoji,
    is_available,
    sort_order,
    marketplace_category_id,
    marketplace_subcategory_id
  )
  SELECT
    v_merchant_id,
    'Pourquoi tu n''arrives jamais à épargner (mini-formation)',
    'Tu te dis "ce mois-ci, je mets de côté" — et puis le mois se termine, et il ne reste rien. Ce n''est pas un manque de discipline : c''est que personne ne t''a montré la bonne méthode. Cette mini-formation déconstruit les pièges classiques, te montre une approche qui fonctionne même avec très peu, et te fait repartir avec un objectif d''épargne réaliste. Avec quiz et certificat.',
    200,
    '🐷',
    TRUE,
    3,
    v_category_id,
    v_subcategory_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.products
    WHERE merchant_id = v_merchant_id
      AND name = 'Pourquoi tu n''arrives jamais à épargner (mini-formation)'
  );

END $$;
