-- ══════════════════════════════════════════════════════════════════════════
-- Migration 081 — Fonds de Reconnaissance : sous-pools Fibonacci par palier
--
-- RÉVISION COMPLÈTE du modèle de distribution :
--   Avant (080) : distribution mensuelle à tous les leaders R3+
--   Après (081)  : distribution UNIQUEMENT au franchissement de palier,
--                  depuis un sous-pool dédié à chaque rang.
--
-- MÉCANIQUE :
--   Le fonds global (10% de chaque dividende communautaire) est segmenté en
--   5 sous-pools permanents selon les poids Fibonacci (somme = 50) :
--     R3 Builder       : 3/50 =  6 %
--     R4 Leader Flamme : 5/50 = 10 %
--     R5 Leader Brasier: 8/50 = 16 %
--     R6 Ambassadeur   :13/50 = 26 %
--     R7 Kingmaker     :21/50 = 42 %
--
--   Chaque sous-pool s'accumule de mois en mois jusqu'à ce qu'un franchissement
--   de son palier déclenche une distribution.
--
--   Règles de distribution (batch mensuel) :
--     0 franchisseur ce palier ce mois → sous-pool intact, report
--     1 franchisseur                   → reçoit 50 %, 50 % reste dans le sous-pool
--     2+ franchisseurs                 → 100 % distribué au prorata du volume communautaire
--
--   10 % de chaque récompense versée est réinjecté dans le fonds global
--   (ventilé selon Fibonacci le mois suivant via le rollup).
-- ══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- 1. SUPPRIMER L'ANCIEN MODÈLE MENSUEL
--    recognition_fund_monthly était le pool unique distribué à tous les R3+.
--    On le remplace par recognition_fund_subpool_balances (un enregistrement par palier).
--    Note : si migration 080 n'a pas encore été appliquée, ces DROP sont no-op.
-- ─────────────────────────────────────────────────────────────

-- Supprimer la colonne FK vers recognition_fund_monthly dans les awards
ALTER TABLE IF EXISTS recognition_fund_awards
  DROP COLUMN IF EXISTS fund_id;

-- Supprimer la table mensuelle (et ses politiques en cascade)
DROP TABLE IF EXISTS recognition_fund_monthly CASCADE;


-- ─────────────────────────────────────────────────────────────
-- 2. SOUS-POOLS PERMANENTS PAR PALIER
--    Un enregistrement par rang (R3..R7), balance cumulée.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recognition_fund_subpool_balances (
  id                    uuid      PRIMARY KEY DEFAULT gen_random_uuid(),
  rank_level            smallint  NOT NULL CHECK (rank_level BETWEEN 3 AND 7),

  -- Balance disponible = contributions ventilées − distributions + retours
  balance_fcfa          bigint    NOT NULL DEFAULT 0 CHECK (balance_fcfa >= 0),

  -- Dernier mois traité par le rollup (idempotence)
  last_rollup_month     char(7),

  -- Stats cumulées (informatives)
  total_added_fcfa      bigint    NOT NULL DEFAULT 0,
  total_distributed_fcfa bigint   NOT NULL DEFAULT 0,

  updated_at            timestamptz NOT NULL DEFAULT now(),

  UNIQUE (rank_level)
);

-- Pré-remplir les 5 sous-pools
INSERT INTO recognition_fund_subpool_balances (rank_level)
VALUES (3), (4), (5), (6), (7)
ON CONFLICT (rank_level) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_rfsp_rank ON recognition_fund_subpool_balances(rank_level);

-- RLS
ALTER TABLE recognition_fund_subpool_balances ENABLE ROW LEVEL SECURITY;

-- Les soldes sont publics (les leaders voient combien est disponible à chaque palier)
DROP POLICY IF EXISTS "public_read_subpool" ON recognition_fund_subpool_balances;
CREATE POLICY "public_read_subpool"
  ON recognition_fund_subpool_balances FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "service_all_subpool" ON recognition_fund_subpool_balances;
CREATE POLICY "service_all_subpool"
  ON recognition_fund_subpool_balances FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "admin_all_subpool" ON recognition_fund_subpool_balances;
CREATE POLICY "admin_all_subpool"
  ON recognition_fund_subpool_balances FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(role)));


-- ─────────────────────────────────────────────────────────────
-- 3. RÉVISION DE recognition_fund_awards
--    Désormais liée à un événement de franchissement (leader_career_history),
--    pas à un pool mensuel universel.
-- ─────────────────────────────────────────────────────────────

-- Supprimer l'ancienne contrainte unique (month_year, user_id)
ALTER TABLE IF EXISTS recognition_fund_awards
  DROP CONSTRAINT IF EXISTS recognition_fund_awards_month_year_user_id_key;

-- Supprimer l'ancien index associé si existant
DROP INDEX IF EXISTS recognition_fund_awards_month_year_user_id_key;

