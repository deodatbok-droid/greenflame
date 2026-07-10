-- ════════════════════════════════════════════════════════════════════════
-- Migration 068 — Ledger spillover
--
-- Objectif : comptabiliser séparément les montants de commission qui ne
-- peuvent pas être attribués à un upline (niveau orphelin ou upline inactif)
-- ainsi que les centimes résiduels d'arrondi.
--
-- Avant cette migration, ces montants étaient simplement ignorés dans
-- distribute.ts (le `continue` sur recipientId null) — ils apparaissaient
-- dans commission_distributions avec distribution_type='spillover' mais
-- sans aucun enregistrement comptable dédié.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.spillover_ledger (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id  UUID        NOT NULL REFERENCES public.transactions(id) ON DELETE RESTRICT,

  -- Montant spillé (en FCFA)
  amount_fcfa     INTEGER     NOT NULL CHECK (amount_fcfa >= 0),

  -- Niveau réseau concerné (1-5) ou 0 pour les centimes résiduels d'arrondi
  network_level   SMALLINT    NOT NULL DEFAULT 0,

  -- Raison du spillover
  reason          TEXT        NOT NULL
                  CHECK (reason IN (
                    'orphan_level',        -- pas d'upline à ce niveau
                    'inactive_kingmaker',  -- upline inactif depuis > 90 jours
                    'rounding_remainder'   -- centimes résiduels après arrondis
                  )),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vue agrégée pour le dashboard admin (solde total et répartition par raison)
DROP VIEW IF EXISTS public.spillover_summary CASCADE;
CREATE OR REPLACE VIEW public.spillover_summary AS
SELECT
  COALESCE(SUM(amount_fcfa), 0)                                           AS total_spillover_fcfa,
  COALESCE(SUM(CASE WHEN reason = 'orphan_level'       THEN amount_fcfa END), 0) AS orphan_fcfa,
  COALESCE(SUM(CASE WHEN reason = 'inactive_kingmaker' THEN amount_fcfa END), 0) AS inactive_fcfa,
  COALESCE(SUM(CASE WHEN reason = 'rounding_remainder' THEN amount_fcfa END), 0) AS rounding_fcfa,
  COUNT(DISTINCT transaction_id)                                          AS nb_transactions
FROM public.spillover_ledger;

CREATE INDEX IF NOT EXISTS idx_spillover_ledger_txid
  ON public.spillover_ledger(transaction_id);

CREATE INDEX IF NOT EXISTS idx_spillover_ledger_created
  ON public.spillover_ledger(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_spillover_ledger_reason
  ON public.spillover_ledger(reason);

-- RLS — lecture/écriture admin uniquement, service_role pour l'engine
ALTER TABLE public.spillover_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_spillover_ledger" ON public.spillover_ledger;
CREATE POLICY "admin_read_spillover_ledger"
  ON public.spillover_ledger FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND 'admin' = ANY(role)));

DROP POLICY IF EXISTS "service_write_spillover_ledger" ON public.spillover_ledger;
CREATE POLICY "service_write_spillover_ledger"
  ON public.spillover_ledger FOR INSERT
  WITH CHECK (auth.role() = 'service_role');
