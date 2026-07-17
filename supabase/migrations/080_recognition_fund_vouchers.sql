-- ══════════════════════════════════════════════════════════════════════════
-- Migration 080 — Fonds de Reconnaissance + Bons d'Achat (Dividendes Communautaires)
--
-- Nouvelle mécanique de redistribution :
--   Chaque dividende communautaire reçu par un Cercle (L1-L5) est splitté :
--     60% → balance_fcfa (cash immédiat)
--     30% → voucher_rights_monthly (droit d'achat GreenFlame, ce mois)
--     10% → recognition_fund_contributions (Fonds de Reconnaissance)
--
-- Le Fonds de Reconnaissance est distribué mensuellement aux leaders R3+
--   via une formule Fibonacci (poids : R3=3, R4=5, R5=8, R6=13, R7=21)
--   proportionnelle au volume de leur communauté.
--
-- Les bons d'achat sont émis à la demande depuis le pool mensuel de l'utilisateur,
--   valables chez tout marchand GreenFlame, expiration fin de mois (perte sèche).
-- ══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- 1. CONTRIBUTIONS AU FONDS DE RECONNAISSANCE
--    Trace chaque 10% prélevé sur chaque dividende communautaire reçu
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recognition_fund_contributions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_id  uuid        NOT NULL REFERENCES transactions(id) ON DELETE RESTRICT,
  cercle_level    smallint    NOT NULL CHECK (cercle_level BETWEEN 1 AND 5),
  -- Dividende brut reçu avant split
  gross_amount    integer     NOT NULL CHECK (gross_amount > 0),
  -- 10% de gross_amount → va au Fonds de Reconnaissance
  fund_amount     integer     NOT NULL CHECK (fund_amount > 0),
  -- Mois de contribution (YYYY-MM, ex: '2026-07')
  month_year      char(7)     NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfc_user_month    ON recognition_fund_contributions(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_rfc_month         ON recognition_fund_contributions(month_year);
CREATE INDEX IF NOT EXISTS idx_rfc_transaction   ON recognition_fund_contributions(transaction_id);

-- ─────────────────────────────────────────────────────────────
-- 2. POOL MENSUEL DU FONDS DE RECONNAISSANCE
--    Agrégé en début de mois par le cron, utilisé pour calculer les parts
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recognition_fund_monthly (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year      char(7)     NOT NULL UNIQUE,
  total_fcfa      integer     NOT NULL DEFAULT 0 CHECK (total_fcfa >= 0),
  -- Nombre de contributions agrégées
  contributions_count integer NOT NULL DEFAULT 0,
  -- Statut : 'open' en cours de mois, 'distributed' après cron
  status          text        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open', 'distributing', 'distributed')),
  distributed_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rfm_month_year ON recognition_fund_monthly(month_year);
CREATE INDEX IF NOT EXISTS idx_rfm_status     ON recognition_fund_monthly(status);

-- ─────────────────────────────────────────────────────────────
-- 3. RÉCOMPENSES DU FONDS DE RECONNAISSANCE
--    Calculées et insérées par le cron mensuel pour chaque leader éligible R3+
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recognition_fund_awards (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  month_year          char(7)     NOT NULL,
  fund_id             uuid        NOT NULL REFERENCES recognition_fund_monthly(id) ON DELETE RESTRICT,
  user_id             uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  career_rank         smallint    NOT NULL CHECK (career_rank BETWEEN 3 AND 8),
  -- Fibonacci
  fibonacci_poids     smallint    NOT NULL,  -- R3=3, R4=5, R5=8, R6=13, R7=21
  -- Volume communauté du mois (somme des dividendes bruts générés par la communauté)
  community_volume    bigint      NOT NULL DEFAULT 0,
  -- Score = poids × volume
  score               bigint      NOT NULL DEFAULT 0,
  -- Somme de tous les scores (snapshot au moment du calcul)
  total_scores        bigint      NOT NULL DEFAULT 0,
  -- Part calculée = Fonds × (score / total_scores)
  award_fcfa          integer     NOT NULL DEFAULT 0 CHECK (award_fcfa >= 0),
  -- Statut de versement
  status              text        NOT NULL DEFAULT 'pending'
                                  CHECK (status IN ('pending', 'paid', 'cancelled')),
  paid_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (month_year, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rfa_month_year ON recognition_fund_awards(month_year);
CREATE INDEX IF NOT EXISTS idx_rfa_user_id    ON recognition_fund_awards(user_id);
CREATE INDEX IF NOT EXISTS idx_rfa_status     ON recognition_fund_awards(status);

-- ─────────────────────────────────────────────────────────────
-- 4. DROITS AUX BONS D'ACHAT (pool mensuel par utilisateur)
--    30% de chaque dividende communautaire reçu → s'accumule ici
--    Se réinitialise chaque mois (perte sèche si non utilisé)
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS voucher_rights_monthly (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  month_year      char(7)     NOT NULL,
  -- Pool total accumulé ce mois (30% des dividendes reçus)
  total_fcfa      integer     NOT NULL DEFAULT 0 CHECK (total_fcfa >= 0),
  -- Montant déjà émis en bons (emit_on_demand)
  emitted_fcfa    integer     NOT NULL DEFAULT 0 CHECK (emitted_fcfa >= 0),
  -- Disponible = total_fcfa - emitted_fcfa
  -- Statut : 'active' en cours de mois, 'expired' après cron fin de mois
  status          text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'expired')),
  expired_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, month_year)
);

CREATE INDEX IF NOT EXISTS idx_vrm_user_month ON voucher_rights_monthly(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_vrm_status     ON voucher_rights_monthly(status);

-- Vue pratique : pool disponible ce mois
CREATE OR REPLACE VIEW voucher_rights_current AS
SELECT
  vrm.user_id,
  vrm.month_year,
  vrm.total_fcfa,
  vrm.emitted_fcfa,
  GREATEST(0, vrm.total_fcfa - vrm.emitted_fcfa) AS available_fcfa
FROM voucher_rights_monthly vrm
WHERE vrm.month_year = TO_CHAR(now(), 'YYYY-MM')
  AND vrm.status = 'active';

-- ─────────────────────────────────────────────────────────────
-- 5. BONS D'ACHAT (émis à la demande)
--    Chaque bon est une émission explicite depuis le pool mensuel.
--    Valable chez tout marchand GreenFlame jusqu'à la fin du mois.
--    Utilisation partielle autorisée (ex: 3000F bon + 5000F cash).
--    Don possible à un membre ou non-membre (levier d'acquisition).
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vouchers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Code alphanumérique court pour présentation en caisse
  code                text        NOT NULL UNIQUE DEFAULT upper(substring(gen_random_uuid()::text, 1, 8)),
  -- Qui possède ce bon (propriétaire courant)
  owner_id            uuid        REFERENCES users(id) ON DELETE SET NULL,
  -- Qui a initialement émis ce bon (pour traçabilité)
  issued_by_id        uuid        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  -- Pool mensuel source
  rights_id           uuid        NOT NULL REFERENCES voucher_rights_monthly(id) ON DELETE RESTRICT,
  -- Montant du bon lors de l'émission
  amount_fcfa         integer     NOT NULL CHECK (amount_fcfa > 0),
  -- Montant restant (diminue à chaque utilisation partielle)
  remaining_fcfa      integer     NOT NULL CHECK (remaining_fcfa >= 0),
  -- Pour les bons offerts à des non-membres : email/téléphone du destinataire
  gift_recipient_phone text,
  gift_recipient_email text,
  -- Statut
  status              text        NOT NULL DEFAULT 'active'
                                  CHECK (status IN ('active', 'partially_used', 'used', 'expired', 'cancelled')),
  -- Expiration : toujours fin du mois d'émission
  expires_at          timestamptz NOT NULL,
  -- Dates
  used_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vouchers_owner       ON vouchers(owner_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_issued_by   ON vouchers(issued_by_id);
CREATE INDEX IF NOT EXISTS idx_vouchers_code        ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status      ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_vouchers_expires_at  ON vouchers(expires_at);
CREATE INDEX IF NOT EXISTS idx_vouchers_rights_id   ON vouchers(rights_id);

-- ─────────────────────────────────────────────────────────────
-- 6. UTILISATIONS DES BONS D'ACHAT
--    Trace chaque utilisation (totale ou partielle) d'un bon chez un marchand
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id      uuid        NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
  transaction_id  uuid        REFERENCES transactions(id) ON DELETE SET NULL,
  merchant_id     uuid        NOT NULL REFERENCES merchants(id) ON DELETE RESTRICT,
  -- Montant utilisé lors de cette rédemption
  amount_used     integer     NOT NULL CHECK (amount_used > 0),
  -- Restant après rédemption
  remaining_after integer     NOT NULL CHECK (remaining_after >= 0),
  redeemed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vr_voucher_id     ON voucher_redemptions(voucher_id);
CREATE INDEX IF NOT EXISTS idx_vr_merchant_id    ON voucher_redemptions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_vr_transaction_id ON voucher_redemptions(transaction_id);

-- ─────────────────────────────────────────────────────────────
-- 7. RLS — Fonds de Reconnaissance
-- ─────────────────────────────────────────────────────────────

ALTER TABLE recognition_fund_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE recognition_fund_monthly       ENABLE ROW LEVEL SECURITY;
ALTER TABLE recognition_fund_awards        ENABLE ROW LEVEL SECURITY;

-- Contributions : l'utilisateur voit les siennes, service role écrit
DROP POLICY IF EXISTS "user_read_own_rfc"    ON recognition_fund_contributions;
CREATE POLICY "user_read_own_rfc"
  ON recognition_fund_contributions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_all_rfc"      ON recognition_fund_contributions;
CREATE POLICY "service_all_rfc"
  ON recognition_fund_contributions FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "admin_all_rfc"        ON recognition_fund_contributions;
CREATE POLICY "admin_all_rfc"
  ON recognition_fund_contributions FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(role)));

-- Pool mensuel : admin + service
DROP POLICY IF EXISTS "admin_all_rfm"        ON recognition_fund_monthly;
CREATE POLICY "admin_all_rfm"
  ON recognition_fund_monthly FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(role)));

DROP POLICY IF EXISTS "service_all_rfm"      ON recognition_fund_monthly;
CREATE POLICY "service_all_rfm"
  ON recognition_fund_monthly FOR ALL
  USING (auth.role() = 'service_role');

-- Récompenses : l'utilisateur voit les siennes
DROP POLICY IF EXISTS "user_read_own_rfa"    ON recognition_fund_awards;
CREATE POLICY "user_read_own_rfa"
  ON recognition_fund_awards FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "admin_all_rfa"        ON recognition_fund_awards;
CREATE POLICY "admin_all_rfa"
  ON recognition_fund_awards FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(role)));

