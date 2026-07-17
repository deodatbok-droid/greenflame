-- Liste d'attente pré-lancement avec arborescence de parrainage
CREATE TABLE IF NOT EXISTS waitlist_entries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      TEXT        NOT NULL,
  last_name       TEXT        NOT NULL,
  email           TEXT,
  whatsapp        TEXT        NOT NULL,
  role            TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('merchant', 'user')),
  referral_code   TEXT        UNIQUE NOT NULL,
  referred_by_id  UUID        REFERENCES waitlist_entries(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS waitlist_referral_code_idx ON waitlist_entries(referral_code);
CREATE INDEX IF NOT EXISTS waitlist_referred_by_idx   ON waitlist_entries(referred_by_id);

ALTER TABLE waitlist_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "waitlist_insert" ON waitlist_entries
  FOR INSERT TO anon, authenticated WITH CHECK (true);

CREATE POLICY "waitlist_select" ON waitlist_entries
  FOR SELECT TO anon, authenticated USING (true);
