-- Migration 019 : Champs IA pour l'analyse KYC automatique
-- L'analyseur Claude Vision pré-décide avant l'admin humain.
-- L'admin ne voit en priorité que les cas "needs_review" (~20%).
-- ================================================================

ALTER TABLE public.kyc_submissions
  ADD COLUMN IF NOT EXISTS ai_pre_decision VARCHAR(20)
    CHECK (ai_pre_decision IN ('auto_approve', 'needs_review', 'auto_reject')),

  ADD COLUMN IF NOT EXISTS ai_confidence   NUMERIC(4,3)
    CHECK (ai_confidence >= 0 AND ai_confidence <= 1),

  ADD COLUMN IF NOT EXISTS ai_extracted_name TEXT,

  ADD COLUMN IF NOT EXISTS ai_notes        TEXT,

  ADD COLUMN IF NOT EXISTS ai_analyzed_at  TIMESTAMPTZ;

-- Index pour filtrer efficacement par pré-décision IA
CREATE INDEX IF NOT EXISTS idx_kyc_ai_pre_decision
  ON public.kyc_submissions (ai_pre_decision, status, created_at DESC)
  WHERE status = 'pending';

COMMENT ON COLUMN public.kyc_submissions.ai_pre_decision IS
  'Pré-décision Claude Vision : auto_approve | needs_review | auto_reject';
COMMENT ON COLUMN public.kyc_submissions.ai_confidence IS
  'Score de confiance IA (0.000 à 1.000)';
COMMENT ON COLUMN public.kyc_submissions.ai_extracted_name IS
  'Nom extrait du document par Claude Vision (audit)';
COMMENT ON COLUMN public.kyc_submissions.ai_notes IS
  'Notes IA sur la qualité et validité du document';