DROP POLICY IF EXISTS "service_all_rfa"      ON recognition_fund_awards;
CREATE POLICY "service_all_rfa"
  ON recognition_fund_awards FOR ALL
  USING (auth.role() = 'service_role');

-- ─────────────────────────────────────────────────────────────
-- 8. RLS — Bons d'Achat
-- ─────────────────────────────────────────────────────────────

ALTER TABLE voucher_rights_monthly ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers               ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_redemptions    ENABLE ROW LEVEL SECURITY;

-- Pool mensuel : l'utilisateur voit le sien
DROP POLICY IF EXISTS "user_read_own_vrm"    ON voucher_rights_monthly;
CREATE POLICY "user_read_own_vrm"
  ON voucher_rights_monthly FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "service_all_vrm"      ON voucher_rights_monthly;
CREATE POLICY "service_all_vrm"
  ON voucher_rights_monthly FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "admin_all_vrm"        ON voucher_rights_monthly;
CREATE POLICY "admin_all_vrm"
  ON voucher_rights_monthly FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(role)));

-- Bons : propriétaire voit ses bons + bons qu'il a émis
DROP POLICY IF EXISTS "user_read_own_vouchers" ON vouchers;
CREATE POLICY "user_read_own_vouchers"
  ON vouchers FOR SELECT
  USING (auth.uid() = owner_id OR auth.uid() = issued_by_id);

