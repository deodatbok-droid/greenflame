-- ================================================================
-- Migration 051 — Cagnotte Communautaire GreenFlame
-- Tables : community_pot, pot_contributions, pot_draws,
--          pot_winners, pot_consolations
-- ================================================================
-- Logique :
--   • 50 F retenus du 1er cashback de chaque membre chaque mois
--   • Cagnotte visible en temps réel
--   • Tirage irrégulier déclenché manuellement par l'admin
--   • Gagnant sélectionné aléatoirement parmi les éligibles
--   • Re-éligibilité : 6 mois de contribution continue après un gain
--   • Consolation digitale (coût nul) pour tous les non-gagnants du tirage
-- ================================================================

-- ─── COMMUNITY_POT ───────────────────────────────────────────────────────────
-- Ligne unique représentant l'état global de la cagnotte
CREATE TABLE IF NOT EXISTS public.community_pot (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Balance courante disponible pour tirage
  current_balance_fcfa    BIGINT      NOT NULL DEFAULT 0 CHECK (current_balance_fcfa >= 0),
  -- Totaux historiques
  total_contributed_fcfa  BIGINT      NOT NULL DEFAULT 0,
  total_drawn_fcfa        BIGINT      NOT NULL DEFAULT 0,
  -- Compteur de contributeurs actifs ce mois-ci (cache, rafraîchi par cron)
  active_contributors     INTEGER     NOT NULL DEFAULT 0,
  -- Dernier tirage
  last_draw_at            TIMESTAMPTZ,
  last_draw_id            UUID,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insérer la ligne unique à la création
INSERT INTO public.community_pot (id)
VALUES ('00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Seul l'admin peut lire/modifier la cagnotte
ALTER TABLE public.community_pot ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pot_admin_all" ON public.community_pot;
CREATE POLICY "pot_admin_all" ON public.community_pot
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- Vue publique (uniquement la balance pour affichage consumer)
DROP VIEW IF EXISTS public.community_pot_public CASCADE;
CREATE OR REPLACE VIEW public.community_pot_public AS
SELECT
  current_balance_fcfa,
  active_contributors,
  last_draw_at,
  total_drawn_fcfa
FROM public.community_pot
LIMIT 1;

-- ─── POT_CONTRIBUTIONS ────────────────────────────────────────────────────────
-- Une ligne par rétention de 50 F (1 membre × 1 mois)
CREATE TABLE IF NOT EXISTS public.pot_contributions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Période au format 'YYYY-MM'
  period                TEXT        NOT NULL CHECK (period ~ '^\d{4}-\d{2}$'),
  amount_fcfa           INTEGER     NOT NULL DEFAULT 50 CHECK (amount_fcfa > 0),
  -- Référence à la distribution cashback source
  cashback_dist_id      UUID        REFERENCES public.commission_distributions(id),
  -- Statut de la contribution
  status                TEXT        NOT NULL DEFAULT 'credited'
                                    CHECK (status IN ('credited', 'reversed')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Un seul versement par membre par mois
  UNIQUE (user_id, period)
);

CREATE INDEX IF NOT EXISTS idx_pot_contributions_user ON public.pot_contributions(user_id, period DESC);
CREATE INDEX IF NOT EXISTS idx_pot_contributions_period ON public.pot_contributions(period);

ALTER TABLE public.pot_contributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pot_contributions_select_own" ON public.pot_contributions;
CREATE POLICY "pot_contributions_select_own" ON public.pot_contributions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "pot_contributions_admin_all" ON public.pot_contributions;
CREATE POLICY "pot_contributions_admin_all" ON public.pot_contributions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- ─── POT_DRAWS ────────────────────────────────────────────────────────────────
-- Chaque tirage déclenché par l'admin
CREATE TABLE IF NOT EXISTS public.pot_draws (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Montant total distribué lors de ce tirage (peut être partiel si admin décide)
  amount_drawn_fcfa     BIGINT      NOT NULL CHECK (amount_drawn_fcfa > 0),
  -- Snapshot de la cagnotte au moment du tirage
  pot_balance_before    BIGINT      NOT NULL,
  -- Nombre de membres éligibles au moment du tirage
  eligible_count        INTEGER     NOT NULL DEFAULT 0,
  -- Admin qui a déclenché
  triggered_by          UUID        NOT NULL REFERENCES public.users(id),
  -- Statut
  status                TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (status IN ('pending', 'drawn', 'distributed', 'cancelled')),
  notes                 TEXT,
  drawn_at              TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pot_draws_status ON public.pot_draws(status, created_at DESC);

ALTER TABLE public.pot_draws ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pot_draws_select_authenticated" ON public.pot_draws;
CREATE POLICY "pot_draws_select_authenticated" ON public.pot_draws
  FOR SELECT TO authenticated
  USING (TRUE);  -- tous les membres peuvent voir l'historique des tirages

DROP POLICY IF EXISTS "pot_draws_admin_write" ON public.pot_draws;
CREATE POLICY "pot_draws_admin_write" ON public.pot_draws
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

DROP POLICY IF EXISTS "pot_draws_admin_update" ON public.pot_draws;
CREATE POLICY "pot_draws_admin_update" ON public.pot_draws
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- ─── POT_WINNERS ─────────────────────────────────────────────────────────────
-- Gagnant(s) par tirage + tracking re-éligibilité
CREATE TABLE IF NOT EXISTS public.pot_winners (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id             UUID        NOT NULL REFERENCES public.pot_draws(id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_won_fcfa     BIGINT      NOT NULL,
  -- Re-éligibilité : 6 mois de contribution continue après la date du gain
  -- = eligible_again_at calculé = drawn_at + INTERVAL '6 months'
  eligible_again_at   TIMESTAMPTZ NOT NULL,
  -- Notification
  notified_at         TIMESTAMPTZ,
  -- Virement vers wallet
  credited_at         TIMESTAMPTZ,
  wallet_tx_id        UUID,       -- référence wallet_transactions si table existe
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draw_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pot_winners_user ON public.pot_winners(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pot_winners_eligible ON public.pot_winners(eligible_again_at);

ALTER TABLE public.pot_winners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pot_winners_select_own" ON public.pot_winners;
CREATE POLICY "pot_winners_select_own" ON public.pot_winners
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "pot_winners_admin_all" ON public.pot_winners;
CREATE POLICY "pot_winners_admin_all" ON public.pot_winners
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- ─── POT_CONSOLATIONS ────────────────────────────────────────────────────────
-- Cadeau digital (coût nul) pour les non-gagnants de chaque tirage
CREATE TABLE IF NOT EXISTS public.pot_consolations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id         UUID        NOT NULL REFERENCES public.pot_draws(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  -- Clé du cadeau digital (mapped dans le code à un produit GreenFlame)
  item_key        TEXT        NOT NULL CHECK (item_key IN (
    'academie_module_unlock', -- accès 1 module académie supplémentaire
    'pack_mystere_bronze',    -- 1 Pack Mystère Bronze offert
    'boost_cashback_7d',      -- boost cashback ×1.5 pendant 7 jours
    'fa_bonus_5',             -- 5 FA bonus
    'gfp_bonus_100'           -- 100 GFP bonus
  )),
  delivered       BOOLEAN     NOT NULL DEFAULT FALSE,
  delivered_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (draw_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_pot_consolations_user ON public.pot_consolations(user_id, delivered);

ALTER TABLE public.pot_consolations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consolations_select_own" ON public.pot_consolations;
CREATE POLICY "consolations_select_own" ON public.pot_consolations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "consolations_admin_all" ON public.pot_consolations;
CREATE POLICY "consolations_admin_all" ON public.pot_consolations
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND 'admin' = ANY(u.role)
    )
  );

-- ─── VUE ÉLIGIBILITÉ TIRAGE ───────────────────────────────────────────────────
-- Membres éligibles = contributeurs actifs sans gain récent non re-éligible
DROP VIEW IF EXISTS public.pot_eligible_members CASCADE;
CREATE OR REPLACE VIEW public.pot_eligible_members AS
SELECT
  pc.user_id,
  u.full_name,
  u.phone,
  MAX(pc.period) AS last_contribution_period,
  COUNT(pc.period) AS contribution_months,
  -- Dernier gain (null si jamais gagné ou re-éligible)
  MAX(pw.eligible_again_at) AS blocked_until
FROM public.pot_contributions pc
JOIN public.users u ON u.id = pc.user_id
LEFT JOIN public.pot_winners pw ON pw.user_id = pc.user_id
  AND pw.eligible_again_at > NOW()
WHERE pc.status = 'credited'
GROUP BY pc.user_id, u.full_name, u.phone
HAVING
  -- A contribué le mois courant
  MAX(pc.period) = TO_CHAR(NOW(), 'YYYY-MM')
  -- N'est pas actuellement bloqué par une victoire récente
  AND MAX(pw.eligible_again_at) IS NULL;
