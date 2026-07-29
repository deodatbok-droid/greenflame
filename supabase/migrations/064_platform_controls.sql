-- ================================================================
-- 064_platform_controls — Feature Flags & Platform Settings
-- GreenFlame — contrôle opérationnel sans redéploiement
-- ================================================================

-- 1. Paramètres opérationnels (clé/valeur JSONB)
CREATE TABLE IF NOT EXISTS platform_settings (
  key         text PRIMARY KEY,
  value       jsonb NOT NULL,
  label       text NOT NULL,
  description text,
  category    text NOT NULL CHECK (category IN ('commissions','gfp','network','platform')),
  editable    boolean DEFAULT true,
  updated_at  timestamptz DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 2. Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  description text,
  category    text NOT NULL CHECK (category IN ('module','feature','market','maintenance')),
  enabled     boolean DEFAULT false,
  mode        text DEFAULT 'all' CHECK (mode IN ('all','whitelist','blacklist')),
  updated_at  timestamptz DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

-- 3. Overrides par utilisateur (whitelist / blacklist)
CREATE TABLE IF NOT EXISTS feature_flag_overrides (
  flag_key   text REFERENCES feature_flags(key) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  allowed    boolean NOT NULL DEFAULT true,
  note       text,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  PRIMARY KEY (flag_key, user_id)
);

-- 4. Journal d'audit (toute modification loggée)
CREATE TABLE IF NOT EXISTS platform_settings_audit (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name  text NOT NULL,
  key         text NOT NULL,
  old_value   jsonb,
  new_value   jsonb,
  changed_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at  timestamptz DEFAULT now()
);

-- RLS : accès via service role uniquement (API admin)
ALTER TABLE platform_settings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flags            ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_flag_overrides   ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_settings_audit  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='platform_settings'       AND policyname='service_all') THEN
    CREATE POLICY "service_all" ON platform_settings       FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feature_flags'           AND policyname='service_all') THEN
    CREATE POLICY "service_all" ON feature_flags           FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='feature_flag_overrides'  AND policyname='service_all') THEN
    CREATE POLICY "service_all" ON feature_flag_overrides  FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='platform_settings_audit' AND policyname='service_all') THEN
    CREATE POLICY "service_all" ON platform_settings_audit FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Index utiles
CREATE INDEX IF NOT EXISTS ffo_user_idx ON feature_flag_overrides (user_id);
CREATE INDEX IF NOT EXISTS psa_key_idx  ON platform_settings_audit (key, changed_at DESC);

-- ================================================================
-- SEED — Paramètres opérationnels
-- ================================================================
INSERT INTO platform_settings (key, value, label, description, category) VALUES
  -- Commissions par catégorie (CATEGORY_RATES dans constants.ts)
  ('commission_alimentation',    '0.10', 'Commission Alimentation',     'Taux de commission sur transactions alimentaires',               'commissions'),
  ('commission_pharmacie',       '0.10', 'Commission Pharmacie',        'Taux sur pharmacies et parapharmacie',                          'commissions'),
  ('commission_electronique',    '0.10', 'Commission Électronique',     'Taux sur produits électroniques',                               'commissions'),
  ('commission_airtime',         '0.10', 'Commission Airtime',          'Taux sur recharges téléphoniques',                              'commissions'),
  ('commission_services',        '0.10', 'Commission Services',         'Taux sur services généraux',                                    'commissions'),
  ('commission_grossiste',       '0.05', 'Commission Grossiste',        'Taux sur transactions grossistes',                              'commissions'),
  ('commission_delivery',        '0.05', 'Commission Delivery',         'Taux sur frais de livraison GreenFlame',                        'commissions'),
  ('commission_services_premium','0.15', 'Commission Services Premium', 'Taux C-15 — académie, accompagnement, conseil',                 'commissions'),
  -- GFP
  ('gfp_cash_min_threshold', '50',    'Seuil cashback FCFA (min)',  'Cashback < ce seuil → crédité en GFP au lieu de FCFA',          'gfp'),
  ('gfp_validity_months',    '24',    'Validité GFP (mois)',         'Durée de vie des GFP avant expiration',                         'gfp'),
  ('gfp_min_withdrawal',     '50000', 'Retrait GFP minimum',         'Minimum de GFP pour une conversion en FCFA (1 GFP = 0,1 FCFA)','gfp'),
  -- Réseau
  ('inactivity_spillover_days', '90', 'Inactivité → spillover (jours)', 'Jours sans transaction avant que les dividendes partent au spillover_fund', 'network'),
  -- Plateforme
  ('banner_enabled',  'false',  'Bannière plateforme active', 'Afficher la bannière d''annonce globale sur l''app', 'platform'),
  ('banner_message',  '""',     'Message de la bannière',     'Texte de l''annonce (visible de tous les utilisateurs)',   'platform'),
  ('banner_type',     '"info"', 'Type de bannière',           'Couleur et icône : info | warning | success | error',      'platform')
