-- ================================================================
-- Migration 081 — Crons pg_cron : expire-bons + recognition-fund
-- Fonctions SQL pures (même pattern que flamme_inactivity_cron)
-- expire-bons      : dernier jour du mois à 23h55 UTC
-- recognition-fund : 1er du mois à 00h05 UTC
-- FONDS_POIDS Fibonacci : R3=3, R4=5, R5=8, R6=13, R7=21
-- ================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── Cron 1 : expiration des bons en fin de mois ──────────────────────────────

CREATE OR REPLACE FUNCTION public.cron_expire_bons()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now          timestamptz := now();
  v_current_month char(7)    := TO_CHAR(v_now, 'YYYY-MM');
  v_bons_count   integer;
  v_pools_count  integer;
BEGIN
  -- Garde-fou : n'exécuter que le dernier jour du mois
  IF EXTRACT(day FROM (v_now + INTERVAL '1 day')) <> 1 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'not_last_day');
  END IF;

  -- 1. Expirer tous les bons dont expires_at est passé
  UPDATE public.vouchers
  SET status     = 'expired',
      updated_at = v_now
  WHERE status IN ('active', 'partially_used')
    AND expires_at < v_now;
  GET DIAGNOSTICS v_bons_count = ROW_COUNT;

  -- 2. Expirer les pools de droits des mois précédents
  UPDATE public.voucher_rights_monthly
  SET status     = 'expired',
      expired_at = v_now,
      updated_at = v_now
  WHERE status     = 'active'
    AND month_year < v_current_month;
  GET DIAGNOSTICS v_pools_count = ROW_COUNT;

  RETURN jsonb_build_object(
    'ok',          true,
    'bonsExpires', v_bons_count,
    'poolsExpires', v_pools_count,
    'executedAt',  v_now
  );
END;
$$;

-- ── Cron 2 : distribution mensuelle du Fonds de Reconnaissance ───────────────

CREATE OR REPLACE FUNCTION public.cron_recognition_fund()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now            timestamptz := now();
  -- Mois précédent (YYYY-MM)
  v_month          char(7)     := TO_CHAR(DATE_TRUNC('month', v_now) - INTERVAL '1 day', 'YYYY-MM');
  v_existing_id    uuid;
  v_existing_status text;
  v_fund_id        uuid;
  v_total_fcfa     bigint;
  v_contrib_count  integer;
  v_total_scores   bigint;
  v_total_awarded  bigint := 0;
  v_credited       integer := 0;
  v_leader         RECORD;
  v_award_fcfa     integer;
  v_wallet_id      uuid;
  v_wallet_bal     bigint;
  v_wallet_earned  bigint;
