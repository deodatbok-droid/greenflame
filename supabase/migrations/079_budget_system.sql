-- ============================================================================
-- 079 — Système Budget Personnel
--
-- 3 tables :
--   budget_entries     → toutes les entrées (revenus + dépenses), manuelles
--                        ou importées automatiquement depuis les transactions GF
--   budget_limits      → plafonds mensuels par catégorie de dépense
--   savings_goals      → objectifs d'épargne personnels (avec lien tontine)
-- ============================================================================

-- ── BUDGET ENTRIES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_entries (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Type : revenu ou dépense
  type                TEXT          NOT NULL CHECK (type IN ('income', 'expense')),

  -- Montant en FCFA (toujours positif)
  amount_fcfa         NUMERIC       NOT NULL CHECK (amount_fcfa > 0),

  -- Catégorie (key string, ex. 'alimentation', 'salaire', 'transport', ...)
  category            TEXT          NOT NULL,

  -- Libellé libre (ex. "Courses marché central", "Loyer novembre")
  label               TEXT,

  -- Note optionnelle
  note                TEXT,

  -- Date de la transaction (pas forcément aujourd'hui pour saisie rétrospective)
  entry_date          DATE          NOT NULL DEFAULT CURRENT_DATE,

  -- Clé de mois pour regroupements rapides (ex. '2026-07')
  month_key           TEXT          NOT NULL GENERATED ALWAYS AS
                        (to_char(entry_date, 'YYYY-MM')) STORED,

  -- Source : saisie manuelle ou import automatique depuis une transaction GF
  source              TEXT          NOT NULL DEFAULT 'manual'
                        CHECK (source IN ('manual', 'gf_transaction')),

  -- Référence optionnelle à la transaction GF d'origine (évite les doublons)
  gf_transaction_id   UUID          REFERENCES public.transactions(id) ON DELETE SET NULL,

  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW(),

  -- Un import GF ne peut exister qu'une fois par entrée
  UNIQUE (user_id, gf_transaction_id)
);

CREATE INDEX IF NOT EXISTS idx_budget_entries_user_month
  ON public.budget_entries(user_id, month_key);
CREATE INDEX IF NOT EXISTS idx_budget_entries_user_type
  ON public.budget_entries(user_id, type);
CREATE INDEX IF NOT EXISTS idx_budget_entries_gf_transaction
  ON public.budget_entries(gf_transaction_id)
  WHERE gf_transaction_id IS NOT NULL;

-- ── BUDGET LIMITS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.budget_limits (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Même clé catégorie que budget_entries
  category            TEXT          NOT NULL,

  -- Plafond mensuel en FCFA
  monthly_limit_fcfa  NUMERIC       NOT NULL CHECK (monthly_limit_fcfa > 0),

  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW(),

  UNIQUE (user_id, category)
);

CREATE INDEX IF NOT EXISTS idx_budget_limits_user
  ON public.budget_limits(user_id);

-- ── SAVINGS GOALS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID          NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Titre de l'objectif (ex. "Scolarité enfants", "Fonds d'urgence")
  title                 TEXT          NOT NULL,

  -- Icône emoji
  icon                  TEXT          NOT NULL DEFAULT '🎯',

  -- Montant cible en FCFA
  target_amount_fcfa    NUMERIC       NOT NULL CHECK (target_amount_fcfa > 0),

  -- Montant épargné à ce jour (mis à jour manuellement par l'utilisateur)
  current_amount_fcfa   NUMERIC       NOT NULL DEFAULT 0
                          CHECK (current_amount_fcfa >= 0),

  -- Date cible optionnelle
  deadline              DATE,

  -- Catégorie pour filtrage tontines (ex. 'education', 'sante', 'logement', ...)
  goal_category         TEXT,

  -- Montant de cotisation mensuelle souhaitée (aide à filtrer les tontines)
  target_monthly_fcfa   NUMERIC       CHECK (target_monthly_fcfa > 0),

  -- Statut
  status                TEXT          NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'completed', 'paused')),

  created_at            TIMESTAMPTZ   DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_user
  ON public.savings_goals(user_id, status);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.budget_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_limits   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals   ENABLE ROW LEVEL SECURITY;

-- budget_entries : accès réservé à l'utilisateur lui-même
CREATE POLICY "budget_entries_owner" ON public.budget_entries
  FOR ALL USING (auth.uid() = user_id);

-- budget_limits : accès réservé à l'utilisateur lui-même
CREATE POLICY "budget_limits_owner" ON public.budget_limits
  FOR ALL USING (auth.uid() = user_id);

-- savings_goals : accès réservé à l'utilisateur lui-même
CREATE POLICY "savings_goals_owner" ON public.savings_goals
  FOR ALL USING (auth.uid() = user_id);

-- ── COMMENTAIRES ─────────────────────────────────────────────────────────────
COMMENT ON TABLE public.budget_entries IS
  'Entrées de budget personnel (revenus + dépenses quotidiennes). Inclut les achats sur la plateforme GF (source=gf_transaction) et toutes les dépenses de vie courante (source=manual).';

COMMENT ON TABLE public.budget_limits IS
  'Plafonds mensuels par catégorie de dépense, définis par chaque utilisateur.';

COMMENT ON TABLE public.savings_goals IS
  'Objectifs d''épargne personnels avec suivi de progression. goal_category et target_monthly_fcfa servent à filtrer les tontines communautaires correspondantes.';
