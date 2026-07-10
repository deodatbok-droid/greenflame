-- ============================================================================
-- 064 — Fix tontine_membres RLS recursion + colonnes manquantes (061/062)
--
-- Problème : la policy "tontine_membres_select" de la migration 040 fait une
-- sous-requête sur tontine_membres elle-même → récursion infinie PostgreSQL.
-- Résultat : GET /api/tontines et la relecture post-création plantent (500).
--
-- Fix : remplacer la sous-requête récursive par `user_id = auth.uid()` direct.
-- Idempotent : toutes les opérations utilisent IF NOT EXISTS / OR REPLACE.
-- ============================================================================

-- ── 1. Colonnes 061 (idempotent) ─────────────────────────────────────────────
ALTER TABLE public.tontine_membres
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('pending', 'active', 'expired')),
  ADD COLUMN IF NOT EXISTS invite_token TEXT,
  ADD COLUMN IF NOT EXISTS invite_expires_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_tontine_membres_invite_token
  ON public.tontine_membres(invite_token) WHERE invite_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tontine_membres_invite_token
  ON public.tontine_membres(invite_token);

-- ── 2. Colonne type sur tontines (062) ───────────────────────────────────────
ALTER TABLE public.tontines
  ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'cash'
    CHECK (type IN ('cash', 'produit'));

-- ── 3. Fix RLS récursion sur tontine_membres ─────────────────────────────────
-- L'ancienne policy (040) faisait :
--   tontine_id IN (SELECT tontine_id FROM tontine_membres WHERE user_id = auth.uid())
-- ce qui déclenche la même policy → récursion infinie.
--
-- Nouveau comportement : le membre voit ses propres lignes (user_id direct)
-- OU les lignes de ses tontines s'il en est le créateur.
DROP POLICY IF EXISTS "tontine_membres_select" ON public.tontine_membres;
CREATE POLICY "tontine_membres_select" ON public.tontine_membres
  FOR SELECT USING (
    user_id = auth.uid()
    OR tontine_id IN (SELECT id FROM public.tontines WHERE creator_id = auth.uid())
  );

-- ── 4. Assurons-nous que les autres policies tontine_membres existent ─────────
-- (par sécurité, en cas d'application partielle de 037/040)

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tontine_membres' AND policyname = 'tontine_membres_insert'
  ) THEN
    EXECUTE $policy$
      DROP POLICY IF EXISTS "tontine_membres_insert" ON public.tontine_membres;
CREATE POLICY "tontine_membres_insert" ON public.tontine_membres
        FOR INSERT WITH CHECK (
          tontine_id IN (SELECT id FROM public.tontines WHERE creator_id = auth.uid())
        )
    $policy$;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'tontine_membres' AND policyname = 'tontine_membres_update'
  ) THEN
    EXECUTE $policy$
      DROP POLICY IF EXISTS "tontine_membres_update" ON public.tontine_membres;
CREATE POLICY "tontine_membres_update" ON public.tontine_membres
        FOR UPDATE USING (
          user_id = auth.uid()
          OR tontine_id IN (SELECT id FROM public.tontines WHERE creator_id = auth.uid())
        )
    $policy$;
  END IF;
END $$;