BEGIN
  -- Idempotence : ne pas redistribuer deux fois
  SELECT id, status
  INTO v_existing_id, v_existing_status
  FROM public.recognition_fund_monthly
  WHERE month_year = v_month;

  IF v_existing_status = 'distributed' THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'already_distributed', 'monthYear', v_month);
  END IF;

  -- 1. Agréger les contributions du mois
  SELECT COALESCE(SUM(fund_amount), 0)::bigint,
         COUNT(*)::integer
  INTO v_total_fcfa, v_contrib_count
  FROM public.recognition_fund_contributions
  WHERE month_year = v_month;

  IF v_contrib_count = 0 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'no_contributions', 'monthYear', v_month);
  END IF;

  -- 2. Upsert le pool mensuel → statut distributing
  IF v_existing_id IS NOT NULL THEN
    UPDATE public.recognition_fund_monthly
    SET total_fcfa          = v_total_fcfa,
        contributions_count = v_contrib_count,
        status              = 'distributing',
        updated_at          = v_now
    WHERE id = v_existing_id;
    v_fund_id := v_existing_id;
  ELSE
    INSERT INTO public.recognition_fund_monthly
      (month_year, total_fcfa, contributions_count, status)
    VALUES (v_month, v_total_fcfa, v_contrib_count, 'distributing')
    RETURNING id INTO v_fund_id;
  END IF;

  IF v_total_fcfa = 0 THEN
    UPDATE public.recognition_fund_monthly
    SET status = 'distributed', distributed_at = v_now
    WHERE id = v_fund_id;
    RETURN jsonb_build_object('ok', true, 'distributed', 0, 'monthYear', v_month);
  END IF;

  -- 3. Calculer le total des scores (FONDS_POIDS Fibonacci : R3=3, R4=5, R5=8, R6=13, R7=21)
  SELECT COALESCE(SUM(
    volume * CASE career_rank
      WHEN 3 THEN 3 WHEN 4 THEN 5 WHEN 5 THEN 8 WHEN 6 THEN 13 WHEN 7 THEN 21
      ELSE 0
    END
  ), 0)::bigint
  INTO v_total_scores
  FROM public.get_recognition_fund_scores(v_month)
  WHERE career_rank BETWEEN 3 AND 7;

  IF v_total_scores = 0 THEN
    UPDATE public.recognition_fund_monthly
    SET status = 'distributed', distributed_at = v_now
    WHERE id = v_fund_id;
    RETURN jsonb_build_object('ok', true, 'distributed', 0, 'reason', 'no_eligible_leaders', 'monthYear', v_month);
  END IF;

  -- 4. Distribuer à chaque leader éligible
  FOR v_leader IN
    SELECT
      user_id,
      career_rank,
      volume,
      CASE career_rank
        WHEN 3 THEN 3 WHEN 4 THEN 5 WHEN 5 THEN 8 WHEN 6 THEN 13 WHEN 7 THEN 21
      END::smallint AS poids,
      (volume * CASE career_rank
        WHEN 3 THEN 3 WHEN 4 THEN 5 WHEN 5 THEN 8 WHEN 6 THEN 13 WHEN 7 THEN 21
        ELSE 0
      END)::bigint AS score
    FROM public.get_recognition_fund_scores(v_month)
    WHERE career_rank BETWEEN 3 AND 7
  LOOP
    v_award_fcfa    := FLOOR(v_total_fcfa::float * (v_leader.score::float / v_total_scores::float));
    v_total_awarded := v_total_awarded + v_award_fcfa;

    -- Upsert award (idempotent)
    INSERT INTO public.recognition_fund_awards (
      month_year, fund_id, user_id, career_rank, fibonacci_poids,
      community_volume, score, total_scores, award_fcfa, status
    ) VALUES (
      v_month, v_fund_id, v_leader.user_id, v_leader.career_rank, v_leader.poids,
      v_leader.volume, v_leader.score, v_total_scores, v_award_fcfa, 'pending'
    )
    ON CONFLICT (month_year, user_id) DO UPDATE
      SET award_fcfa    = EXCLUDED.award_fcfa,
          total_scores  = EXCLUDED.total_scores,
          updated_at    = now()
    WHERE recognition_fund_awards.status = 'pending';

    CONTINUE WHEN v_award_fcfa <= 0;

    -- Lire le wallet
    SELECT id, balance_fcfa, COALESCE(total_earned_fcfa, 0)
    INTO v_wallet_id, v_wallet_bal, v_wallet_earned
    FROM public.wallets
    WHERE user_id = v_leader.user_id;

    CONTINUE WHEN NOT FOUND;

    -- Créditer le wallet
    UPDATE public.wallets
    SET balance_fcfa      = v_wallet_bal + v_award_fcfa,
        total_earned_fcfa = v_wallet_earned + v_award_fcfa,
        updated_at        = v_now
    WHERE id = v_wallet_id;

    -- Écriture ledger (append-only, SECURITY DEFINER contourne le RLS en lecture seule)
    INSERT INTO public.wallet_ledger (
      wallet_id, amount, currency_type, transaction_type, reference_id, balance_after
    ) VALUES (
      v_wallet_id, v_award_fcfa, 'fcfa', 'fonds_reconnaissance', v_fund_id,
      v_wallet_bal + v_award_fcfa
    );

    -- Marquer le versement
    UPDATE public.recognition_fund_awards
    SET status  = 'paid',
        paid_at = v_now
    WHERE month_year = v_month
      AND user_id    = v_leader.user_id;

    v_credited := v_credited + 1;
  END LOOP;

  -- 5. Finaliser le pool mensuel
  UPDATE public.recognition_fund_monthly
  SET status         = 'distributed',
      distributed_at = v_now,
      updated_at     = v_now
  WHERE id = v_fund_id;

  RETURN jsonb_build_object(
    'ok',                true,
    'monthYear',         v_month,
    'totalFcfa',         v_total_fcfa,
    'leadersRecompenses', v_credited,
    'totalDistribue',    v_total_awarded,
    'reliquat',          v_total_fcfa - v_total_awarded
  );
END;
$$;

-- ── Planification ─────────────────────────────────────────────────────────────

-- Dernier jour du mois à 23h55 UTC
-- (programmé jours 28-31 ; le garde-fou dans la fonction filtre le bon jour)
SELECT cron.unschedule('expire-bons') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'expire-bons'
);
SELECT cron.schedule(
  'expire-bons',
  '55 23 28-31 * *',
  'SELECT public.cron_expire_bons()'
);

-- 1er du mois à 00h05 UTC (après l''expiration des bons)
SELECT cron.unschedule('recognition-fund') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'recognition-fund'
);
SELECT cron.schedule(
  'recognition-fund',
  '5 0 1 * *',
  'SELECT public.cron_recognition_fund()'
);
