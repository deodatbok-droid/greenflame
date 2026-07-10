-- ══════════════════════════════════════════════════════════════════════════
-- Migration 072 — Forced Matrix 5×5 (Anti-extractif)
-- ══════════════════════════════════════════════════════════════════════════
-- Distinctions clés :
--   enrolled_by_id  = qui a physiquement recruté (l'enrolleur, inchangeable)
--   upline_id       = sponsor réel dans l'arbre de commissions (peut différer)
--   max_direct_slots = nombre maximal d'affiliés directs autorisés (défaut 5)
--
-- Architecture :
--   Si l'enrolleur a un slot disponible → placement direct (upline = enrolleur)
--   Si l'enrolleur est plein → BFS pour trouver un nœud éligible (actif + ≥2 recrues)
--   Si aucun nœud éligible → file d'attente spillover_queue
-- ══════════════════════════════════════════════════════════════════════════

-- ── 1. Colonnes sur users ────────────────────────────────────────────────

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS enrolled_by_id UUID REFERENCES public.users(id),
  ADD COLUMN IF NOT EXISTS max_direct_slots INTEGER NOT NULL DEFAULT 5;

-- Index recherche rapide des recrues personnelles
CREATE INDEX IF NOT EXISTS idx_users_enrolled_by ON public.users(enrolled_by_id);
CREATE INDEX IF NOT EXISTS idx_users_max_slots ON public.users(max_direct_slots);

-- ── 2. Table spillover_queue ─────────────────────────────────────────────
-- Stocke les recrues qui n'ont pas pu être placées (aucun nœud BFS éligible)

CREATE TABLE IF NOT EXISTS public.spillover_queue (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  new_user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  enrolled_by_id  UUID NOT NULL REFERENCES public.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at     TIMESTAMPTZ,
  placed_under_id UUID REFERENCES public.users(id),
  -- Raison du blocage au moment de la mise en file
  reason          TEXT DEFAULT 'no_eligible_slot'
);

CREATE INDEX IF NOT EXISTS idx_spillover_queue_enrolled ON public.spillover_queue(enrolled_by_id);
CREATE INDEX IF NOT EXISTS idx_spillover_queue_unresolved ON public.spillover_queue(resolved_at) WHERE resolved_at IS NULL;

-- ── 3. RLS spillover_queue ───────────────────────────────────────────────

ALTER TABLE public.spillover_queue ENABLE ROW LEVEL SECURITY;

-- Admin : tout voir
DROP POLICY IF EXISTS "admin_all_spillover_queue" ON public.spillover_queue;
CREATE POLICY "admin_all_spillover_queue"
  ON public.spillover_queue FOR ALL
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND 'admin' = ANY(role))
  );

-- Enrolleur : voir ses propres entrées
DROP POLICY IF EXISTS "enrolleur_read_own_spillover" ON public.spillover_queue;
CREATE POLICY "enrolleur_read_own_spillover"
  ON public.spillover_queue FOR SELECT
  TO authenticated
  USING (enrolled_by_id = auth.uid());

-- ── 4. Vue : disponibilité des slots par nœud ────────────────────────────

DROP VIEW IF EXISTS public.matrix_slot_view CASCADE;
CREATE OR REPLACE VIEW public.matrix_slot_view AS
SELECT
  u.id,
  u.full_name,
  u.max_direct_slots,
  u.last_active_at,
  COUNT(d.id)                              AS used_slots,
  u.max_direct_slots - COUNT(d.id)         AS available_slots,
  COUNT(e.id)                              AS enrolled_count,  -- recrues personnelles
  (SELECT current_rank FROM public.leader_career_ranks lcr WHERE lcr.user_id = u.id LIMIT 1)
                                           AS career_rank
FROM public.users u
LEFT JOIN public.users d ON d.upline_id      = u.id
LEFT JOIN public.users e ON e.enrolled_by_id = u.id
GROUP BY u.id, u.full_name, u.max_direct_slots, u.last_active_at;

-- ── 5. Fonction SQL helper : compte des affiliés directs (utilisée par l'API) ──

CREATE OR REPLACE FUNCTION public.direct_affiliates_count(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql STABLE
AS $$
  SELECT COUNT(*)::INTEGER FROM public.users WHERE upline_id = p_user_id;
$$;

-- ── 6. Mapping rang → max_direct_slots ──────────────────────────────────
-- Ranks 0-2 : 5 slots | Ranks 3-4 : 6 slots | Ranks 5-6 : 8 slots | Ranks 7-8 : 10 slots
-- Ce mapping est aussi codé en dur dans lib/career/engine.ts (source de vérité TypeScript)

COMMENT ON COLUMN public.users.enrolled_by_id IS
  'Qui a physiquement recruté cet utilisateur (enrolleur). Distinct de upline_id qui est le sponsor dans l''arbre de commissions.';

COMMENT ON COLUMN public.users.max_direct_slots IS
  'Nombre maximal d''affiliés directs autorisés. Déf 5, augmente avec le rang Plan de Carrière : Créateur→5, Builder→6, Leader Brasier→8, Kingmaker→10.';

COMMENT ON TABLE public.spillover_queue IS
  'File d''attente pour les recrues qui n''ont pas pu être placées via BFS (aucun nœud éligible = actif + ≥2 recrues).';
