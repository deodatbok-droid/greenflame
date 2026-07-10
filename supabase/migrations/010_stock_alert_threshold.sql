-- ================================================================
-- Migration 010 : Seuil d'alerte stock par produit
-- ================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS stock_alert_threshold INTEGER DEFAULT 5;

COMMENT ON COLUMN public.products.stock_alert_threshold IS
  'Seuil d''alerte : email envoyé au marchand quand stock_quantity <= seuil (null = pas d''alerte)';

-- ================================================================
-- VÉRIFICATION
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'stock_alert_threshold';
-- ================================================================
