-- ================================================================
-- Migration 029 : Moteur IA GreenFlame
-- Tables : user_events + user_ai_profile
-- ================================================================
-- Ce sont les fondations du data moat et du moteur de personnalisation.
-- Chaque signal comportemental capturé ici alimente les prédictions.
-- ================================================================

-- ================================================================
-- 1. ENUM : types d'événements comportementaux
-- ================================================================
DO $$ BEGIN
CREATE TYPE public.user_event_type AS ENUM (
  -- Navigation & engagement
  'app_opened',
  'session_started',
  'page_viewed',
  'feature_used',

  -- Notifications
  'notification_sent',
  'notification_opened',
  'notification_ignored',    -- calculé si non ouvert après 24h

  -- Transactions
  'payment_initiated',
  'payment_completed',
  'payment_abandoned',
  'cashback_viewed',
  'cashback_redeemed',

  -- Réseau & recrutement
  'referral_link_copied',
  'referral_link_shared',
  'referral_success',        -- quelqu'un s'est inscrit via ce lien
  'network_viewed',
  'network_level_expanded',  -- a cliqué pour voir son réseau en profondeur

  -- Profil & paramètres
  'profile_viewed',
  'profile_updated',
  'onboarding_step_completed',
  'onboarding_completed',

  -- Marchand
  'merchant_searched',
  'merchant_profile_viewed',
  'merchant_qr_scanned',
  'upgrade_page_viewed',
  'upgrade_initiated',
  'upgrade_completed',

  -- Wallet
  'wallet_viewed',
  'withdrawal_initiated',
  'withdrawal_completed',

  -- Support
  'support_contacted'
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ================================================================
-- 2. ENUM : triggers psychologiques identifiés
-- ================================================================
DO $$ BEGIN
CREATE TYPE public.ai_trigger AS ENUM (
  'belonging',    -- T2 : appartenance / réseau communautaire
  'status',       -- T3 : statut / être le Kingmaker qui élève
  'security',     -- T1 : sécurité / peur de la perte économique
  'fomo',         -- T4 : peur de manquer / loss aversion
  'identity',     -- T6 : identité / cohérence avec ses valeurs
  'certainty',    -- T5 : certitude / besoin de clarté
  'autonomy',     -- T7 : autonomie / contrôle souverain
  'unknown'       -- pas encore déterminé
);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ================================================================
-- 3. TABLE user_events — capture de tous les signaux
-- ================================================================
CREATE TABLE IF NOT EXISTS public.user_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type      public.user_event_type NOT NULL,
  session_id      UUID,                          -- regroupe les événements d'une session
  metadata        JSONB DEFAULT '{}',            -- données contextuelles libres
  -- Exemples metadata :
  -- notification_sent   : { "trigger_used": "status", "message_id": "...", "channel": "whatsapp" }
  -- notification_opened : { "trigger_used": "status", "delay_seconds": 120 }
  -- page_viewed         : { "page": "/network", "duration_seconds": 45 }
  -- feature_used        : { "feature": "referral_copy", "context": "profile" }
  -- payment_completed   : { "merchant_id": "...", "amount": 5000, "cashback": 75 }
  -- upgrade_completed   : { "tier": "pro", "amount": 10000 }
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index pour les requêtes fréquentes
CREATE INDEX IF NOT EXISTS idx_user_events_user_id   ON public.user_events (user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_type      ON public.user_events (event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_created   ON public.user_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_user_type ON public.user_events (user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_metadata  ON public.user_events USING GIN (metadata);

-- Partition automatique par mois pour les performances à grande échelle
-- (à activer quand volume > 10M lignes)

-- ================================================================
-- 4. TABLE user_ai_profile — profil IA de chaque utilisateur
-- ================================================================
CREATE TABLE IF NOT EXISTS public.user_ai_profile (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                 UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- ── Trigger psychologique dominant ─────────────────────────────
  dominant_trigger        public.ai_trigger NOT NULL DEFAULT 'unknown',
  trigger_confidence      NUMERIC(4,3) CHECK (trigger_confidence BETWEEN 0 AND 1) DEFAULT 0,
  -- 0.0 = inconnu, 0.5 = probable, 0.8+ = fort signal, 1.0 = confirmé
  trigger_signals         JSONB DEFAULT '{}',
  -- Stocke les signaux qui ont conduit à ce trigger
  -- { "belonging": 0.7, "status": 0.3, "fomo": 0.1, ... }

  -- ── Scores de prédiction (0 = faible, 1 = fort) ────────────────
  churn_score             NUMERIC(4,3) CHECK (churn_score BETWEEN 0 AND 1) DEFAULT 0,
  -- 0.8+ = risque élevé de churn → intervention urgente
  recruitment_score       NUMERIC(4,3) CHECK (recruitment_score BETWEEN 0 AND 1) DEFAULT 0,
  -- 0.7+ = bon candidat pour être activé au recrutement
  spend_potential_score   NUMERIC(4,3) CHECK (spend_potential_score BETWEEN 0 AND 1) DEFAULT 0,
  -- Potentiel de dépenses non encore capturées par GreenFlame
  upgrade_score           NUMERIC(4,3) CHECK (upgrade_score BETWEEN 0 AND 1) DEFAULT 0,
  -- Pour marchands : probabilité de passer Pro/VIP

  -- ── Métriques comportementales calculées ───────────────────────
  days_since_last_tx      INTEGER DEFAULT NULL,
  total_transactions      INTEGER DEFAULT 0,
  total_gmv_fcfa          BIGINT DEFAULT 0,
  avg_transaction_fcfa    INTEGER DEFAULT 0,
  network_size            INTEGER DEFAULT 0,   -- total filleuls L1-L5
  direct_recruits         INTEGER DEFAULT 0,   -- filleuls directs L1
  notification_open_rate  NUMERIC(4,3) DEFAULT NULL,
  -- ratio notifications ouvertes / envoyées (NULL si aucune envoyée)
  sessions_last_30d       INTEGER DEFAULT 0,
  preferred_payment       VARCHAR(20) DEFAULT NULL,
  -- 'wallet_gf' | 'mtn_momo' | 'moov_money' | 'cash_confirmed'
  most_active_hour        SMALLINT DEFAULT NULL, -- heure 0-23 où l'utilisateur est le plus actif
  most_active_day         SMALLINT DEFAULT NULL, -- jour 0-6 (0=lundi)

  -- ── Personnalisation ───────────────────────────────────────────
  last_message_sent       TIMESTAMPTZ DEFAULT NULL,
  last_message_trigger    public.ai_trigger DEFAULT NULL,
  last_message_opened     BOOLEAN DEFAULT NULL,
  -- Mémorise le dernier message pour ne pas répéter le même type
  message_fatigue_score   NUMERIC(4,3) DEFAULT 0,
  -- Monte si l'utilisateur n'ouvre pas les messages → réduire la fréquence

  -- ── Métadonnées du modèle ──────────────────────────────────────
  model_version           VARCHAR(20) DEFAULT 'heuristic_v1',
  -- 'heuristic_v1' → Phase 1 (règles manuelles)
  -- 'ml_v1'        → Phase 2 (Random Forest)
  -- 'ml_v2'        → Phase 3 (modèle custom)
  last_computed_at        TIMESTAMPTZ DEFAULT NOW(),
  computation_notes       TEXT DEFAULT NULL,
  -- Notes libres sur pourquoi tel score a été attribué

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  updated_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_ai_profile_churn       ON public.user_ai_profile (churn_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_profile_recruitment ON public.user_ai_profile (recruitment_score DESC);
CREATE INDEX IF NOT EXISTS idx_ai_profile_trigger     ON public.user_ai_profile (dominant_trigger);
CREATE INDEX IF NOT EXISTS idx_ai_profile_computed    ON public.user_ai_profile (last_computed_at);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.update_ai_profile_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ai_profile_updated_at ON public.user_ai_profile;
CREATE TRIGGER trg_ai_profile_updated_at
  BEFORE UPDATE ON public.user_ai_profile
  FOR EACH ROW EXECUTE FUNCTION public.update_ai_profile_updated_at();

-- ================================================================
-- 5. Initialiser un profil IA vide à chaque nouvelle inscription
-- ================================================================
CREATE OR REPLACE FUNCTION public.init_ai_profile()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_ai_profile (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_init_ai_profile ON public.users;
CREATE TRIGGER trg_init_ai_profile
  AFTER INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.init_ai_profile();

-- Rétro-remplissage pour les utilisateurs existants
INSERT INTO public.user_ai_profile (user_id)
SELECT id FROM public.users
ON CONFLICT (user_id) DO NOTHING;

-- ================================================================
-- 6. RLS — sécurité
-- ================================================================
ALTER TABLE public.user_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_ai_profile ENABLE ROW LEVEL SECURITY;

-- user_events : l'utilisateur peut insérer ses propres événements
-- (la lecture est réservée au service_role pour l'analyse)
DROP POLICY IF EXISTS "user_events_insert_own" ON public.user_events;
CREATE POLICY "user_events_insert_own" ON public.user_events
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "user_events_select_service" ON public.user_events;
CREATE POLICY "user_events_select_service" ON public.user_events
  FOR SELECT USING (auth.role() = 'service_role');

-- user_ai_profile : lecture/écriture uniquement service_role
-- L'utilisateur ne voit pas son propre profil IA (évite les jeux)
DROP POLICY IF EXISTS "ai_profile_service_only" ON public.user_ai_profile;
CREATE POLICY "ai_profile_service_only" ON public.user_ai_profile
  FOR ALL USING (auth.role() = 'service_role');

-- ================================================================
-- 7. Vue admin — top utilisateurs par score de churn
-- ================================================================
DROP VIEW IF EXISTS public.v_ai_churn_risk CASCADE;
CREATE OR REPLACE VIEW public.v_ai_churn_risk AS
  SELECT
    u.full_name,
    u.phone,
    p.churn_score,
    p.dominant_trigger,
    p.days_since_last_tx,
    p.total_transactions,
    p.network_size,
    p.last_computed_at
  FROM public.user_ai_profile p
  JOIN public.users u ON u.id = p.user_id
  WHERE p.churn_score >= 0.5
  ORDER BY p.churn_score DESC;

GRANT SELECT ON public.v_ai_churn_risk TO authenticated;

-- ================================================================
-- VÉRIFICATION
SELECT
  (SELECT count(*) FROM public.user_ai_profile) AS profiles_initialisés,
  (SELECT count(*) FROM public.users) AS total_users;
-- Les deux nombres doivent être égaux.
-- ================================================================
