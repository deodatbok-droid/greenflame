-- ================================================================
-- Migration 089 : Vertical Immobilier & Location — Chantier 1
-- Schéma biz_properties (gestion des biens par démarcheurs/agences)
-- Suit la convention business_id/biz_is_member confirmée dans
-- 065_business_core.sql. PostGIS déjà activé (084_merchant_applications.sql).
-- ================================================================

CREATE TABLE IF NOT EXISTS biz_properties (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,

  title          text NOT NULL,
  listing_type   text NOT NULL CHECK (listing_type IN ('location', 'vente')),
  property_type  text NOT NULL CHECK (property_type IN ('appartement', 'maison_villa', 'terrain_parcelle', 'local_commercial', 'bureau')),

  price_fcfa     numeric(14,2) NOT NULL,
  price_period   text CHECK (price_period IN ('mensuel', 'unique')),

  surface_m2     numeric(10,2),
  rooms          integer,

  city           text,
  neighborhood   text,
  address_text   text,
  location       GEOGRAPHY(POINT, 4326),

  photos         text[] NOT NULL DEFAULT '{}',
  description    text,

  status         text NOT NULL DEFAULT 'disponible' CHECK (status IN ('disponible', 'loue', 'vendu', 'suspendu')),
  gf_listed      boolean NOT NULL DEFAULT false,

  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biz_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY biz_properties_member ON biz_properties
  USING (biz_is_member(business_id));
CREATE POLICY biz_properties_member_write ON biz_properties
  FOR INSERT WITH CHECK (biz_is_member(business_id));
CREATE POLICY biz_properties_member_update ON biz_properties
  FOR UPDATE USING (biz_is_member(business_id));
CREATE POLICY biz_properties_member_delete ON biz_properties
  FOR DELETE USING (biz_is_member(business_id));

CREATE INDEX IF NOT EXISTS biz_properties_business_idx ON biz_properties(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS biz_properties_location_gix  ON biz_properties USING GIST(location);
CREATE INDEX IF NOT EXISTS biz_properties_public_idx    ON biz_properties(status, listing_type, property_type) WHERE gf_listed = true;