ON CONFLICT (key) DO NOTHING;

-- ================================================================
-- SEED — Feature Flags
-- ================================================================
INSERT INTO feature_flags (key, label, description, category, enabled) VALUES
  -- Modules métier
  ('module_salon',       'Module Salon',          'Gestion coiffure/beauté pour marchands salon',                   'module', true),
  ('module_couture',     'Module Couture',         'Gestion ateliers, mesures et commandes couture',                'module', true),
  ('module_resto',       'Module Restauration',    'Gestion menus, recettes, commandes et clients restaurant',      'module', true),
  ('module_btp',         'Module BTP',             'Gestion chantiers, matériaux et devis construction',           'module', true),
  ('module_academie',    'Module Académie',         'Outils pédagogiques et suivi de progression',                  'module', true),
  ('module_marketplace', 'Marketplace',             'Catalogue produits GreenFlame pour consommateurs',             'module', true),
  -- Fonctionnalités
  ('tontines',             'Tontines Produit',         'Tontines d''achat collectif avec livraison de produits',    'feature', true),
  ('pack_mystere',         'Pack Mystère',              'Vente de packs surprise avec tirage au sort',              'feature', true),
  ('cagnotte',             'Cagnotte & Tirage',         'Cagnotte communautaire et tirages',                        'feature', true),
  ('vouchers',             'Bons d''achat',              'Bons de retrait et bons d''achat GreenFlame',              'feature', true),
  ('delivery',             'GreenFlame Delivery',       'Module livraison avec tracking et agents terrain',         'feature', true),
  ('agent_network',        'Réseau d''agents terrain',  'Agents de dépôt/retrait cash sur le terrain',              'feature', true),
  ('ussd_payment',         'Paiement USSD',             'Canal de paiement via USSD pour téléphones basiques',      'feature', false),
  ('voice_interface',      'Interface Vocale',           'Commandes vocales et navigation à la voix',               'feature', true),
  ('swahili_module',       'Module Swahili',            'Apprentissage du swahili intégré dans la plateforme',      'feature', true),
  ('whatsapp_chat',        'Chat WhatsApp',              'Intégration chat via WhatsApp Business API',              'feature', true),
  ('career_plan',          'Plan Carrière Leader',       'Programme R0→R8 : rangs et progression des Kingmakers',   'feature', true),
  ('rewards_fund_distrib', 'Distributions Fonds Récompenses', 'Calcul et versement du Fonds Récompenses',          'feature', true),
  -- Marchés géographiques
  ('market_benin',        'Marché Bénin',          'Accès plateforme pour utilisateurs du Bénin',                  'market', true),
  ('market_togo',         'Marché Togo',            'Accès pour utilisateurs du Togo',                             'market', false),
  ('market_cote_ivoire',  'Marché Côte d''Ivoire',  'Accès pour utilisateurs de Côte d''Ivoire',                   'market', false),
  ('market_senegal',      'Marché Sénégal',         'Accès pour utilisateurs du Sénégal',                          'market', false),
  ('market_mali',         'Marché Mali',            'Accès pour utilisateurs du Mali',                             'market', false),
  -- Maintenance & contrôle opérationnel
  ('payments_enabled',     'Flux de paiement',         'DÉSACTIVER coupe tous les paiements immédiatement',        'maintenance', true),
  ('new_registrations',    'Nouvelles inscriptions',   'DÉSACTIVER bloque toute création de compte',               'maintenance', true),
  ('kyc_required',         'KYC obligatoire marchands', 'Activer = les marchands doivent soumettre un KYC validé', 'maintenance', false),
  ('merchant_onboarding',  'Enrôlement marchand',       'DÉSACTIVER bloque les nouvelles demandes marchand',        'maintenance', true)
ON CONFLICT (key) DO NOTHING;
