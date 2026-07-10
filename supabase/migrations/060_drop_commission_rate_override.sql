-- Migration 060 : suppression colonne orpheline
-- La colonne commission_rate_override (migration 025) a été renommée en
-- commission_rate dans le code (session 6 — 20 juin 2026) mais l'ancienne
-- colonne n'avait jamais été droppée côté DB. Elle était vide (0 lignes
-- avec une valeur sur 15 produits). Suppression propre.
ALTER TABLE public.products DROP COLUMN IF EXISTS commission_rate_override;
