-- ============================================================
-- 065_ucp_subscriptions.sql
-- Bulletin de Souscription de Droits UCP (BSD-UCP)
-- Gère l'émission, la signature 3 étapes, la confirmation
-- admin et le registre permanent.
-- ============================================================

-- ── Séquence numérotation BSD ─────────────────────────────
CREATE SEQUENCE IF NOT EXISTS ucp_bsd_seq START 1;

CREATE OR REPLACE FUNCTION generate_bsd_number()
RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  RETURN 'BSD-' || to_char(now(), 'YYYY') || '-'
         || lpad(nextval('ucp_bsd_seq')::text, 4, '0');
END;
$$;

-- ── Table principale ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS ucp_subscriptions (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Numérotation officielle (auto-générée)
  bsd_number          text        UNIQUE NOT NULL DEFAULT generate_bsd_number(),

  -- Parties
  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  issued_by           uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- Nature de la souscription
  subscription_type   text        NOT NULL CHECK (subscription_type IN ('purchase', 'attribution')),
  ucp_parts           integer     NOT NULL CHECK (ucp_parts > 0),
  amount_fcfa         bigint      NOT NULL DEFAULT 0,   -- 0 pour attribution

  -- Cycle de vie
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending','user_signed','signed','revoked')),

  -- ── Étape 1 : Acceptation ──────────────────────────────
  accepted_at         timestamptz,

  -- ── Étape 2 : OTP ─────────────────────────────────────
  otp_hash            text,                             -- bcrypt du code envoyé
  otp_expires_at      timestamptz,
  otp_verified_at     timestamptz,

  -- ── Étape 3 : PIN transaction ─────────────────────────
  pin_verified_at     timestamptz,

  -- ── Confirmation admin (paiement reçu) ────────────────
  confirmed_by        uuid        REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at        timestamptz,
  payment_note        text,                             -- note admin sur le règlement

  -- ── PDF ───────────────────────────────────────────────
  pdf_url             text,                             -- path Supabase Storage

  -- ── Révocation ────────────────────────────────────────
  revoked_by          uuid        REFERENCES users(id) ON DELETE SET NULL,
  revoked_at          timestamptz,
  revocation_reason   text,

  -- ── Méta ──────────────────────────────────────────────
  notes               text,                             -- note interne admin
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Trigger updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION ucp_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ucp_updated_at ON ucp_subscriptions;
CREATE TRIGGER trg_ucp_updated_at
  BEFORE UPDATE ON ucp_subscriptions
  FOR EACH ROW EXECUTE FUNCTION ucp_set_updated_at();

-- ── Index ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ucp_user_id    ON ucp_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_ucp_status     ON ucp_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_ucp_issued_by  ON ucp_subscriptions(issued_by);
CREATE INDEX IF NOT EXISTS idx_ucp_created_at ON ucp_subscriptions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ucp_bsd_number ON ucp_subscriptions(bsd_number);

-- ── RLS ───────────────────────────────────────────────────
ALTER TABLE ucp_subscriptions ENABLE ROW LEVEL SECURITY;

-- Utilisateur : voir ses propres bulletins
DROP POLICY IF EXISTS "ucp_own_select" ON ucp_subscriptions;
CREATE POLICY "ucp_own_select" ON ucp_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Admin : tout voir
DROP POLICY IF EXISTS "ucp_admin_select" ON ucp_subscriptions;
CREATE POLICY "ucp_admin_select" ON ucp_subscriptions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND ('admin' = ANY(role) OR 'platform_upline' = ANY(role))
    )
  );

-- Admin : créer des bulletins
DROP POLICY IF EXISTS "ucp_admin_insert" ON ucp_subscriptions;
CREATE POLICY "ucp_admin_insert" ON ucp_subscriptions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND ('admin' = ANY(role) OR 'platform_upline' = ANY(role))
    )
  );

-- Admin : modifier (confirmation, révocation, notes)
DROP POLICY IF EXISTS "ucp_admin_update" ON ucp_subscriptions;
CREATE POLICY "ucp_admin_update" ON ucp_subscriptions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND ('admin' = ANY(role) OR 'platform_upline' = ANY(role))
    )
  );

-- Utilisateur : avancer sa signature (géré côté API via service client)
-- La policy ci-dessous protège la ligne, la logique de transition est dans l'API
DROP POLICY IF EXISTS "ucp_user_sign_update" ON ucp_subscriptions;
CREATE POLICY "ucp_user_sign_update" ON ucp_subscriptions
  FOR UPDATE USING (
    auth.uid() = user_id
    AND status IN ('pending', 'user_signed')
  );

-- ── Vue registre (lecture admin via service client) ───────
-- Accessible uniquement via les routes API côté serveur
-- (createServiceClient contourne la RLS — pas exposé publiquement)
DROP VIEW IF EXISTS public.ucp_registry CASCADE;
CREATE VIEW ucp_registry AS
SELECT
  s.id,
  s.bsd_number,
  s.status,
  s.subscription_type,
  s.ucp_parts,
  s.amount_fcfa,
  s.notes,
  s.payment_note,
  s.pdf_url,
  s.created_at,
  s.accepted_at,
  s.otp_verified_at,
  s.pin_verified_at,
  s.confirmed_at,
  s.revoked_at,
  s.revocation_reason,
  -- Bénéficiaire
  u.full_name  AS user_full_name,
  u.phone      AS user_phone,
  u.email      AS user_email,
  u.referral_code AS user_referral_code,
  -- Émetteur
  a.full_name  AS issued_by_name,
  -- Confirmateur
  c.full_name  AS confirmed_by_name
FROM  ucp_subscriptions s
JOIN  users u ON u.id = s.user_id
JOIN  users a ON a.id = s.issued_by
LEFT JOIN users c ON c.id = s.confirmed_by;
