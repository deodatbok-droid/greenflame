-- ══════════════════════════════════════════════════════════════════════
-- 085 — Float agent terrain (agent_float_accounts + agent_float_ledger)
-- ══════════════════════════════════════════════════════════════════════
-- Chaque field_agent dispose d'un compte float alimenté par l'admin.
-- Il utilise ce float pour créditer le wallet GreenFlame des consommateurs
-- qui paient en cash. append-only sur le ledger (même invariant que wallet_ledger).

-- ── 1. Compte float par agent ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_float_accounts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         UUID        NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance_fcfa     BIGINT      NOT NULL DEFAULT 0 CHECK (balance_fcfa >= 0),
  float_limit_fcfa BIGINT      NOT NULL DEFAULT 200000,  -- 200k FCFA par défaut
  is_active        BOOLEAN     NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_float_accounts_agent ON agent_float_accounts(agent_id);

-- ── 2. Ledger des mouvements float (append-only) ──────────────────────
CREATE TABLE IF NOT EXISTS agent_float_ledger (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id       UUID        NOT NULL REFERENCES users(id),
  entry_type     TEXT        NOT NULL CHECK (entry_type IN (
                               'admin_credit',     -- Admin alimente le float de l'agent
                               'consumer_topup',   -- Agent crédite wallet d'un consommateur (débit float)
                               'refund',           -- Remboursement vers le float agent
                               'reconciliation'    -- Ajustement de réconciliation admin
                             )),
  amount_fcfa    BIGINT      NOT NULL,  -- positif = crédit float, négatif = débit float
  balance_after  BIGINT      NOT NULL,  -- solde float après cette opération
  consumer_id    UUID        REFERENCES users(id),    -- consommateur bénéficiaire (si topup)
  float_entry_id UUID        REFERENCES float_entries(id) ON DELETE SET NULL, -- lien caisse plateforme
  notes          TEXT,
  created_by     UUID        NOT NULL REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_float_ledger_agent    ON agent_float_ledger(agent_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_float_ledger_consumer ON agent_float_ledger(consumer_id) WHERE consumer_id IS NOT NULL;

-- ── 3. RLS ────────────────────────────────────────────────────────────
ALTER TABLE agent_float_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_float_ledger   ENABLE ROW LEVEL SECURITY;

-- Service role : accès total
CREATE POLICY agent_float_accounts_service ON agent_float_accounts
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY agent_float_ledger_service ON agent_float_ledger
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Agent : lecture de son propre compte
CREATE POLICY agent_float_accounts_own ON agent_float_accounts
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY agent_float_ledger_own ON agent_float_ledger
  FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

-- Admin / platform_upline : lecture de tout
CREATE POLICY agent_float_accounts_admin ON agent_float_accounts
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role && ARRAY['admin','platform_upline']::text[])
  );

CREATE POLICY agent_float_ledger_admin ON agent_float_ledger
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
            AND role && ARRAY['admin','platform_upline']::text[])
  );

-- Aucun UPDATE/DELETE autorisé sur le ledger (append-only)

-- ── 4. Trigger updated_at ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_agent_float_timestamp()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS agent_float_updated_at ON agent_float_accounts;
CREATE TRIGGER agent_float_updated_at
  BEFORE UPDATE ON agent_float_accounts
  FOR EACH ROW EXECUTE FUNCTION update_agent_float_timestamp();
