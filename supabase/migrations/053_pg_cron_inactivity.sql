-- ================================================================
-- Migration 053 — Cron Supabase : vérification inactivité Flamme
-- Exécuté chaque nuit à 02h00 UTC via pg_cron + pg_net
-- Nécessite : pg_cron et pg_net activés dans Supabase (Dashboard > Database > Extensions)
-- ================================================================

-- Active les extensions (sans erreur si déjà actives)
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- ── Fonction SQL directe (utilisée si pg_net non disponible) ─────────────────
-- Descend d'un rang les users inactifs depuis 60 jours
CREATE OR REPLACE FUNCTION public.flamme_inactivity_cron()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user        RECORD;
  v_demoted     INTEGER := 0;
  v_cutoff      TIMESTAMPTZ := NOW() - INTERVAL '60 days';
  v_rang_order  TEXT[] := ARRAY['étincelle','flamme','brasier','étoile','soleil'];
  v_current_idx INTEGER;
  v_new_rang    TEXT;
BEGIN
  FOR v_user IN
    SELECT user_id, rang, score_flamme, life_goals_covered,
           last_fa_event_at, last_connection_at
    FROM public.user_flammes
    WHERE rang <> 'étincelle'
      AND GREATEST(last_fa_event_at, last_connection_at) < v_cutoff
  LOOP
    -- Index du rang actuel dans le tableau
    v_current_idx := array_position(v_rang_order, v_user.rang::TEXT);
    IF v_current_idx IS NULL OR v_current_idx <= 1 THEN
      CONTINUE;
    END IF;

    v_new_rang := v_rang_order[v_current_idx - 1];

    -- Mettre à jour le rang
    UPDATE public.user_flammes
    SET rang = v_new_rang::public.rang_level,
        inactivity_demoted_at = NOW(),
        updated_at = NOW()
    WHERE user_id = v_user.user_id;

    -- Historique
    INSERT INTO public.rang_history (
      user_id, rang_from, rang_to, reason,
      score_at_change, life_goals_at_change
    ) VALUES (
      v_user.user_id,
      v_user.rang,
      v_new_rang::public.rang_level,
      'inactivity_demotion',
      v_user.score_flamme,
      v_user.life_goals_covered
    );

    v_demoted := v_demoted + 1;
  END LOOP;

  RETURN v_demoted;
END;
$$;

-- ── Planification quotidienne à 02h00 UTC ────────────────────────────────────
-- Supprime l'ancien job si existant, puis recrée
SELECT cron.unschedule('flamme-inactivity-check') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'flamme-inactivity-check'
);

SELECT cron.schedule(
  'flamme-inactivity-check',
  '0 2 * * *',
  'SELECT public.flamme_inactivity_cron()'
);
