-- Migration 065 : Verrou 2 TAC — colonnes de comptage pour le calcul percentile
-- Remplace le champ avg_volume_per_member (volume moyen) par deux compteurs :
--   tac_actifs_count : membres du scope qui dépensent >= seuil ce mois
--   tac_scope_count  : total membres dans le scope considéré pour ce rang

ALTER TABLE public.leader_career_ranks
  ADD COLUMN IF NOT EXISTS tac_actifs_count INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tac_scope_count  INT NOT NULL DEFAULT 0;
