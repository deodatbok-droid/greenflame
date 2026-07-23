-- ════════════════════════════════════════════════════════════════════════
-- Migration 087 — Améliorations factures/devis
--
-- 1. Nouvelles colonnes sur commercial_documents :
--    client_ifu, client_address, has_tva, aib_rate, platform_ref
-- 2. Colonne unit sur commercial_document_lines
-- 3. Index unique sur platform_ref
-- ════════════════════════════════════════════════════════════════════════

ALTER TABLE public.commercial_documents
  ADD COLUMN IF NOT EXISTS client_ifu      TEXT,
  ADD COLUMN IF NOT EXISTS client_address  TEXT,
  ADD COLUMN IF NOT EXISTS has_tva         BOOLEAN       NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS aib_rate        NUMERIC(5,3)  NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS platform_ref    TEXT;

ALTER TABLE public.commercial_document_lines
  ADD COLUMN IF NOT EXISTS unit TEXT NOT NULL DEFAULT 'u';

CREATE UNIQUE INDEX IF NOT EXISTS idx_commercial_documents_platform_ref
  ON public.commercial_documents(platform_ref)
  WHERE platform_ref IS NOT NULL;
