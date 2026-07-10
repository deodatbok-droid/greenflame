-- 037_tontines.sql
-- Gestionnaire de tontine — épargne rotative collective

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ── TONTINES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tontines (
  id                       UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id               UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name                     TEXT        NOT NULL,
  description              TEXT,
  contribution_amount_fcfa INTEGER     NOT NULL DEFAULT 0,
  frequency                TEXT        NOT NULL DEFAULT 'mensuel'
    CHECK (frequency IN ('hebdomadaire', 'bimensuel', 'mensuel')),
  start_date               DATE        NOT NULL DEFAULT CURRENT_DATE,
  status                   TEXT        NOT NULL DEFAULT 'actif'
    CHECK (status IN ('actif', 'pause', 'termine')),
  share_token              TEXT        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(12), 'hex'),
  notes                    TEXT,
  created_at               TIMESTAMPTZ DEFAULT NOW(),
  updated_at               TIMESTAMPTZ DEFAULT NOW()
);

-- ── MEMBRES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tontine_membres (
  id               UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tontine_id       UUID        NOT NULL REFERENCES public.tontines(id) ON DELETE CASCADE,
  user_id          UUID        REFERENCES public.users(id) ON DELETE SET NULL,
  full_name        TEXT        NOT NULL,
  phone            TEXT,
  position         INTEGER     NOT NULL,
  has_received_pot BOOLEAN     NOT NULL DEFAULT false,
  is_admin         BOOLEAN     NOT NULL DEFAULT false,
  joined_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ── COTISATIONS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tontine_cotisations (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  tontine_id    UUID        NOT NULL REFERENCES public.tontines(id) ON DELETE CASCADE,
  membre_id     UUID        NOT NULL REFERENCES public.tontine_membres(id) ON DELETE CASCADE,
  periode       TEXT        NOT NULL,
  amount_fcfa   INTEGER     NOT NULL DEFAULT 0,
  late_fee_fcfa INTEGER     NOT NULL DEFAULT 0,
  status        TEXT        NOT NULL DEFAULT 'en_attente'
    CHECK (status IN ('paye', 'partiel', 'en_retard', 'en_attente')),
  paid_at       TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEXES ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tontines_creator_id        ON public.tontines(creator_id);
CREATE INDEX IF NOT EXISTS idx_tontine_membres_tontine_id ON public.tontine_membres(tontine_id);
CREATE INDEX IF NOT EXISTS idx_tontine_membres_position   ON public.tontine_membres(position);
CREATE INDEX IF NOT EXISTS idx_tontine_cotisations_tontine_id ON public.tontine_cotisations(tontine_id);
CREATE INDEX IF NOT EXISTS idx_tontine_cotisations_membre_id  ON public.tontine_cotisations(membre_id);

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
ALTER TABLE public.tontines          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tontine_membres   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tontine_cotisations ENABLE ROW LEVEL SECURITY;

-- tontines — SELECT
DROP POLICY IF EXISTS "tontines_select" ON public.tontines;
CREATE POLICY "tontines_select" ON public.tontines
  FOR SELECT USING (
    auth.uid() = creator_id
    OR id IN (
      SELECT tontine_id FROM public.tontine_membres WHERE user_id = auth.uid()
    )
  );

-- tontines — INSERT
DROP POLICY IF EXISTS "tontines_insert" ON public.tontines;
CREATE POLICY "tontines_insert" ON public.tontines
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- tontines — UPDATE
DROP POLICY IF EXISTS "tontines_update" ON public.tontines;
CREATE POLICY "tontines_update" ON public.tontines
  FOR UPDATE USING (auth.uid() = creator_id);

-- tontines — DELETE
DROP POLICY IF EXISTS "tontines_delete" ON public.tontines;
CREATE POLICY "tontines_delete" ON public.tontines
  FOR DELETE USING (auth.uid() = creator_id);

-- tontine_membres — SELECT
DROP POLICY IF EXISTS "tontine_membres_select" ON public.tontine_membres;
CREATE POLICY "tontine_membres_select" ON public.tontine_membres
  FOR SELECT USING (
    tontine_id IN (
      SELECT id FROM public.tontines
      WHERE creator_id = auth.uid()
         OR id IN (SELECT tontine_id FROM public.tontine_membres WHERE user_id = auth.uid())
    )
  );

-- tontine_membres — INSERT
DROP POLICY IF EXISTS "tontine_membres_insert" ON public.tontine_membres;
CREATE POLICY "tontine_membres_insert" ON public.tontine_membres
  FOR INSERT WITH CHECK (
    tontine_id IN (SELECT id FROM public.tontines WHERE creator_id = auth.uid())
  );

-- tontine_membres — UPDATE
DROP POLICY IF EXISTS "tontine_membres_update" ON public.tontine_membres;
CREATE POLICY "tontine_membres_update" ON public.tontine_membres
  FOR UPDATE USING (
    tontine_id IN (SELECT id FROM public.tontines WHERE creator_id = auth.uid())
  );

-- tontine_membres — DELETE
DROP POLICY IF EXISTS "tontine_membres_delete" ON public.tontine_membres;
CREATE POLICY "tontine_membres_delete" ON public.tontine_membres
  FOR DELETE USING (
    tontine_id IN (SELECT id FROM public.tontines WHERE creator_id = auth.uid())
  );

-- tontine_cotisations — SELECT
DROP POLICY IF EXISTS "tontine_cotisations_select" ON public.tontine_cotisations;
CREATE POLICY "tontine_cotisations_select" ON public.tontine_cotisations
  FOR SELECT USING (
    tontine_id IN (
      SELECT id FROM public.tontines
      WHERE creator_id = auth.uid()
         OR id IN (SELECT tontine_id FROM public.tontine_membres WHERE user_id = auth.uid())
    )
  );

-- tontine_cotisations — INSERT
DROP POLICY IF EXISTS "tontine_cotisations_insert" ON public.tontine_cotisations;
CREATE POLICY "tontine_cotisations_insert" ON public.tontine_cotisations
  FOR INSERT WITH CHECK (
    tontine_id IN (SELECT id FROM public.tontines WHERE creator_id = auth.uid())
  );

-- tontine_cotisations — UPDATE
DROP POLICY IF EXISTS "tontine_cotisations_update" ON public.tontine_cotisations;
CREATE POLICY "tontine_cotisations_update" ON public.tontine_cotisations
  FOR UPDATE USING (
    tontine_id IN (SELECT id FROM public.tontines WHERE creator_id = auth.uid())
  );

-- tontine_cotisations — DELETE
DROP POLICY IF EXISTS "tontine_cotisations_delete" ON public.tontine_cotisations;
CREATE POLICY "tontine_cotisations_delete" ON public.tontine_cotisations
  FOR DELETE USING (
    tontine_id IN (SELECT id FROM public.tontines WHERE creator_id = auth.uid())
  );

-- ── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tontines_updated_at ON public.tontines;
CREATE TRIGGER tontines_updated_at
  BEFORE UPDATE ON public.tontines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
