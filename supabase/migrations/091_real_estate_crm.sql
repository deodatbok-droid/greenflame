-- ================================================================
-- Migration 091 : Vertical Immobilier & Location — Chantier 3
-- CRM léger : mandats + visites (réutilise biz_customers existant)
-- Suit la convention business_id/biz_is_member confirmée dans
-- 065_business_core.sql et 089_real_estate_properties.sql.
-- ================================================================

CREATE TABLE IF NOT EXISTS biz_property_mandats (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  biz_property_id  uuid NOT NULL REFERENCES biz_properties(id) ON DELETE CASCADE,

  owner_name       text NOT NULL,
  owner_phone      text,
  mandat_type      text NOT NULL DEFAULT 'simple' CHECK (mandat_type IN ('exclusif', 'simple')),
  expires_at       date,
  status           text NOT NULL DEFAULT 'actif' CHECK (status IN ('actif', 'expire', 'resilie')),
  notes            text,

  created_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biz_property_mandats ENABLE ROW LEVEL SECURITY;

CREATE POLICY biz_property_mandats_member ON biz_property_mandats
  USING (biz_is_member(business_id));
CREATE POLICY biz_property_mandats_member_write ON biz_property_mandats
  FOR INSERT WITH CHECK (biz_is_member(business_id));
CREATE POLICY biz_property_mandats_member_update ON biz_property_mandats
  FOR UPDATE USING (biz_is_member(business_id));
CREATE POLICY biz_property_mandats_member_delete ON biz_property_mandats
  FOR DELETE USING (biz_is_member(business_id));

CREATE INDEX IF NOT EXISTS biz_property_mandats_business_idx ON biz_property_mandats(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS biz_property_mandats_property_idx ON biz_property_mandats(biz_property_id);

-- ================================================================

CREATE TABLE IF NOT EXISTS biz_property_visits (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  biz_property_id  uuid NOT NULL REFERENCES biz_properties(id) ON DELETE CASCADE,
  customer_id      uuid REFERENCES biz_customers(id) ON DELETE SET NULL,

  scheduled_at     timestamptz NOT NULL,
  status           text NOT NULL DEFAULT 'planifiee' CHECK (status IN ('planifiee', 'effectuee', 'annulee')),
  notes            text,

  created_by       uuid REFERENCES users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biz_property_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY biz_property_visits_member ON biz_property_visits
  USING (biz_is_member(business_id));
CREATE POLICY biz_property_visits_member_write ON biz_property_visits
  FOR INSERT WITH CHECK (biz_is_member(business_id));
CREATE POLICY biz_property_visits_member_update ON biz_property_visits
  FOR UPDATE USING (biz_is_member(business_id));
CREATE POLICY biz_property_visits_member_delete ON biz_property_visits
  FOR DELETE USING (biz_is_member(business_id));

CREATE INDEX IF NOT EXISTS biz_property_visits_business_idx ON biz_property_visits(business_id, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS biz_property_visits_property_idx ON biz_property_visits(biz_property_id);
CREATE INDEX IF NOT EXISTS biz_property_visits_customer_idx ON biz_property_visits(customer_id);
