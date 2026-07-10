-- Migration 046 : Moteur de scoring GreenFlame + Académie financière
-- Tables : user_scores, budget_profiles, budget_formation_progress, budget_entries, budget_reminders

-- ─── SCORE UTILISATEUR ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_scores (
  user_id           UUID        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  score             INTEGER     NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 1000),
  score_details     JSONB       NOT NULL DEFAULT '{}',
  niveau            TEXT        NOT NULL DEFAULT 'debutant'
                                CHECK (niveau IN ('debutant','actif','fiable','avance','expert')),
  bnpl_eligible     BOOLEAN     NOT NULL DEFAULT FALSE,
  bnpl_plafond_fcfa INTEGER     NOT NULL DEFAULT 0,
  last_computed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.user_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_score_select_own" ON public.user_scores;
CREATE POLICY "user_score_select_own" ON public.user_scores
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- ─── PROFIL BUDGET ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_profiles (
  user_id                 UUID    PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  revenus_mensuels_fcfa   INTEGER NOT NULL DEFAULT 0,
  enveloppe_besoins_pct   INTEGER NOT NULL DEFAULT 65 CHECK (enveloppe_besoins_pct BETWEEN 0 AND 100),
  enveloppe_epargne_pct   INTEGER NOT NULL DEFAULT 15 CHECK (enveloppe_epargne_pct BETWEEN 0 AND 100),
  enveloppe_libre_pct     INTEGER NOT NULL DEFAULT 20 CHECK (enveloppe_libre_pct BETWEEN 0 AND 100),
  objectif_epargne_fcfa   INTEGER NOT NULL DEFAULT 0,
  objectif_epargne_label  TEXT,
  objectif_epargne_date   DATE,
  coussin_actuel_fcfa     INTEGER NOT NULL DEFAULT 0,
  service_type            TEXT,   -- type d'activité déclarée (F2 simulator)
  tarif_moyen_fcfa        INTEGER,
  prestations_par_semaine INTEGER,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.budget_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budget_profile_own" ON public.budget_profiles;
CREATE POLICY "budget_profile_own" ON public.budget_profiles
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── PROGRESSION FORMATIONS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_formation_progress (
  user_id         UUID    PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  -- F1 : Gestion argent quotidien
  f1_simulator    BOOLEAN NOT NULL DEFAULT FALSE,
  f1_quiz_score   INTEGER CHECK (f1_quiz_score BETWEEN 0 AND 5),
  f1_cert_at      TIMESTAMPTZ,
  -- F2 : Transformer savoir-faire en revenu
  f2_simulator    BOOLEAN NOT NULL DEFAULT FALSE,
  f2_quiz_score   INTEGER CHECK (f2_quiz_score BETWEEN 0 AND 5),
  f2_cert_at      TIMESTAMPTZ,
  -- F3 : Épargner enfin
  f3_simulator    BOOLEAN NOT NULL DEFAULT FALSE,
  f3_quiz_score   INTEGER CHECK (f3_quiz_score BETWEEN 0 AND 5),
  f3_cert_at      TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.budget_formation_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formation_progress_own" ON public.budget_formation_progress;
CREATE POLICY "formation_progress_own" ON public.budget_formation_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── ENTRÉES BUDGET (suivi quotidien) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_entries (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  montant_fcfa  INTEGER     NOT NULL CHECK (montant_fcfa > 0),
  type          TEXT        NOT NULL DEFAULT 'depense'
                            CHECK (type IN ('rentree','depense_fixe','depense_variable','epargne')),
  categorie     TEXT        NOT NULL DEFAULT 'autre'
                            CHECK (categorie IN (
                              'alimentation','transport','loyer','sante','scolarite',
                              'tontine','communication','loisirs','imprevus','dettes',
                              'epargne','autre'
                            )),
  description   TEXT,
  source        TEXT        NOT NULL DEFAULT 'manual'
                            CHECK (source IN ('manual','voice','momo_auto')),
  date_entree   DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.budget_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budget_entries_own" ON public.budget_entries;
CREATE POLICY "budget_entries_own" ON public.budget_entries
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_budget_entries_user_date ON public.budget_entries(user_id, date_entree DESC);

-- ─── RAPPELS BUDGET ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_reminders (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  label         TEXT    NOT NULL,
  montant_fcfa  INTEGER NOT NULL DEFAULT 0,
  categorie     TEXT    NOT NULL DEFAULT 'autre',
  frequence     TEXT    NOT NULL DEFAULT 'mensuel'
                        CHECK (frequence IN ('mensuel','hebdomadaire','annuel')),
  jour_du_mois  INTEGER CHECK (jour_du_mois BETWEEN 1 AND 31),
  actif         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.budget_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "budget_reminders_own" ON public.budget_reminders;
CREATE POLICY "budget_reminders_own" ON public.budget_reminders
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
