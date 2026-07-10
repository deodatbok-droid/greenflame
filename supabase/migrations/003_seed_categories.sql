-- ================================================================
-- GREENFLAME — Migration 003 : Données initiales
-- ================================================================

-- Catégories marchands et taux de commission
INSERT INTO public.merchant_categories (code, name_fr, commission_rate, notes)
VALUES
  ('ALIMENTATION', 'Alimentation générale', 0.10, NULL),
  ('PHARMACIE', 'Pharmacie et santé', 0.10, NULL),
  ('ELECTRONIQUE', 'Électronique et téléphonie', 0.10, NULL),
  ('AIRTIME', 'Crédit téléphonique et data', 0.10, NULL),
  ('SERVICES', 'Services divers', 0.10, NULL),
  ('BEAUTE', 'Beauté, coiffure, cosmétiques', 0.10, NULL),
  ('VETEMENTS', 'Vêtements et chaussures', 0.10, NULL),
  ('RESTAURANT', 'Restauration standard', 0.10, NULL),
  ('TRANSPORT_SMALL', 'Transport < 500 FCFA (zémidjan)', 0.03, 'Ticket moyen < 500 FCFA'),
  ('TRANSPORT_MED', 'Transport 500-2000 FCFA', 0.04, 'Bus, taxi urban'),
  ('TRANSPORT_LARGE', 'Transport > 2000 FCFA (inter-city)', 0.05, 'Cotonou-Parakou et équivalents'),
  ('RESTAURATION_SMALL', 'Petite restauration < 500 FCFA', 0.03, 'Gargotes, snacks'),
  ('GROSSISTE', 'Grossiste (B2B uniquement)', 0.05, 'CONTRAINTE: jamais de vente directe aux consommateurs finaux')
ON CONFLICT (code) DO NOTHING;

-- ================================================================
-- NOTE : Le compte platform_upline de Déodat DOIT être créé
-- MANUELLEMENT une seule fois après la première connexion.
--
-- Procédure :
-- 1. Déodat se connecte via l'app (phone OTP)
-- 2. Récupérer son auth.uid()
-- 3. Exécuter la procédure ci-dessous en remplaçant [DEODATS_UUID]
-- 4. Ce user_id est ensuite hard-coded dans l'Edge Function process-transaction
-- ================================================================

-- TEMPLATE (à exécuter une seule fois manuellement) :
-- UPDATE public.users
-- SET role = ARRAY['consumer','kingmaker','platform_upline']
-- WHERE id = '[DEODATS_UUID]';
--
-- INSERT INTO public.network_tree (user_id, depth, tree_path)
-- VALUES ('[DEODATS_UUID]', 0, ARRAY['[DEODATS_UUID]'::uuid])
-- ON CONFLICT (user_id) DO UPDATE SET
--   l1_upline = NULL, l2_upline = NULL, l3_upline = NULL,
--   l4_upline = NULL, l5_upline = NULL, depth = 0,
--   tree_path = ARRAY['[DEODATS_UUID]'::uuid];

-- ================================================================
-- Fonction utilitaire : générer un code referral unique
-- ================================================================
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS VARCHAR(20) AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code VARCHAR(20) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    code := code || SUBSTR(chars, floor(random() * length(chars) + 1)::INTEGER, 1);
  END LOOP;
  RETURN 'GF-' || code;
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- Vue consolidée : résumé wallet pour l'UI
-- ================================================================
CREATE OR REPLACE VIEW public.wallet_summary AS
SELECT
  w.id,
  w.user_id,
  u.full_name,
  u.phone,
  u.role,
  w.balance_fcfa,
  w.balance_pgf,
  w.total_earned_fcfa,
  w.total_spent_fcfa,
  w.updated_at
FROM public.wallets w
JOIN public.users u ON u.id = w.user_id;

-- ================================================================
-- Vue : statistiques marchand du jour
-- ================================================================
CREATE OR REPLACE VIEW public.merchant_today_stats AS
SELECT
  m.id AS merchant_id,
  m.business_name,
  m.user_id,
  COUNT(t.id) AS tx_count_today,
  COALESCE(SUM(t.amount_fcfa), 0) AS gmv_today,
  COALESCE(SUM(t.commission_total), 0) AS commission_today
FROM public.merchants m
LEFT JOIN public.transactions t ON
  t.merchant_id = m.id
  AND t.status = 'completed'
  AND t.created_at >= CURRENT_DATE
GROUP BY m.id, m.business_name, m.user_id;

-- ================================================================
-- Vue : commissions réseau d'un kingmaker (30 derniers jours)
-- ================================================================
CREATE OR REPLACE VIEW public.kingmaker_monthly_commissions AS
SELECT
  cd.recipient_id AS kingmaker_id,
  cd.level,
  COUNT(cd.id) AS commission_count,
  SUM(cd.amount_fcfa) AS total_fcfa,
  DATE_TRUNC('month', cd.created_at) AS month
FROM public.commission_distributions cd
WHERE
  cd.distribution_type = 'network'
  AND cd.recipient_id IS NOT NULL
GROUP BY cd.recipient_id, cd.level, DATE_TRUNC('month', cd.created_at);
