-- ─────────────────────────────────────────────────────────────────────────────
-- 066 — Business Extended : paramètres, fournisseurs, bons de commande
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Colonnes supplémentaires sur biz_accounts ────────────────────────────────
ALTER TABLE biz_accounts
  ADD COLUMN IF NOT EXISTS address         text,
  ADD COLUMN IF NOT EXISTS tax_id          text,
  ADD COLUMN IF NOT EXISTS default_tax_rate numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS invoice_prefix  text DEFAULT 'FACT-',
  ADD COLUMN IF NOT EXISTS invoice_notes   text;

-- ── biz_suppliers ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_suppliers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  name         text NOT NULL,
  contact_name text,
  email        text,
  phone        text,
  country      text,
  address      text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biz_suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_suppliers_member ON biz_suppliers
  USING (biz_is_member(business_id));
CREATE POLICY biz_suppliers_member_write ON biz_suppliers
  FOR INSERT WITH CHECK (biz_is_member(business_id));
CREATE POLICY biz_suppliers_member_update ON biz_suppliers
  FOR UPDATE USING (biz_is_member(business_id));

CREATE INDEX IF NOT EXISTS biz_suppliers_business_idx ON biz_suppliers(business_id);

-- ── biz_purchase_orders ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_purchase_orders (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  supplier_id    uuid REFERENCES biz_suppliers(id),
  supplier_name  text,
  order_number   text,
  status         text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','received','cancelled')),
  total_amount   numeric(12,2) NOT NULL DEFAULT 0,
  expected_date  date,
  received_at    timestamptz,
  notes          text,
  items          jsonb NOT NULL DEFAULT '[]',
  created_by     uuid REFERENCES users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biz_purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_po_member ON biz_purchase_orders
  USING (biz_is_member(business_id));
CREATE POLICY biz_po_member_write ON biz_purchase_orders
  FOR INSERT WITH CHECK (biz_is_member(business_id));
CREATE POLICY biz_po_member_update ON biz_purchase_orders
  FOR UPDATE USING (biz_is_member(business_id));

CREATE INDEX IF NOT EXISTS biz_po_business_idx ON biz_purchase_orders(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS biz_po_status_idx   ON biz_purchase_orders(business_id, status);

-- Séquences pour numérotation automatique
CREATE SEQUENCE IF NOT EXISTS biz_invoice_seq START 1;
CREATE SEQUENCE IF NOT EXISTS biz_quote_seq   START 1;
CREATE SEQUENCE IF NOT EXISTS biz_po_seq      START 1;
