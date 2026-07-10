-- ================================================================
-- Migration 006 : Service Agent GreenFlame
-- ================================================================
-- À coller dans Supabase Dashboard > SQL Editor et exécuter.
-- ================================================================

-- 1. Colonnes agent sur la table merchants
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS agent_service_active BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS agent_activated_at   TIMESTAMPTZ;

-- 2. Index pour retrouver rapidement les agents actifs
CREATE INDEX IF NOT EXISTS idx_merchants_agent_active
  ON public.merchants (agent_service_active)
  WHERE agent_service_active = TRUE;

-- ================================================================
-- VÉRIFICATION : doit retourner les colonnes ajoutées
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'merchants'
  AND column_name IN ('agent_service_active', 'agent_activated_at');
-- ================================================================
