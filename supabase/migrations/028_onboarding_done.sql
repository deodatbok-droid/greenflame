-- ================================================================
-- Migration 028 : Colonne onboarding_done sur users
-- ================================================================
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS onboarding_done BOOLEAN NOT NULL DEFAULT FALSE;

-- Les utilisateurs existants ont déjà passé l'onboarding
UPDATE public.users SET onboarding_done = TRUE WHERE created_at < NOW();

-- ================================================================
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'onboarding_done';
-- ================================================================
