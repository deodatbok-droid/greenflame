-- Colonne d'accès UCP sur invitation admin
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS ucp_unlocked BOOLEAN NOT NULL DEFAULT FALSE;

-- Déodat (platform_upline) déverrouillé d'office
UPDATE users
  SET ucp_unlocked = TRUE
  WHERE role @> ARRAY['platform_upline'];
