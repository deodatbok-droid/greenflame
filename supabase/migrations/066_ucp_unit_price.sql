-- Migration 066 : ajout du prix unitaire par part UCP
-- Le prix d'une part UCP varie selon la valorisation de GreenFlame au moment T.
-- Il doit être figé au moment de la souscription, jamais recalculé.

ALTER TABLE ucp_subscriptions
  ADD COLUMN IF NOT EXISTS prix_unitaire_fcfa bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN ucp_subscriptions.prix_unitaire_fcfa IS
  'Prix unitaire par part UCP au moment de la souscription (figé, jamais recalculé)';

-- Mettre à jour la vue ucp_registry pour inclure le prix unitaire
DROP VIEW IF EXISTS ucp_registry;

CREATE VIEW ucp_registry AS
SELECT
  s.id,
  s.bsd_number,
  s.status,
  s.subscription_type,
  s.ucp_parts,
  s.prix_unitaire_fcfa,
  s.amount_fcfa,
  s.accepted_at,
  s.otp_verified_at,
  s.pin_verified_at,
  s.confirmed_at,
  s.payment_note,
  s.pdf_url,
  s.notes,
  s.created_at,
  s.updated_at,
  -- Bénéficiaire
  u.full_name   AS beneficiary_name,
  u.phone       AS beneficiary_phone,
  u.email       AS beneficiary_email,
  u.referral_code AS beneficiary_code,
  -- Émetteur
  iss.full_name AS issuer_name,
  -- Confirmateur
  conf.full_name AS confirmer_name
FROM ucp_subscriptions s
LEFT JOIN users u    ON u.id   = s.user_id
LEFT JOIN users iss  ON iss.id = s.issued_by
LEFT JOIN users conf ON conf.id = s.confirmed_by;
