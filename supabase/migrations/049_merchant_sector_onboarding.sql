-- ================================================================
-- Migration 049 : Onboarding sectoriel marchand
-- Tables  : merchant_onboarding_responses
-- Colonnes : merchants.sector, merchants.sector_activated_at
-- ================================================================
-- Un marchand Pro complète un questionnaire 6 questions.
-- Les réponses configurent son outil sectoriel sur mesure
-- ET alimentent le profil IA + les analytics admin.
-- Pendant la période de lancement, la personnalisation est offerte
-- (valeur 5 000 FCFA) en échange du remplissage du questionnaire.
-- ================================================================

-- ── 1. Colonnes sur la table merchants ──────────────────────────

ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS sector              TEXT,
  ADD COLUMN IF NOT EXISTS sector_client_type  TEXT,   -- 'B2C' | 'B2B' | 'mixed'
  ADD COLUMN IF NOT EXISTS sector_activated_at TIMESTAMPTZ;

COMMENT ON COLUMN public.merchants.sector              IS 'Clé SectorConfig : consultant, avocat, photographe, etc.';
COMMENT ON COLUMN public.merchants.sector_client_type  IS 'Type de clientèle déclaré : B2C, B2B ou mixed';
COMMENT ON COLUMN public.merchants.sector_activated_at IS 'Date d''activation de l''outil sectoriel sur mesure';

-- ── 2. Table des réponses au questionnaire ───────────────────────

CREATE TABLE IF NOT EXISTS public.merchant_onboarding_responses (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id      UUID        NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,

  -- Q1 — Secteur (clé SectorConfig)
  sector           TEXT        NOT NULL,

  -- Q2 — Type de clientèle
  client_type      TEXT        NOT NULL
                   CHECK (client_type IN ('B2C', 'B2B', 'mixed')),

  -- Q3 — Panier moyen déclaré
  avg_basket       TEXT        NOT NULL
                   CHECK (avg_basket IN ('<10k', '10k-50k', '50k-200k', '>200k')),

  -- Q4 — Volume mensuel déclaré
  monthly_volume   TEXT        NOT NULL
                   CHECK (monthly_volume IN ('<10', '10-30', '30-100', '>100')),

  -- Q5 — Défis principaux (jusqu'à 2 choix)
  main_challenges  TEXT[]      NOT NULL DEFAULT '{}',

  -- Q6 — Ancienneté de l'activité
  seniority        TEXT        NOT NULL
                   CHECK (seniority IN ('<6m', '6m-2y', '2y-5y', '>5y')),

  -- Activation
  tool_activated   BOOLEAN     NOT NULL DEFAULT FALSE,
  activated_at     TIMESTAMPTZ,

  -- Métadonnées
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Un marchand = une réponse (upsertable)
  CONSTRAINT merchant_onboarding_unique UNIQUE (merchant_id)
);

COMMENT ON TABLE public.merchant_onboarding_responses IS
  'Réponses au questionnaire de personnalisation sectorielle. Dual purpose : config outil + profil IA.';

-- ── 3. Index analytiques ─────────────────────────────────────────

-- Distribution par secteur
CREATE INDEX IF NOT EXISTS idx_onboarding_sector
  ON public.merchant_onboarding_responses (sector);

-- Segmentation B2C/B2B
CREATE INDEX IF NOT EXISTS idx_onboarding_client_type
  ON public.merchant_onboarding_responses (client_type);

-- Taux d'activation (funnel questionnaire → outil actif)
CREATE INDEX IF NOT EXISTS idx_onboarding_activated
  ON public.merchant_onboarding_responses (tool_activated, activated_at);

-- Jointure admin par marchand
CREATE INDEX IF NOT EXISTS idx_onboarding_merchant
  ON public.merchant_onboarding_responses (merchant_id);

-- ── 4. Trigger updated_at ────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_onboarding_updated_at
  ON public.merchant_onboarding_responses;

CREATE TRIGGER trg_onboarding_updated_at
  BEFORE UPDATE ON public.merchant_onboarding_responses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── 5. Vue admin — analytics agrégées ───────────────────────────

DROP VIEW IF EXISTS public.v_sector_analytics CASCADE;
CREATE OR REPLACE VIEW public.v_sector_analytics AS
SELECT
  r.sector,
  COUNT(*)                                              AS total_responses,
  COUNT(*) FILTER (WHERE r.tool_activated)             AS activated_count,
  ROUND(
    COUNT(*) FILTER (WHERE r.tool_activated)::NUMERIC
    / NULLIF(COUNT(*), 0) * 100, 1
  )                                                     AS activation_rate_pct,

  -- Distribution type client
  COUNT(*) FILTER (WHERE r.client_type = 'B2C')        AS b2c_count,
  COUNT(*) FILTER (WHERE r.client_type = 'B2B')        AS b2b_count,
  COUNT(*) FILTER (WHERE r.client_type = 'mixed')      AS mixed_count,

  -- Panier moyen déclaré (modal)
  MODE() WITHIN GROUP (ORDER BY r.avg_basket)          AS most_common_basket,

  -- Volume mensuel déclaré (modal)
  MODE() WITHIN GROUP (ORDER BY r.monthly_volume)      AS most_common_volume,

  -- Ancienneté (modal)
  MODE() WITHIN GROUP (ORDER BY r.seniority)           AS most_common_seniority,

  MIN(r.created_at)                                    AS first_response_at,
  MAX(r.created_at)                                    AS last_response_at

FROM public.merchant_onboarding_responses r
GROUP BY r.sector
ORDER BY total_responses DESC;

COMMENT ON VIEW public.v_sector_analytics IS
  'Vue admin — distribution des secteurs, taux d''activation, profils déclarés.';

-- ── 6. Vue admin — défis terrain agrégés ────────────────────────

DROP VIEW IF EXISTS public.v_challenges_analytics CASCADE;
CREATE OR REPLACE VIEW public.v_challenges_analytics AS
SELECT
  challenge,
  COUNT(*) AS mention_count,
  ROUND(COUNT(*)::NUMERIC / (SELECT COUNT(*) FROM public.merchant_onboarding_responses) * 100, 1) AS pct_of_merchants
FROM public.merchant_onboarding_responses,
     UNNEST(main_challenges) AS challenge
GROUP BY challenge
ORDER BY mention_count DESC;

COMMENT ON VIEW public.v_challenges_analytics IS
  'Vue admin — fréquence des défis terrain cités par les marchands.';

-- ── 7. RLS — marchands ne voient que leurs propres réponses ─────

ALTER TABLE public.merchant_onboarding_responses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchant_own_responses" ON public.merchant_onboarding_responses;
CREATE POLICY "merchant_own_responses"
  ON public.merchant_onboarding_responses
  FOR ALL
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants
      WHERE user_id = auth.uid()
    )
  );

-- Admins voient tout (via service_role ou rôle admin)
DROP POLICY IF EXISTS "admin_all_responses" ON public.merchant_onboarding_responses;
CREATE POLICY "admin_all_responses"
  ON public.merchant_onboarding_responses
  FOR ALL
  TO service_role
  USING (TRUE);
