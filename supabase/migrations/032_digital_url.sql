-- 032_digital_url.sql
-- Ajoute le champ digital_url sur la table products
-- Utilisé pour les produits numériques (mini-formations, templates, etc.)
-- Appliqué le 2026-06-06

ALTER TABLE products ADD COLUMN IF NOT EXISTS digital_url TEXT;