DROP POLICY IF EXISTS "service_all_vouchers"   ON vouchers;
CREATE POLICY "service_all_vouchers"
  ON vouchers FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "admin_all_vouchers"     ON vouchers;
CREATE POLICY "admin_all_vouchers"
  ON vouchers FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(role)));

-- Rédemptions : marchand voit les siennes, service role écrit
DROP POLICY IF EXISTS "service_all_vr"         ON voucher_redemptions;
CREATE POLICY "service_all_vr"
  ON voucher_redemptions FOR ALL
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "admin_all_vr"           ON voucher_redemptions;
CREATE POLICY "admin_all_vr"
  ON voucher_redemptions FOR ALL
  USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND 'admin' = ANY(role)));

-- ─────────────────────────────────────────────────────────────
-- 9. FONCTION RPC — increment_voucher_rights
--    Appelée par distribute.ts lors de chaque dividende communautaire.
--    Upsert atomique sur voucher_rights_monthly : crée si absent, incrémente sinon.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.increment_voucher_rights(
  p_user_id  uuid,
  p_month    char(7),
  p_amount   integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.voucher_rights_monthly (user_id, month_year, total_fcfa, emitted_fcfa, status)
  VALUES (p_user_id, p_month, p_amount, 0, 'active')
  ON CONFLICT (user_id, month_year) DO UPDATE
    SET total_fcfa  = voucher_rights_monthly.total_fcfa + EXCLUDED.total_fcfa,
        updated_at  = now();
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 10. COLONNES LEADER_CAREER_RANKS — tac_actifs / tac_scope
--     (ajoutées ici si absentes ; engine.ts les utilise)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE leader_career_ranks
  ADD COLUMN IF NOT EXISTS tac_actifs_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tac_scope_count   integer NOT NULL DEFAULT 0;

-- ─────────────────────────────────────────────────────────────
-- 11. FONCTION RPC — get_recognition_fund_scores
--     Retourne le volume communautaire par leader éligible (R3+) pour un mois donné.
--     Utilisé par /api/fonds-reconnaissance pour l'estimation temps réel.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_recognition_fund_scores(p_month char(7))
RETURNS TABLE (user_id uuid, career_rank smallint, volume bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    rfc.user_id,
    lcr.current_rank  AS career_rank,
    SUM(rfc.gross_amount)::bigint AS volume
  FROM public.recognition_fund_contributions rfc
  JOIN public.leader_career_ranks lcr
    ON lcr.user_id = rfc.user_id
  WHERE rfc.month_year = p_month
    AND lcr.current_rank >= 3
  GROUP BY rfc.user_id, lcr.current_rank;
$$;
