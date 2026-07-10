-- ============================================================
-- KYC Setup : table kyc_submissions + bucket kyc-documents
-- ============================================================

-- Table des soumissions KYC
CREATE TABLE IF NOT EXISTS public.kyc_submissions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  document_type   VARCHAR(50) NOT NULL DEFAULT 'cni',
  front_path      TEXT,
  back_path       TEXT,
  status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'rejected')),
  rejection_reason TEXT,
  reviewed_by     UUID REFERENCES public.users(id),
  reviewed_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.kyc_submissions ENABLE ROW LEVEL SECURITY;

-- L'utilisateur voit sa propre soumission
CREATE POLICY "kyc_select_own" ON kyc_submissions
  FOR SELECT USING (user_id = auth.uid());

-- L'utilisateur crée sa soumission (upsert via insert+conflict)
CREATE POLICY "kyc_insert_own" ON kyc_submissions
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- L'admin voit toutes les soumissions
CREATE POLICY "kyc_select_admin" ON kyc_submissions
  FOR SELECT USING (is_admin() OR is_platform_upline());

-- L'admin peut mettre à jour le statut
CREATE POLICY "kyc_update_admin" ON kyc_submissions
  FOR UPDATE USING (is_admin() OR is_platform_upline());

-- ============================================================
-- Bucket Storage privé pour les documents KYC
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'kyc-documents',
  'kyc-documents',
  false,
  10485760,
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/heic','image/heif']
) ON CONFLICT (id) DO NOTHING;

-- Politique d'upload : l'utilisateur dans son propre dossier {uid}/...
CREATE POLICY "kyc_storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture : propriétaire du document
CREATE POLICY "kyc_storage_select_own" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Lecture : admin/platform_upline
CREATE POLICY "kyc_storage_select_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (is_admin() OR is_platform_upline())
  );

-- Remplacement du fichier (upsert)
CREATE POLICY "kyc_storage_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'kyc-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
