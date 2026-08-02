-- Chantier 4 (Immobilier) — Pass chercheur + alertes de correspondance
-- Pass chercheur : 500 FCFA / mois, débloque le contact démarcheur + les alertes.

CREATE TABLE IF NOT EXISTS buyer_passes (
  user_id         uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  status          text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive')),
  started_at      timestamptz,
  expires_at      timestamptz,
  amount_fcfa     integer,
  payment_method  text,
  payment_ref     text,
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE buyer_passes ENABLE ROW LEVEL SECURITY;

CREATE POLICY buyer_passes_select_own ON buyer_passes
  FOR SELECT USING (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS property_alerts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  listing_type    text CHECK (listing_type IN ('location', 'vente')),
  property_type   text CHECK (property_type IN ('appartement', 'maison_villa', 'terrain_parcelle', 'local_commercial', 'bureau')),
  city            text,
  neighborhood    text,
  price_min       integer,
  price_max       integer,
  rooms_min       integer,
  surface_min     integer,
  active          boolean NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE property_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY property_alerts_all_own ON property_alerts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS property_alerts_user_idx ON property_alerts(user_id);
CREATE INDEX IF NOT EXISTS property_alerts_active_idx ON property_alerts(active) WHERE active = true;

-- activate_buyer_pass — étend de 30 jours depuis l'expiration si le pass est encore actif,
-- sinon repart de maintenant. Miroir de activate_merchant_subscription() (005_merchant_tiers.sql).
CREATE OR REPLACE FUNCTION activate_buyer_pass(
  p_user_id        uuid,
  p_amount_fcfa    integer,
  p_payment_method text,
  p_payment_ref    text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_expiry timestamptz;
  v_base           timestamptz;
BEGIN
  SELECT expires_at INTO v_current_expiry FROM buyer_passes WHERE user_id = p_user_id;
  v_base := GREATEST(COALESCE(v_current_expiry, now()), now());

  INSERT INTO buyer_passes (user_id, status, started_at, expires_at, amount_fcfa, payment_method, payment_ref, updated_at)
  VALUES (p_user_id, 'active', now(), v_base + interval '30 days', p_amount_fcfa, p_payment_method, p_payment_ref, now())
  ON CONFLICT (user_id) DO UPDATE SET
    status         = 'active',
    expires_at     = v_base + interval '30 days',
    amount_fcfa    = p_amount_fcfa,
    payment_method = p_payment_method,
    payment_ref    = p_payment_ref,
    updated_at     = now();
END;
$$;

REVOKE ALL ON FUNCTION activate_buyer_pass(uuid, integer, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION activate_buyer_pass(uuid, integer, text, text) TO service_role;

CREATE OR REPLACE FUNCTION buyer_pass_active(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM buyer_passes
    WHERE user_id = p_user_id AND status = 'active' AND expires_at > now()
  );
$$;

REVOKE ALL ON FUNCTION buyer_pass_active(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION buyer_pass_active(uuid) TO service_role, authenticated;
