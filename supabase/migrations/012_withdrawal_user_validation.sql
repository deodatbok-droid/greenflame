-- Migration 012 : flux admin-initié + validation utilisateur
-- Ajouter colonne initiated_by (admin qui a créé la demande, NULL si initié par user)
ALTER TABLE public.withdrawal_requests ADD COLUMN IF NOT EXISTS initiated_by UUID REFERENCES auth.users(id);

-- Mettre à jour la contrainte de status pour inclure pending_user_validation
ALTER TABLE public.withdrawal_requests DROP CONSTRAINT IF EXISTS withdrawal_requests_status_check;
ALTER TABLE public.withdrawal_requests ADD CONSTRAINT withdrawal_requests_status_check
  CHECK (status IN ('pending', 'pending_user_validation', 'processing', 'completed', 'failed'));
