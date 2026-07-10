-- 041_hub_tool_products.sql
-- Seed des 4 outils sectoriels dans la boutique GreenFlame Hub
-- Étend aussi la contrainte subscription_trigger pour accepter les slugs outils

ALTER TABLE public.products
  DROP CONSTRAINT IF EXISTS products_subscription_trigger_check;

ALTER TABLE public.products
  ADD CONSTRAINT products_subscription_trigger_check
    CHECK (subscription_trigger = ANY (ARRAY[
      'pro'::text, 'vip'::text, 'vip_upgrade'::text, 'agent'::text,
      'salon'::text, 'couture'::text, 'btp'::text, 'resto'::text
    ]));

DO $$
DECLARE
  v_hub_id UUID;
BEGIN
  SELECT id INTO v_hub_id FROM public.merchants WHERE is_platform_hub = TRUE LIMIT 1;

  IF v_hub_id IS NULL THEN
    RAISE NOTICE 'GreenFlame Hub non trouvé. Créez le compte Hub via le panel admin puis relancez ce bloc.';
    RETURN;
  END IF;

  -- Idempotence : supprimer les anciens produits outils avant ré-insertion
  DELETE FROM public.products
    WHERE merchant_id = v_hub_id
      AND subscription_trigger IN ('salon', 'couture', 'btp', 'resto');

  INSERT INTO public.products
    (merchant_id, name, description, price_fcfa, emoji, is_available, sort_order, subscription_trigger)
  VALUES
    (v_hub_id,
     'Outil Salon & Beauté',
     'Gérez vos produits, calculez vos marges et pilotez vos prestations beauté. 10 000 FCFA/mois ou 100 000 FCFA/an.',
     10000, '✂️', TRUE, 10, 'salon'),

    (v_hub_id,
     'Outil Couture & Mode',
     'Gérez vos clients, leurs mensurations, vos commandes et l''essayage virtuel. 10 000 FCFA/mois ou 100 000 FCFA/an.',
     10000, '🪡', TRUE, 11, 'couture'),

    (v_hub_id,
     'Outil BTP & Artisans',
     'Pilotez vos chantiers, gérez vos matériaux et générez des devis IA en secondes. 10 000 FCFA/mois ou 100 000 FCFA/an.',
     10000, '🏗️', TRUE, 12, 'btp'),

    (v_hub_id,
     'Outil Restauration',
     'Recettes, menus du jour, clients fidèles et prise de commandes en salle. 25 000 FCFA/mois ou 250 000 FCFA/an.',
     25000, '🍲', TRUE, 13, 'resto');

  RAISE NOTICE 'Produits outils GreenFlame Hub insérés pour le marchand %', v_hub_id;
END $$;
