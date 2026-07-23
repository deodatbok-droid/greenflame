-- ══════════════════════════════════════════════════════════════════════
-- 086 — Fonction PostGIS de recherche marchands à proximité
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION search_merchants_nearby(
  lat             double precision,
  lng             double precision,
  radius_m        integer          DEFAULT 5000,
  category_filter text             DEFAULT NULL
)
RETURNS TABLE (
  id                   uuid,
  business_name        text,
  business_category    text,
  public_slug          text,
  address_text         text,
  city                 text,
  neighborhood         text,
  distance_m           double precision,
  merchant_lat         double precision,
  merchant_lng         double precision,
  subscription_tier    text,
  agent_service_active boolean
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    m.id,
    m.business_name,
    m.business_category,
    m.public_slug,
    m.address_text,
    m.city,
    m.neighborhood,
    ROUND(ST_Distance(m.location, ST_MakePoint(lng, lat)::geography)::numeric, 0)::double precision AS distance_m,
    ST_Y(m.location::geometry)::double precision AS merchant_lat,
    ST_X(m.location::geometry)::double precision AS merchant_lng,
    m.subscription_tier,
    m.agent_service_active
  FROM merchants m
  WHERE
    m.is_active = true
    AND m.location IS NOT NULL
    AND ST_DWithin(m.location, ST_MakePoint(lng, lat)::geography, radius_m)
    AND (category_filter IS NULL OR m.business_category = category_filter)
  ORDER BY distance_m ASC
  LIMIT 50;
$$;
