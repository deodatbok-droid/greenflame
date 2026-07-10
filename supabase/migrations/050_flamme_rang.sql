-- ================================================================
-- Migration 050 — Système Flamme + Rang GreenFlame
-- Tables : user_flammes, flamme_events, rang_history
-- ================================================================
-- Logique :
--   Score = Flammes_Activité + (Flammes_Autonomie × 0.5)
--   Rangs : étincelle → flamme → brasier → étoile → soleil
--   Hard gates :
--     brasier  : score ≥ 150 ET ≥ 1 objectif de vie couvert
--     étoile   : score ≥ 350 ET ≥ 3 objectifs couverts
--     soleil   : score ≥ 700 ET autonomie totale (258 500 F/mois)
--   Inactivité 60j (0 transaction ET 0 connexion) → descente 1 rang
-- ================================================================

-- ─── TYPE RANG ───────────────────────────────────────────────────────────────
DO $$ BEGIN
CREATE TYPE public.rang_level AS ENUM (
  'étincelle',
  'flamme',
  'brasier',
  'étoile',
  'soleil'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── USER_FLAMMES ─────────────────────────────────────────────────────────────
-- Agrégat courant par utilisateur (source de vérité pour l'affichage)
CREATE TABLE IF NOT EXISTS public.user_flammes (
  user_id               UUID          PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  flammes_activite      INTEGER       NOT NULL DEFAULT 0 CHECK (flammes_activite >= 0),
  flammes_autonomie     INTEGER       NOT NULL DEFAULT 0 CHECK (flammes_autonomie >= 0),
  -- score = flammes_activite + (flammes_autonomie * 0.5), stocké pour indexation
  score_flamme          NUMERIC(10,1) NOT NULL DEFAULT 0,
  rang                  public.rang_level NOT NULL DEFAULT 'étincelle',
  -- cache des objectifs de vie couverts (mis à jour à chaque cashback mensuel)
  life_goals_covered    INTEGER       NOT NULL DEFAULT 0 CHECK (life_goals_covered BETWEEN 0 AND 9),
  monthly_income_fcfa   BIGINT        NOT NULL DEFAULT 0,
  -- horodatage de la dernière action déclenchant une FA (achat, cashback, etc.)
  last_fa_event_at      TIMESTAMPTZ,
  -- horodatage de la dernière connexion à l'app (mis à jour par /api/events)
  last_connection_at    TIMESTAMPTZ,
  -- inactivité : si NOW() - GREATEST(last_fa_event_at, last_connection_at) > 60j
  -- → descente d'un rang au prochain cron
  inactivity_demoted_at TIMESTAMPTZ,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_flammes_rang ON public.user_flammes(rang);
CREATE INDEX IF NOT EXISTS idx_user_flammes_score ON public.user_flammes(score_flamme DESC);

ALTER TABLE public.user_flammes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flammes_select_own" ON public.user_flammes;
CREATE POLICY "flammes_select_own" ON public.user_flammes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "flammes_admin_all" ON public.user_flammes;
CREATE POLICY "flammes_admin_all" ON public.user_flammes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- ─── FLAMME_EVENTS ────────────────────────────────────────────────────────────
-- Journal immuable de chaque flamme attribuée ou déduire
CREATE TABLE IF NOT EXISTS public.flamme_events (
  id                      UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- type d'événement
  event_type              TEXT          NOT NULL CHECK (event_type IN (
    -- Flammes d'Activité (FA)
    'fa_purchase',          -- achat complété chez un marchand
    'fa_cashback_monthly',  -- cashback mensuel reçu
    'fa_network_commission',-- commission réseau reçue
    'fa_tontine_cotisation',-- cotisation tontine payée
    'fa_academie_module',   -- module académie validé (×2 si formation premium)
    -- Flammes d'Autonomie (FAU) — one-shot par palier
    'fau_life_goal',        -- objectif de vie franchi pour la 1ère fois
    -- Admin
    'fa_admin_grant',       -- attribution manuelle admin
    'fa_admin_deduct',      -- déduction admin
    'fau_admin_grant'       -- FAU admin
  )),
  -- deltas (toujours positifs sauf pour les déductions admin)
  fa_delta                INTEGER       NOT NULL DEFAULT 0,
  fau_delta               INTEGER       NOT NULL DEFAULT 0,
  -- référence vers l'entité source (transaction, formation, tontine…)
  reference_id            UUID,
  reference_type          TEXT          CHECK (reference_type IN (
    'transaction', 'cashback_period', 'commission_distribution',
    'tontine_cotisation', 'academie_module', 'life_goal', 'admin'
  )),
  -- pour FAU : quel objectif de vie (index 0–8)
  life_goal_index         INTEGER       CHECK (life_goal_index BETWEEN 0 AND 8),
  -- contexte libre
  metadata                JSONB         NOT NULL DEFAULT '{}',
  created_at              TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flamme_events_user_id ON public.flamme_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flamme_events_type ON public.flamme_events(event_type);
CREATE INDEX IF NOT EXISTS idx_flamme_events_reference ON public.flamme_events(reference_id) WHERE reference_id IS NOT NULL;

ALTER TABLE public.flamme_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flamme_events_select_own" ON public.flamme_events;
CREATE POLICY "flamme_events_select_own" ON public.flamme_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "flamme_events_admin_all" ON public.flamme_events;
CREATE POLICY "flamme_events_admin_all" ON public.flamme_events
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- ─── RANG_HISTORY ─────────────────────────────────────────────────────────────
-- Journal de chaque changement de rang (promotion ou descente)
CREATE TABLE IF NOT EXISTS public.rang_history (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID              NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  rang_from       public.rang_level NOT NULL,
  rang_to         public.rang_level NOT NULL,
  reason          TEXT              NOT NULL CHECK (reason IN (
    'promotion_score',     -- score + gates validés
    'inactivity_demotion', -- 60j sans activité
    'admin_adjustment'     -- correction manuelle
  )),
  score_at_change NUMERIC(10,1)     NOT NULL,
  life_goals_at_change INTEGER      NOT NULL DEFAULT 0,
  -- pour les célébrations Étoile/Soleil
  celebrated      BOOLEAN           NOT NULL DEFAULT FALSE,
  celebrated_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rang_history_user ON public.rang_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rang_history_rang_to ON public.rang_history(rang_to, created_at DESC);

ALTER TABLE public.rang_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rang_history_select_own" ON public.rang_history;
CREATE POLICY "rang_history_select_own" ON public.rang_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "rang_history_admin_all" ON public.rang_history;
CREATE POLICY "rang_history_admin_all" ON public.rang_history
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- ─── FAU_MILESTONES_GRANTED ───────────────────────────────────────────────────
-- Table de déduplication : garantit qu'un palier FAU n'est accordé qu'une fois
CREATE TABLE IF NOT EXISTS public.fau_milestones_granted (
  user_id          UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  life_goal_index  INTEGER NOT NULL CHECK (life_goal_index BETWEEN 0 AND 8),
  fau_granted      INTEGER NOT NULL,
  granted_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, life_goal_index)
);

ALTER TABLE public.fau_milestones_granted ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fau_milestones_select_own" ON public.fau_milestones_granted;
CREATE POLICY "fau_milestones_select_own" ON public.fau_milestones_granted
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─── VUE AGRÉGÉE (lecture admin) ─────────────────────────────────────────────
DROP VIEW IF EXISTS public.flamme_rang_summary CASCADE;
CREATE OR REPLACE VIEW public.flamme_rang_summary AS
SELECT
  uf.user_id,
  u.full_name,
  u.phone,
  uf.flammes_activite,
  uf.flammes_autonomie,
  uf.score_flamme,
  uf.rang,
  uf.life_goals_covered,
  uf.monthly_income_fcfa,
  uf.last_fa_event_at,
  uf.last_connection_at,
  uf.updated_at,
  (
    SELECT COUNT(*) FROM public.flamme_events fe
    WHERE fe.user_id = uf.user_id
  ) AS total_events
FROM public.user_flammes uf
JOIN public.users u ON u.id = uf.user_id;

-- Stats globales pour affichage communautaire (public — uniquement les compteurs)
DROP VIEW IF EXISTS public.flamme_community_stats CASCADE;
CREATE OR REPLACE VIEW public.flamme_community_stats AS
SELECT
  COUNT(*) FILTER (WHERE rang = 'étincelle') AS count_etincelle,
  COUNT(*) FILTER (WHERE rang = 'flamme')    AS count_flamme,
  COUNT(*) FILTER (WHERE rang = 'brasier')   AS count_brasier,
  COUNT(*) FILTER (WHERE rang = 'étoile')    AS count_etoile,
  COUNT(*) FILTER (WHERE rang = 'soleil')    AS count_soleil,
  COUNT(*)                                   AS total_members
FROM public.user_flammes;
