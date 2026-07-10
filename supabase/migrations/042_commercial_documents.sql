-- ════════════════════════════════════════════════════════════════════════
-- Migration 042 — Documents commerciaux persistés (devis & factures)
--
-- Objectif : donner une mémoire aux devis et factures générés par les
-- marchands. Jusqu'ici ces documents étaient de simples PDF générés à la
-- volée côté navigateur, sans aucune trace en base — impossible de
-- retrouver l'historique d'un client, de suivre si une facture a été
-- payée, ou de relier un devis accepté à la facture qui en découle.
--
-- Cette migration ajoute :
--   - commercial_documents      : l'en-tête du document (devis ou facture)
--                                 avec un statut suivi dans le temps
--   - commercial_document_lines : les lignes (description / quantité / prix)
-- ════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.commercial_documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id         UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,

  -- Type de document : devis (estimation envoyée avant la prestation)
  -- ou facture (document final réclamant le paiement)
  type                TEXT NOT NULL CHECK (type IN ('devis', 'facture')),

  -- Numéro affiché sur le document (ex: DEV-A1B2C3, FAC-2026-0007)
  document_number     TEXT NOT NULL,

  -- Cycle de vie du document — c'est la nouveauté principale : avant,
  -- un document généré disparaissait dans la nature une fois imprimé.
  --   brouillon  : en cours de préparation, pas encore transmis
  --   envoye     : transmis au client
  --   accepte    : le client a donné son accord (surtout pour un devis)
  --   paye       : le client a réglé (surtout pour une facture)
  --   en_retard  : échéance dépassée sans paiement
  --   annule     : document annulé / refusé / expiré
  status              TEXT NOT NULL DEFAULT 'brouillon'
                      CHECK (status IN ('brouillon', 'envoye', 'accepte', 'paye', 'en_retard', 'annule')),

  client_name         TEXT NOT NULL,
  client_phone        TEXT,

  issue_date          DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until         DATE,                 -- pertinent surtout pour les devis
  due_date            DATE,                 -- échéance de paiement, surtout pour les factures

  notes               TEXT,
  total_fcfa          BIGINT NOT NULL DEFAULT 0,

  -- Permet de relier un devis accepté à la facture générée à partir de lui,
  -- pour reconstituer le fil complet devis → facture → encaissement
  linked_document_id  UUID REFERENCES public.commercial_documents(id) ON DELETE SET NULL,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.commercial_document_lines (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id         UUID NOT NULL REFERENCES public.commercial_documents(id) ON DELETE CASCADE,
  description         TEXT NOT NULL,
  quantity            NUMERIC NOT NULL DEFAULT 1,
  unit_price_fcfa     BIGINT NOT NULL DEFAULT 0,
  position            INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_commercial_documents_merchant
  ON public.commercial_documents(merchant_id, type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_commercial_documents_status
  ON public.commercial_documents(merchant_id, status);

CREATE INDEX IF NOT EXISTS idx_commercial_document_lines_doc
  ON public.commercial_document_lines(document_id);

-- ── Trigger updated_at (fonction déjà créée par les migrations précédentes) ──
DROP TRIGGER IF EXISTS set_updated_at ON public.commercial_documents;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.commercial_documents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ── RLS : chaque marchand ne voit / gère que ses propres documents ──
ALTER TABLE public.commercial_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_document_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "merchants manage own commercial documents" ON public.commercial_documents;
CREATE POLICY "merchants manage own commercial documents" ON public.commercial_documents
  FOR ALL
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()))
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

DROP POLICY IF EXISTS "merchants manage own commercial document lines" ON public.commercial_document_lines;
DROP POLICY IF EXISTS "merchants manage own commercial document lines" ON public.commercial_document_lines;
CREATE POLICY "merchants manage own commercial document lines" ON public.commercial_document_lines
  FOR ALL
  USING (
    document_id IN (
      SELECT id FROM public.commercial_documents
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  )
  WITH CHECK (
    document_id IN (
      SELECT id FROM public.commercial_documents
      WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
    )
  );
