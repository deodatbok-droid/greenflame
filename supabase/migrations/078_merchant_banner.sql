-- Migration 078 — Bannière personnalisée des boutiques marchandes
-- Permet à chaque marchand d'uploader une photo de fond pour sa vitrine publique.

ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Le marchand peut mettre à jour sa propre bannière
-- (la RLS existante couvre déjà UPDATE sur merchants pour l'owner)
-- Pas besoin de nouvelle politique : la policy "merchants: owner can update"
-- couvre déjà tous les champs de la table.

COMMENT ON COLUMN public.merchants.banner_url IS
  'URL Supabase Storage de l''image de bannière de la vitrine publique. Null = gradient tier par défaut.';
