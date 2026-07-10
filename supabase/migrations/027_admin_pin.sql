-- ================================================================
-- Migration 027 : PIN admin
-- ================================================================
-- Colonne admin_pin sur users.
-- Seuls les comptes avec role = 'admin' ou 'platform_upline' l'utilisent.
-- Stocké hashé (bcrypt via lib/utils/pin.ts, même mécanique que transaction_pin).
-- ================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS admin_pin TEXT;  -- hash bcrypt ou NULL si non défini

COMMENT ON COLUMN public.users.admin_pin IS
  'PIN d''accès à l''interface admin. Hash bcrypt. NULL = pas encore défini.';

-- ================================================================
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'admin_pin';
-- ================================================================
