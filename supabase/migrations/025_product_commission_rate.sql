-- ================================================================
-- Migration 025 : Taux de commission par produit
-- ================================================================
-- Ajoute une colonne commission_rate optionnelle sur products.
-- Si NULL → on utilise le taux du marchand (comportement actuel).
-- Si renseignée → ce taux s'applique à la place du taux marchand.
-- ================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(6, 4)
    CHECK (commission_rate IS NULL OR (commission_rate > 0 AND commission_rate <= 1));

COMMENT ON COLUMN public.products.commission_rate IS
  'Taux de commission spécifique à ce produit. NULL = hérite du taux marchand.';

-- ================================================================
-- VÉRIFICATION
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'commission_rate';
-- ================================================================
