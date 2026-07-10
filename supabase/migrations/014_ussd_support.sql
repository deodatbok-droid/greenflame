-- =============================================================
-- Migration 014 : Support USSD & anti-brute-force PIN
-- GreenFlame - A appliquer dans Supabase -> SQL Editor
-- =============================================================

-- ---------------------------------------------------------------
-- 1. merchants.short_code
--    Code 5 chiffres unique pour identifier le marchand en USSD
-- ---------------------------------------------------------------

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS short_code VARCHAR(6) UNIQUE;

CREATE OR REPLACE FUNCTION generate_merchant_short_code()
RETURNS VARCHAR(6) LANGUAGE plpgsql AS $$
DECLARE
  code VARCHAR(6);
  exists_already BOOLEAN;
BEGIN
  LOOP
    code := LPAD((FLOOR(RANDOM() * 90000) + 10000)::TEXT, 5, '0');
    SELECT EXISTS (
      SELECT 1 FROM merchants WHERE short_code = code
    ) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

CREATE OR REPLACE FUNCTION merchant_assign_short_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.short_code IS NULL THEN
    NEW.short_code := generate_merchant_short_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_merchant_short_code ON merchants;
CREATE TRIGGER trg_merchant_short_code
  BEFORE INSERT ON merchants
  FOR EACH ROW EXECUTE FUNCTION merchant_assign_short_code();

-- Backfill : assigner un code a tous les marchands existants
UPDATE merchants
SET short_code = generate_merchant_short_code()
WHERE short_code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_merchants_short_code
  ON merchants (short_code);

-- ---------------------------------------------------------------
-- 2. users.pin_attempts + users.pin_locked_until
--    Anti-brute-force : blocage 24h apres 3 tentatives incorrectes
-- ---------------------------------------------------------------

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS pin_attempts     SMALLINT    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;

COMMENT ON COLUMN users.pin_attempts IS 'Tentatives PIN incorrectes consecutives. Reset a 0 apres PIN correct.';
COMMENT ON COLUMN users.pin_locked_until IS 'Fin de blocage PIN (NULL = non bloque). 24h apres 3 tentatives incorrectes.';

-- ---------------------------------------------------------------
-- 3. Table ussd_sessions
--    Etat de chaque session USSD active (TTL 3 minutes)
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ussd_sessions (
  session_id     TEXT        PRIMARY KEY,
  phone_number   TEXT        NOT NULL,
  user_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
  state          TEXT        NOT NULL DEFAULT 'MAIN',
  context        JSONB,
  request_count  SMALLINT    NOT NULL DEFAULT 1,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at     TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '3 minutes')
);

CREATE INDEX IF NOT EXISTS idx_ussd_sessions_expires
  ON ussd_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_ussd_sessions_phone
  ON ussd_sessions (phone_number);

ALTER TABLE ussd_sessions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION cleanup_expired_ussd_sessions()
RETURNS INTEGER LANGUAGE plpgsql AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM ussd_sessions WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON TABLE ussd_sessions IS 'Sessions USSD actives. TTL 3 min. Nettoyer: SELECT cleanup_expired_ussd_sessions()';

-- ---------------------------------------------------------------
-- 4. Table ussd_transaction_log
--    Audit de toutes les operations USSD
-- ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ussd_transaction_log (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          TEXT        NOT NULL,
  phone_number        TEXT        NOT NULL,
  action              TEXT        NOT NULL CHECK (action IN ('payment', 'balance', 'history', 'set_pin')),
  status              TEXT        NOT NULL CHECK (status IN ('success', 'failed', 'cancelled')),
  amount_fcfa         BIGINT,
  merchant_short_code VARCHAR(6),
  transaction_id      UUID        REFERENCES transactions(id) ON DELETE SET NULL,
  error_message       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ussd_log_phone
  ON ussd_transaction_log (phone_number, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ussd_log_action_status
  ON ussd_transaction_log (action, status, created_at DESC);

ALTER TABLE ussd_transaction_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE ussd_transaction_log IS 'Audit trail de toutes les operations USSD.';

-- ---------------------------------------------------------------
-- Verification finale (copier-coller apres execution)
-- SELECT business_name, short_code FROM merchants ORDER BY created_at;
-- SELECT table_name FROM information_schema.tables WHERE table_name IN ('ussd_sessions','ussd_transaction_log');
-- ---------------------------------------------------------------
