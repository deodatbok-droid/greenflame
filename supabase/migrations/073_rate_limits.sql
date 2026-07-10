-- ============================================================
-- Migration 005 : Table rate_limits (pour scale > 5 000 users)
-- ============================================================
-- À appliquer dans Supabase SQL Editor quand le volume augmente.
-- Remplace le store in-memory par un store DB persistant et partagé
-- entre toutes les instances serverless.
-- ============================================================

-- Table de rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          TEXT        PRIMARY KEY,
  count        INTEGER     NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index pour nettoyage efficace
CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON public.rate_limits (window_start);

-- Pas de RLS (service role uniquement)
ALTER TABLE public.rate_limits DISABLE ROW LEVEL SECURITY;

-- Fonction atomique de vérification + incrément
CREATE OR REPLACE FUNCTION check_rate_limit_db(
  p_key        TEXT,
  p_limit      INTEGER,
  p_window_secs INTEGER
)
RETURNS TABLE (allowed BOOLEAN, remaining INTEGER, reset_in INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_now          TIMESTAMPTZ := NOW();
  v_count        INTEGER;
  v_window_start TIMESTAMPTZ;
  v_reset_in     INTEGER;
BEGIN
  -- Lecture + verrou (FOR UPDATE)
  SELECT count, window_start
  INTO v_count, v_window_start
  FROM public.rate_limits
  WHERE key = p_key
  FOR UPDATE;

  IF NOT FOUND THEN
    -- Première requête pour cette clé
    INSERT INTO public.rate_limits (key, count, window_start)
    VALUES (p_key, 1, v_now);
    RETURN QUERY SELECT TRUE, p_limit - 1, p_window_secs;

  ELSIF EXTRACT(EPOCH FROM (v_now - v_window_start)) > p_window_secs THEN
    -- Fenêtre expirée → reset
    UPDATE public.rate_limits
    SET count = 1, window_start = v_now
    WHERE key = p_key;
    RETURN QUERY SELECT TRUE, p_limit - 1, p_window_secs;

  ELSIF v_count < p_limit THEN
    -- Dans la fenêtre, incrémenter
    UPDATE public.rate_limits
    SET count = count + 1
    WHERE key = p_key;
    v_reset_in := p_window_secs - EXTRACT(EPOCH FROM (v_now - v_window_start))::INTEGER;
    RETURN QUERY SELECT TRUE, p_limit - v_count - 1, v_reset_in;

  ELSE
    -- Limite atteinte
    v_reset_in := p_window_secs - EXTRACT(EPOCH FROM (v_now - v_window_start))::INTEGER;
    RETURN QUERY SELECT FALSE, 0, v_reset_in;
  END IF;
END;
$$;

-- Nettoyage automatique (toutes les heures via pg_cron si disponible)
-- À activer manuellement si pg_cron est activé dans Supabase :
-- SELECT cron.schedule('cleanup-rate-limits', '0 * * * *', $$
--   DELETE FROM public.rate_limits
--   WHERE window_start < NOW() - INTERVAL '2 hours';
-- $$);

-- ============================================================
-- USAGE côté TypeScript (quand migration appliquée) :
--
-- const { data } = await service.rpc('check_rate_limit_db', {
--   p_key: `txn:user:${user.id}`,
--   p_limit: 5,
--   p_window_secs: 60,
-- })
-- if (!data[0].allowed) return 429
-- ============================================================
