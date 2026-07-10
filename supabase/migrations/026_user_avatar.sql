-- ================================================================
-- Migration 026 : Avatar utilisateur
-- ================================================================

-- 1. Colonne avatar_url sur users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Bucket Supabase Storage (à créer manuellement dans le dashboard)
-- Nom : avatars
-- Public : oui (les avatars sont publics)
-- Taille max : 5 MB
-- Types autorisés : image/jpeg, image/png, image/webp

-- 3. Politique RLS Storage (à appliquer dans Supabase Dashboard > Storage > Policies)
-- SELECT : public (tout le monde peut voir)
-- INSERT/UPDATE/DELETE : uniquement l'utilisateur propriétaire

-- ================================================================
-- VÉRIFICATION
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'avatar_url';
-- ================================================================
