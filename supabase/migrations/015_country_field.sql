-- Migration 015 : Champ country sur users et merchants
-- Prépare l'expansion multi-pays de GreenFlame

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS country CHAR(2) NOT NULL DEFAULT 'BJ';

ALTER TABLE merchants
  ADD COLUMN IF NOT EXISTS country CHAR(2) NOT NULL DEFAULT 'BJ';

CREATE INDEX IF NOT EXISTS idx_users_country ON users (country);
CREATE INDEX IF NOT EXISTS idx_merchants_country ON merchants (country);

COMMENT ON COLUMN users.country     IS 'Code ISO pays (BJ=Bénin, TG=Togo, CI=Côte d Ivoire, GH=Ghana...)';
COMMENT ON COLUMN merchants.country IS 'Code ISO pays du marchand';
