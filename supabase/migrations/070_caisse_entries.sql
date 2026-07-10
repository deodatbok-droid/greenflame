-- ════════════════════════════════════════════════════════════════════════
-- Migration 070 — Livre de caisse marchand
--
-- Objectif : permettre aux marchands d'enregistrer leurs flux financiers
-- manuels (dépenses, recettes hors plateforme) pour obtenir un P&L
-- simplifié mensuel. Les recettes issues des transactions GreenFlame
-- sont déjà tracées dans merchant_wallet_ledger — elles ne sont pas
-- dupliquées ici, mais la vue P&L peut les consolider.
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.caisse_entries (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id   UUID        NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,

  type          TEXT        NOT NULL CHECK (type IN ('recette', 'depense')),

  -- Montant en FCFA (toujours positif — le type détermine le sens)
  amount_fcfa   BIGINT      NOT NULL CHECK (amount_fcfa > 0),

  -- Catégorie libre
  categorie     TEXT        NOT NULL DEFAULT 'Divers',

  -- Libellé descriptif
  libelle       TEXT        NOT NULL,

  -- Date de l'opération (peut être antérieure à la saisie — saisie rétroactive)
  date_entree   DATE        NOT NULL DEFAULT CURRENT_DATE,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caisse_entries_merchant ON public.caisse_entries(merchant_id, date_entree DESC);
CREATE INDEX IF NOT EXISTS idx_caisse_entries_type     ON public.caisse_entries(merchant_id, type, date_entree DESC);

-- RLS
ALTER TABLE public.caisse_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchants manage own caisse_entries" ON public.caisse_entries;
CREATE POLICY "merchants manage own caisse_entries" ON public.caisse_entries
  FOR ALL
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));
