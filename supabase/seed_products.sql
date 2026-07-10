DO $$
DECLARE v_ep UUID; v_st UUID; v_bq UUID;
BEGIN
  SELECT id INTO v_ep FROM merchants WHERE business_category = 'ALIMENTATION'    LIMIT 1;
  SELECT id INTO v_st FROM merchants WHERE business_category = 'TRANSPORT_SMALL' LIMIT 1;
  SELECT id INTO v_bq FROM merchants WHERE business_category = 'BEAUTE'          LIMIT 1;

  INSERT INTO products (merchant_id, name, price_fcfa, emoji, category, is_available, sort_order) VALUES
    (v_ep, 'Repas du jour',    500, '🍛', 'alimentation', true, 1),
    (v_ep, 'Pain et beignets', 150, '🥖', 'alimentation', true, 2),
    (v_ep, 'Eau potable',       75, '💧', 'boisson',      true, 3),
    (v_ep, 'Boisson fraiche',  150, '🥤', 'boisson',      true, 4),
    (v_ep, 'Condiments',       250, '🌶', 'epicerie',     true, 5),
    (v_st, 'Carburant essence',700, '⛽', 'carburant',    true, 1),
    (v_st, 'Credit telephone', 300, '📱', 'telecom',      true, 2),
    (v_st, 'Course taxi-moto', 200, '🛵', 'transport',    true, 3),
    (v_bq, 'Savon et hygiene', 350, '🧼', 'hygiene',      true, 1),
    (v_bq, 'Medicaments',      500, '💊', 'sante',        true, 2);

  RAISE NOTICE 'Produits inseres : Epicerie=5, Station=3, Boutique=2';
END $$;
