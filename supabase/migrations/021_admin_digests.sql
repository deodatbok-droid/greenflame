-- Migration 021 : Rapports IA quotidiens pour l'admin
-- Claude génère chaque matin un diagnostic de la plateforme.
-- Stocké ici pour consultation différée et historique.
-- ================================================================

CREATE TABLE IF NOT EXISTS public.admin_digests (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_date      DATE        NOT NULL,   -- Journée couverte par le rapport
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  generated_by     VARCHAR(20) NOT NULL DEFAULT 'cron',  -- 'cron' | 'manual'

  -- Synthèse Claude
  summary          TEXT        NOT NULL,   -- Paragraphe exécutif
  findings         TEXT[]      NOT NULL DEFAULT '{}', -- Points clés (bullet list)
  recommendations  TEXT[]      NOT NULL DEFAULT '{}', -- Actions suggérées
  risk_level       VARCHAR(20) NOT NULL DEFAULT 'normal'
                     CHECK (risk_level IN ('normal', 'attention', 'alert')),

  -- Snapshot métriques brutes (audit)
  metrics_snapshot JSONB       NOT NULL DEFAULT '{}'
);

-- Un seul digest par jour (le plus récent remplace)
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_digests_date
  ON public.admin_digests (period_date DESC);

-- Lecture : admin/platform_upline seulement
ALTER TABLE public.admin_digests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_read_digests" ON public.admin_digests;
CREATE POLICY "admin_read_digests"
  ON public.admin_digests FOR SELECT
  USING (public.is_admin() OR public.is_platform_upline());

COMMENT ON TABLE public.admin_digests IS
  'Rapports IA quotidiens générés par Claude — diagnostic plateforme à 8h Cotonou.';