-- Ajouter les colonnes du nouveau modèle
ALTER TABLE recognition_fund_awards
  ADD COLUMN IF NOT EXISTS career_history_id    uuid        REFERENCES leader_career_history(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS franchise_month      char(7),    -- mois où le franchissement a eu lieu
  ADD COLUMN IF NOT EXISTS subpool_at_dist      bigint      NOT NULL DEFAULT 0,  -- balance du sous-pool au moment de la distribution
  ADD COLUMN IF NOT EXISTS co_franchisseurs     smallint    NOT NULL DEFAULT 1,  -- nb de franchisseurs ce palier ce mois
  ADD COLUMN IF NOT EXISTS gross_award_fcfa     integer     NOT NULL DEFAULT 0,  -- récompense brute avant retour fonds
  ADD COLUMN IF NOT EXISTS returned_fcfa        integer     NOT NULL DEFAULT 0;  -- 10 % réinjecté dans le fonds

-- Rendre month_year nullable (n'est plus la clé principale du modèle)
ALTER TABLE recognition_fund_awards
  ALTER COLUMN month_year DROP NOT NULL;

-- Nouvelle contrainte : un seul award par event de franchissement
CREATE UNIQUE INDEX IF NOT EXISTS idx_rfa_career_history_uniq
  ON recognition_fund_awards (career_history_id)
  WHERE career_history_id IS NOT NULL;

-- Index franchissement par mois (pour le cron)
CREATE INDEX IF NOT EXISTS idx_rfa_franchise_month ON recognition_fund_awards(franchise_month);


-- ─────────────────────────────────────────────────────────────
-- 4. RPC — rollup_recognition_fund_subpools
--    Ventile les contributions d'un mois dans les sous-pools selon les poids Fibonacci.
--    Appelée au début de chaque cron mensuel.
--    Idempotente : skip si ce mois a déjà été traité.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.rollup_recognition_fund_subpools(p_month char(7))
RETURNS TABLE (
  rank_level       smallint,
  added_fcfa       bigint,
  new_balance_fcfa bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total    bigint;
  v_weights  int[] := ARRAY[3, 5, 8, 13, 21];  -- poids R3..R7
  v_sum      int   := 50;                        -- somme des poids
  v_ranks    int[] := ARRAY[3, 4, 5, 6, 7];
  i          int;
  v_share    bigint;
  v_new_bal  bigint;
BEGIN
  -- Idempotence : si tous les sous-pools ont déjà traité ce mois, skip
  IF (
    SELECT COUNT(*) FROM recognition_fund_subpool_balances
    WHERE last_rollup_month = p_month
  ) = 5 THEN
    RETURN QUERY
      SELECT sp.rank_level, 0::bigint, sp.balance_fcfa
      FROM recognition_fund_subpool_balances sp
      ORDER BY sp.rank_level;
    RETURN;
  END IF;

  -- Somme totale des contributions du mois
  SELECT COALESCE(SUM(fund_amount), 0)::bigint
  INTO v_total
  FROM recognition_fund_contributions
  WHERE month_year = p_month;

  IF v_total = 0 THEN
    -- Marquer quand même comme traité (mois sans activité)
    UPDATE recognition_fund_subpool_balances
    SET last_rollup_month = p_month, updated_at = now()
    WHERE last_rollup_month IS DISTINCT FROM p_month;
    RETURN;
  END IF;

  FOR i IN 1..5 LOOP
    v_share := (v_total * v_weights[i]) / v_sum;

    UPDATE recognition_fund_subpool_balances
    SET
      balance_fcfa      = balance_fcfa + v_share,
      total_added_fcfa  = total_added_fcfa + v_share,
      last_rollup_month = p_month,
      updated_at        = now()
    WHERE rank_level = v_ranks[i]
    RETURNING balance_fcfa INTO v_new_bal;

    RETURN QUERY SELECT v_ranks[i]::smallint, v_share, v_new_bal;
  END LOOP;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 5. RPC — get_rank_franchisseurs
--    Retourne les leaders ayant franchi p_rank durant p_month,
--    avec leur volume communautaire du mois (pour la répartition proportionnelle).
--    Utilisée par le cron pour calculer les parts.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_rank_franchisseurs(p_rank smallint, p_month char(7))
RETURNS TABLE (
  user_id           uuid,
  career_history_id uuid,
  volume_brut       bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    lch.user_id,
    lch.id                                               AS career_history_id,
    COALESCE(SUM(rfc.gross_amount), 0)::bigint           AS volume_brut
  FROM leader_career_history lch
  LEFT JOIN recognition_fund_contributions rfc
    ON  rfc.user_id    = lch.user_id
    AND rfc.month_year = p_month
  WHERE lch.rank_to = p_rank
    AND to_char(lch.achieved_at, 'YYYY-MM') = p_month
  GROUP BY lch.user_id, lch.id
$$;


-- ─────────────────────────────────────────────────────────────
-- 6. Remplacer la RPC get_recognition_fund_scores (obsolète)
--    par une version qui retourne les sous-pool balances publiques.
--    Conservée pour compatibilité API mais redirigée.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_recognition_fund_scores(p_month char(7))
RETURNS TABLE (user_id uuid, career_rank smallint, volume bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  -- Rétrocompat : retourne les volumes des leaders R3+ pour l'estimation dashboard.
  -- Le cron utilise désormais get_rank_franchisseurs et rollup_recognition_fund_subpools.
  SELECT
    rfc.user_id,
    lcr.current_rank  AS career_rank,
    SUM(rfc.gross_amount)::bigint AS volume
  FROM recognition_fund_contributions rfc
  JOIN leader_career_ranks lcr ON lcr.user_id = rfc.user_id
  WHERE rfc.month_year = p_month
    AND lcr.current_rank >= 3
  GROUP BY rfc.user_id, lcr.current_rank
$$;
