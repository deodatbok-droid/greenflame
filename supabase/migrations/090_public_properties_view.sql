-- ================================================================
-- Migration 090 : Vertical Immobilier & Location — Chantier 2
-- Vue publique en lecture seule sur biz_properties, pour le
-- catalogue /immobilier (invités + connectés). Exclut toute donnée
-- de contact du démarcheur et l'adresse précise (address_text,
-- location) — réservées au pass chercheur (Chantier 4).
-- ================================================================

CREATE OR REPLACE VIEW public.v_public_properties AS
SELECT
  p.id,
  p.business_id,
  ba.name           AS business_name,
  p.title,
  p.listing_type,
  p.property_type,
  p.price_fcfa,
  p.price_period,
  p.surface_m2,
  p.rooms,
  p.city,
  p.neighborhood,
  p.photos,
  p.description,
  p.created_at
FROM biz_properties p
JOIN biz_accounts ba ON ba.id = p.business_id
WHERE p.gf_listed = true
  AND p.status = 'disponible';
