-- ================================================================
-- Migration 084 : Workflow onboarding marchand
--
-- 1. Extension PostGIS (géolocalisation)
-- 2. Colonnes location/city/neighborhood sur merchants
-- 3. Table merchant_applications (pipeline de validation terrain)
-- 4. Ajout du rôle field_agent dans la contrainte valid_roles
-- 5. RLS policies
-- 6. Index
-- ================================================================

-- ── 1. PostGIS ──────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;

-- ── 2. Géolocalisation sur merchants ────────────────────────────
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS location     GEOGRAPHY(POINT, 4326),
  ADD COLUMN IF NOT EXISTS city         TEXT,
  ADD COLUMN IF NOT EXISTS neighborhood TEXT;

CREATE INDEX IF NOT EXISTS merchants_location_gix
  ON public.merchants USING GIST(location);

-- ── 3. Table merchant_applications ──────────────────────────────
CREATE TABLE IF NOT EXISTS public.merchant_applications (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Informations boutique
  business_name        TEXT        NOT NULL,
  business_category    TEXT,
  address_text         TEXT        NOT NULL,
  city                 TEXT,
  neighborhood         TEXT,
  location             GEOGRAPHY(POINT, 4326),

  -- Documents fiscaux
  ifu                  TEXT,
  rccm                 TEXT,

  -- Chemins Storage Supabase (bucket : merchant-documents, privé)
  kyc_front_path       TEXT,        -- réutilisé si kyc_submissions déjà approuvé
  kyc_back_path        TEXT,
  ifu_doc_path         TEXT,
  rccm_doc_path        TEXT,

  -- Workflow
  status               TEXT        NOT NULL DEFAULT 'pending_review'
    CONSTRAINT merchant_app_status_check CHECK (
      status IN ('pending_review','assigned','field_verified','pending_admin','approved','rejected')
    ),

  -- Assignation agent terrain
  assigned_agent_id    UUID        REFERENCES public.users(id),
  assigned_at          TIMESTAMPTZ,

  -- Rapport visite terrain
  visit_done_at        TIMESTAMPTZ,
  visit_notes          TEXT,
  visit_photo_path     TEXT,
  location_confirmed   BOOLEAN     DEFAULT FALSE,

  -- Décision admin
  reviewed_by          UUID        REFERENCES public.users(id),
  reviewed_at          TIMESTAMPTZ,
  rejection_reason     TEXT,

  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS merchant_apps_user_id_idx
  ON public.merchant_applications(user_id);
CREATE INDEX IF NOT EXISTS merchant_apps_status_idx
  ON public.merchant_applications(status);
CREATE INDEX IF NOT EXISTS merchant_apps_agent_idx
  ON public.merchant_applications(assigned_agent_id)
  WHERE assigned_agent_id IS NOT NULL;

-- ── 4. Rôle field_agent ─────────────────────────────────────────
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS valid_roles;

ALTER TABLE public.users
  ADD CONSTRAINT valid_roles CHECK (
    role <@ ARRAY[
      'consumer','merchant','kingmaker','kingmaker_stockiste',
      'admin','platform_upline','field_agent'
    ]::text[]
  );

-- ── 5. RLS merchant_applications ────────────────────────────────
ALTER TABLE public.merchant_applications ENABLE ROW LEVEL SECURITY;

-- Service role : accès total (API routes)
CREATE POLICY "merchant_app_service_all"
  ON public.merchant_applications FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- L'utilisateur voit et crée sa propre demande
CREATE POLICY "merchant_app_select_own"
  ON public.merchant_applications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "merchant_app_insert_own"
  ON public.merchant_applications FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Field agent : lecture de toutes les demandes + mise à jour des champs terrain
CREATE POLICY "merchant_app_select_field_agent"
  ON public.merchant_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND 'field_agent' = ANY(role)
    )
  );

CREATE POLICY "merchant_app_update_field_agent"
  ON public.merchant_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND 'field_agent' = ANY(role)
    )
  );

-- Admin / platform_upline : accès lecture + mise à jour totale
CREATE POLICY "merchant_app_select_admin"
  ON public.merchant_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND (role && ARRAY['admin','platform_upline']::text[])
    )
  );

CREATE POLICY "merchant_app_update_admin"
  ON public.merchant_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
        AND (role && ARRAY['admin','platform_upline']::text[])
    )
  );

-- ── 6. Trigger updated_at ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER merchant_applications_updated_at
  BEFORE UPDATE ON public.merchant_applications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
