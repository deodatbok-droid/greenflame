-- ══════════════════════════════════════════════════════════════
-- Migration 063 — Fonds Récompenses/Événements + Plan de Carrière Leaders
-- ══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. FONDS RÉCOMPENSES/ÉVÉNEMENTS
--    3% de chaque commission marchande, répartis 30% récomp. / 70% événements
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rewards_fund_ledger (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id    uuid        NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  amount_fcfa       integer     NOT NULL CHECK (amount_fcfa >= 0),
  pool_recompenses  integer     NOT NULL CHECK (pool_recompenses >= 0),  -- 30%
  pool_evenements   integer     NOT NULL CHECK (pool_evenements >= 0),   -- 70%
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Table des distributions manuelles depuis le fonds
CREATE TABLE IF NOT EXISTS rewards_fund_distributions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  pool_type       text        NOT NULL CHECK (pool_type IN ('recompenses', 'evenements')),
  amount_fcfa     integer     NOT NULL CHECK (amount_fcfa > 0),
  recipient_id    uuid        REFERENCES users(id) ON DELETE SET NULL,  -- null = événement collectif
  description     text        NOT NULL,
  distributed_by  uuid        REFERENCES users(id) ON DELETE SET NULL,  -- admin
  distributed_at  timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- Vue agrégée pour le dashboard admin
DROP VIEW IF EXISTS rewards_fund_summary CASCADE;
CREATE OR REPLACE VIEW rewards_fund_summary AS
SELECT
  COALESCE(SUM(pool_recompenses), 0)                                              AS total_pool_recompenses,
  COALESCE(SUM(pool_evenements),  0)                                              AS total_pool_evenements,
  COALESCE(SUM(amount_fcfa),      0)                                              AS total_fonds,
  COUNT(*)                                                                         AS nb_transactions,
  COALESCE((SELECT SUM(amount_fcfa) FROM rewards_fund_distributions WHERE pool_type = 'recompenses'), 0) AS total_distribue_recompenses,
  COALESCE((SELECT SUM(amount_fcfa) FROM rewards_fund_distributions WHERE pool_type = 'evenements'),  0) AS total_distribue_evenements
FROM rewards_fund_ledger;

-- Index
CREATE INDEX IF NOT EXISTS idx_rewards_fund_ledger_txid ON rewards_fund_ledger(transaction_id);
CREATE INDEX IF NOT EXISTS idx_rewards_fund_ledger_created ON rewards_fund_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rewards_fund_distrib_pool ON rewards_fund_distributions(pool_type);

-- RLS
ALTER TABLE rewards_fund_ledger         ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards_fund_distributions  ENABLE ROW LEVEL SECURITY;

-- Seuls les admins peuvent lire/écrire
DROP POLICY IF EXISTS "admin_only_rewards_fund_ledger" ON rewards_fund_ledger;
CREATE POLICY "admin_only_rewards_fund_ledger"
  ON rewards_fund_ledger FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(role))
  );

DROP POLICY IF EXISTS "admin_only_rewards_fund_distributions" ON rewards_fund_distributions;
CREATE POLICY "admin_only_rewards_fund_distributions"
  ON rewards_fund_distributions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(role))
  );

-- ─────────────────────────────────────────────────────────────
-- 2. PLAN DE CARRIÈRE LEADERS
--    8 rangs (R0 Visiteur → R8 Elder), triple verrou par rang
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS leader_career_ranks (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                   uuid        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  current_rank              smallint    NOT NULL DEFAULT 0 CHECK (current_rank BETWEEN 0 AND 8),
  -- Progression vers le rang suivant (% de validation de chaque verrou)
  verrou_structure_pct      smallint    NOT NULL DEFAULT 0 CHECK (verrou_structure_pct BETWEEN 0 AND 100),
  verrou_volume_pct         smallint    NOT NULL DEFAULT 0 CHECK (verrou_volume_pct BETWEEN 0 AND 100),
  verrou_marchands_pct      smallint    NOT NULL DEFAULT 0 CHECK (verrou_marchands_pct BETWEEN 0 AND 100),
  -- Métadonnées du rang actuel
  rank_achieved_at          timestamptz,
  last_evaluated_at         timestamptz NOT NULL DEFAULT now(),
  -- Données brutes pour l'évaluation
  direct_affiliates_count   integer     NOT NULL DEFAULT 0,
  direct_affiliates_at_rank integer     NOT NULL DEFAULT 0,  -- affiliés au rang requis (R-1)
  avg_volume_per_member     integer     NOT NULL DEFAULT 0,  -- FCFA/membre/mois
  direct_merchants_count    integer     NOT NULL DEFAULT 0,
  network_merchants_count   integer     NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS leader_career_history (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank_from       smallint    NOT NULL,
  rank_to         smallint    NOT NULL,
  rank_name       text        NOT NULL,  -- "Builder", "Leader Flamme", etc.
  achieved_at     timestamptz NOT NULL DEFAULT now(),
  -- Snapshot des conditions validées au moment du passage
  snapshot        jsonb       NOT NULL DEFAULT '{}'::jsonb
);

-- Index
CREATE INDEX IF NOT EXISTS idx_leader_career_ranks_user ON leader_career_ranks(user_id);
CREATE INDEX IF NOT EXISTS idx_leader_career_history_user ON leader_career_history(user_id);
CREATE INDEX IF NOT EXISTS idx_leader_career_history_rank ON leader_career_history(rank_to);

-- RLS
ALTER TABLE leader_career_ranks   ENABLE ROW LEVEL SECURITY;
ALTER TABLE leader_career_history ENABLE ROW LEVEL SECURITY;

-- Utilisateur : peut lire son propre rang
DROP POLICY IF EXISTS "user_read_own_career_rank" ON leader_career_ranks;
CREATE POLICY "user_read_own_career_rank"
  ON leader_career_ranks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_read_own_career_history" ON leader_career_history;
CREATE POLICY "user_read_own_career_history"
  ON leader_career_history FOR SELECT
  USING (auth.uid() = user_id);

-- Admin : accès complet
DROP POLICY IF EXISTS "admin_full_career_ranks" ON leader_career_ranks;
CREATE POLICY "admin_full_career_ranks"
  ON leader_career_ranks FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(role))
  );

DROP POLICY IF EXISTS "admin_full_career_history" ON leader_career_history;
CREATE POLICY "admin_full_career_history"
  ON leader_career_history FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(role))
  );

-- Service role : écriture (pour l'engine)
DROP POLICY IF EXISTS "service_write_career_ranks" ON leader_career_ranks;
CREATE POLICY "service_write_career_ranks"
  ON leader_career_ranks FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "service_write_career_history" ON leader_career_history;
CREATE POLICY "service_write_career_history"
  ON leader_career_history FOR ALL
  USING (auth.role() = 'service_role');
