-- ══════════════════════════════════════════════════════════════
-- Migration 077 — Bloc 1 : verrous atomiques + RPC retrait perso
-- ══════════════════════════════════════════════════════════════
-- Couvre :
--   077a — Statut 'distributing' sur transactions
--   077b — RPC request_withdrawal (retrait wallet perso)
-- ══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. Ajouter 'distributing' au CHECK constraint de transactions.status
--    Verrou temporaire utilisé par distributeCommissions pour
--    garantir l'idempotence sous appels concurrents (retry MoMo).
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.transactions
  DROP CONSTRAINT IF EXISTS transactions_status_check;

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
    CHECK (status IN (
      'pending',
      'processing',
      'distributing',   -- verrou atomique interne, jamais exposé au client
      'completed',
      'failed',
      'refunded',
      'escrow',
      'disputed'
    ));

-- ─────────────────────────────────────────────────────────────
-- 2. Table withdrawal_requests
--    IF NOT EXISTS : idempotent si déjà créée via Supabase Dashboard
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.withdrawal_requests (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount_fcfa    BIGINT      NOT NULL CHECK (amount_fcfa > 0),
  currency_type  TEXT        NOT NULL DEFAULT 'fcfa'
                               CHECK (currency_type IN ('fcfa', 'gfp')),
  operator       TEXT        NOT NULL,
  phone          TEXT        NOT NULL,
  status         TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN (
                                 'pending', 'pending_user_validation',
                                 'processing', 'completed', 'failed'
                               )),
  source         TEXT        NOT NULL DEFAULT 'personal'
                               CHECK (source IN ('personal', 'merchant')),
  merchant_id    UUID        REFERENCES public.merchants(id) ON DELETE SET NULL,
  initiated_by   UUID        REFERENCES auth.users(id)      ON DELETE SET NULL,
  notes          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Colonnes ajoutées par migrations 008/012 — idempotent si déjà présentes
ALTER TABLE public.withdrawal_requests
  ADD COLUMN IF NOT EXISTS source       TEXT DEFAULT 'personal',
  ADD COLUMN IF NOT EXISTS merchant_id  UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS initiated_by UUID REFERENCES auth.users(id)       ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS currency_type TEXT DEFAULT 'fcfa';

-- Index
CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_user
  ON public.withdrawal_requests(user_id);

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_status
  ON public.withdrawal_requests(status)
  WHERE status IN ('pending', 'pending_user_validation', 'processing');

CREATE INDEX IF NOT EXISTS idx_withdrawal_requests_created
  ON public.withdrawal_requests(created_at DESC);

-- RLS
ALTER TABLE public.withdrawal_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wr_select_own" ON public.withdrawal_requests;
CREATE POLICY "wr_select_own"
  ON public.withdrawal_requests FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "wr_select_admin" ON public.withdrawal_requests;
CREATE POLICY "wr_select_admin"
  ON public.withdrawal_requests FOR SELECT
  USING (public.is_admin() OR public.is_platform_upline());

DROP POLICY IF EXISTS "wr_insert_service" ON public.withdrawal_requests;
CREATE POLICY "wr_insert_service"
  ON public.withdrawal_requests FOR INSERT
  WITH CHECK (auth.role() = 'service_role');

DROP POLICY IF EXISTS "wr_update_service" ON public.withdrawal_requests;
CREATE POLICY "wr_update_service"
  ON public.withdrawal_requests FOR UPDATE
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- 3. RPC request_withdrawal
--    Débit atomique du wallet perso + création de la demande.
--    FOR UPDATE sur le wallet → empêche la race condition de retrait.
--    Appelé par /api/wallets/withdraw après vérification PIN + plafond.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_withdrawal(
  p_amount_fcfa   BIGINT,
  p_currency_type TEXT,   -- 'fcfa' | 'gfp'
  p_operator      TEXT,
  p_phone         TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id    UUID := auth.uid();
  v_wallet_id  UUID;
  v_balance    BIGINT;
  v_request_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentification requise';
  END IF;

  IF p_currency_type NOT IN ('fcfa', 'gfp') THEN
    RAISE EXCEPTION 'currency_type invalide : %', p_currency_type;
  END IF;

  -- Verrouiller le wallet pour la durée de la transaction (évite la race)
  SELECT id,
    CASE
      WHEN p_currency_type = 'fcfa' THEN balance_fcfa
      ELSE balance_gfp
    END
  INTO v_wallet_id, v_balance
  FROM public.wallets
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF v_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet introuvable';
  END IF;

  IF v_balance < p_amount_fcfa THEN
    RAISE EXCEPTION 'Solde insuffisant (% disponible)', v_balance;
  END IF;

  -- Débit atomique
  IF p_currency_type = 'fcfa' THEN
    UPDATE public.wallets
    SET
      balance_fcfa = balance_fcfa - p_amount_fcfa,
      updated_at   = NOW()
    WHERE id = v_wallet_id;
  ELSE
    UPDATE public.wallets
    SET
      balance_gfp = balance_gfp - p_amount_fcfa,
      updated_at  = NOW()
    WHERE id = v_wallet_id;
  END IF;

  -- Créer la demande de retrait
  INSERT INTO public.withdrawal_requests
    (user_id, amount_fcfa, currency_type, operator, phone, status, source)
  VALUES
    (v_user_id, p_amount_fcfa, p_currency_type, p_operator, p_phone, 'pending', 'personal')
  RETURNING id INTO v_request_id;

  RETURN v_request_id;
END;
$$;

-- Uniquement le role authentifié peut appeler (pas anon)
REVOKE ALL ON FUNCTION public.request_withdrawal(BIGINT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_withdrawal(BIGINT, TEXT, TEXT, TEXT) TO authenticated;
