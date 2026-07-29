-- ============================================================
-- GreenFlame Business — Phase 1 Core Schema
-- Ordre : tables d'abord, fonction biz_is_member après,
--         puis politiques RLS — évite la dépendance circulaire
-- ============================================================

-- ── biz_accounts (sans politiques pour l'instant) ────────────────────────────
CREATE TABLE IF NOT EXISTS biz_accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         text NOT NULL,
  slug         text UNIQUE,
  country      text NOT NULL DEFAULT 'BJ',
  currency     text NOT NULL DEFAULT 'XOF',
  plan         text NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','starter','business','pro')),
  status       text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','cancelled')),
  merchant_ref uuid REFERENCES merchants(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ── biz_members (sans politiques pour l'instant) ─────────────────────────────
CREATE TABLE IF NOT EXISTS biz_members (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'staff' CHECK (role IN ('owner','manager','staff')),
  permissions  jsonb NOT NULL DEFAULT '{}',
  invited_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, user_id)
);

-- ── Helper biz_is_member (biz_members existe maintenant) ─────────────────────
CREATE OR REPLACE FUNCTION biz_is_member(p_business_id uuid)
RETURNS boolean
LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM biz_members
    WHERE business_id = p_business_id
      AND user_id     = auth.uid()
  )
$$;

-- ── RLS biz_accounts ─────────────────────────────────────────────────────────
ALTER TABLE biz_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_accounts_member ON biz_accounts
  USING (biz_is_member(id));
CREATE POLICY biz_accounts_owner_insert ON biz_accounts
  FOR INSERT WITH CHECK (owner_id = auth.uid());

-- ── RLS biz_members ──────────────────────────────────────────────────────────
ALTER TABLE biz_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_members_self ON biz_members
  USING (biz_is_member(business_id));
CREATE POLICY biz_members_owner_insert ON biz_members
  FOR INSERT WITH CHECK (biz_is_member(business_id));

-- ── biz_subscriptions ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_subscriptions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  plan          text NOT NULL,
  status        text NOT NULL DEFAULT 'trial' CHECK (status IN ('trial','active','expired','cancelled')),
  amount_fcfa   integer,
  trial_ends_at timestamptz,
  renews_at     timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biz_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_subscriptions_member ON biz_subscriptions
  USING (biz_is_member(business_id));

-- ── biz_categories ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  name         text NOT NULL,
  parent_id    uuid REFERENCES biz_categories(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biz_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_categories_member ON biz_categories
  USING (biz_is_member(business_id));
CREATE POLICY biz_categories_member_write ON biz_categories
  FOR INSERT WITH CHECK (biz_is_member(business_id));

-- ── biz_products ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_products (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  category_id  uuid REFERENCES biz_categories(id),
  name         text NOT NULL,
  sku          text,
  barcode      text,
  unit_price   numeric(12,2),
  buy_price    numeric(12,2),
  tax_rate     numeric(5,2) NOT NULL DEFAULT 0,
  unit         text NOT NULL DEFAULT 'pièce',
  is_service   boolean NOT NULL DEFAULT false,
  gf_listed    boolean NOT NULL DEFAULT false,
  active       boolean NOT NULL DEFAULT true,
  image_url    text,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, sku)
);

ALTER TABLE biz_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_products_member ON biz_products
  USING (biz_is_member(business_id));
CREATE POLICY biz_products_member_write ON biz_products
  FOR INSERT WITH CHECK (biz_is_member(business_id));
CREATE POLICY biz_products_member_update ON biz_products
  FOR UPDATE USING (biz_is_member(business_id));

CREATE INDEX IF NOT EXISTS biz_products_business_idx ON biz_products(business_id);
CREATE INDEX IF NOT EXISTS biz_products_barcode_idx  ON biz_products(barcode) WHERE barcode IS NOT NULL;

-- ── biz_inventory ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_inventory (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  product_id      uuid NOT NULL REFERENCES biz_products(id) ON DELETE CASCADE,
  quantity        numeric(12,3) NOT NULL DEFAULT 0,
  alert_threshold numeric(12,3) NOT NULL DEFAULT 5,
  cmup            numeric(12,2),
  location        text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_id, product_id)
);

ALTER TABLE biz_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_inventory_member ON biz_inventory
  USING (biz_is_member(business_id));
CREATE POLICY biz_inventory_member_write ON biz_inventory
  FOR INSERT WITH CHECK (biz_is_member(business_id));
CREATE POLICY biz_inventory_member_update ON biz_inventory
  FOR UPDATE USING (biz_is_member(business_id));

CREATE INDEX IF NOT EXISTS biz_inventory_business_idx  ON biz_inventory(business_id);
CREATE INDEX IF NOT EXISTS biz_inventory_low_stock_idx ON biz_inventory(business_id, quantity, alert_threshold);

-- ── biz_inventory_moves ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_inventory_moves (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  product_id   uuid NOT NULL REFERENCES biz_products(id),
  move_type    text NOT NULL CHECK (move_type IN ('in','out','adjust','transfer','initial')),
  quantity     numeric(12,3) NOT NULL,
  unit_cost    numeric(12,2),
  note         text,
  ref_type     text,
  ref_id       uuid,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biz_inventory_moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_inventory_moves_member ON biz_inventory_moves
  USING (biz_is_member(business_id));
CREATE POLICY biz_inventory_moves_member_insert ON biz_inventory_moves
  FOR INSERT WITH CHECK (biz_is_member(business_id));

CREATE INDEX IF NOT EXISTS biz_inv_moves_product_idx  ON biz_inventory_moves(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS biz_inv_moves_business_idx ON biz_inventory_moves(business_id, created_at DESC);

-- ── biz_customers ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_customers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id      uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  gf_user_id       uuid REFERENCES users(id),
  name             text NOT NULL,
  phone            text,
  email            text,
  address          text,
  city             text,
  credit_limit     numeric(12,2) NOT NULL DEFAULT 0,
  balance_due      numeric(12,2) NOT NULL DEFAULT 0,
  total_spent      numeric(12,2) NOT NULL DEFAULT 0,
  last_purchase_at timestamptz,
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biz_customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_customers_member ON biz_customers
  USING (biz_is_member(business_id));
CREATE POLICY biz_customers_member_write ON biz_customers
  FOR INSERT WITH CHECK (biz_is_member(business_id));
CREATE POLICY biz_customers_member_update ON biz_customers
  FOR UPDATE USING (biz_is_member(business_id));

CREATE INDEX IF NOT EXISTS biz_customers_business_idx ON biz_customers(business_id);
CREATE INDEX IF NOT EXISTS biz_customers_gf_user_idx  ON biz_customers(gf_user_id) WHERE gf_user_id IS NOT NULL;

-- ── biz_quotes ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_quotes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  customer_id  uuid REFERENCES biz_customers(id),
  number       text,
  status       text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','accepted','declined','expired')),
  items        jsonb NOT NULL DEFAULT '[]',
  subtotal     numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount   numeric(12,2) NOT NULL DEFAULT 0,
  total        numeric(12,2) NOT NULL DEFAULT 0,
  notes        text,
  valid_until  date,
  created_by   uuid REFERENCES users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biz_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_quotes_member ON biz_quotes
  USING (biz_is_member(business_id));
CREATE POLICY biz_quotes_member_write ON biz_quotes
  FOR INSERT WITH CHECK (biz_is_member(business_id));
CREATE POLICY biz_quotes_member_update ON biz_quotes
  FOR UPDATE USING (biz_is_member(business_id));

CREATE INDEX IF NOT EXISTS biz_quotes_business_idx ON biz_quotes(business_id, created_at DESC);

-- ── biz_invoices ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  customer_id       uuid REFERENCES biz_customers(id),
  quote_id          uuid REFERENCES biz_quotes(id),
  number            text,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','partial','paid','overdue','cancelled')),
  items             jsonb NOT NULL DEFAULT '[]',
  subtotal          numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount        numeric(12,2) NOT NULL DEFAULT 0,
  total             numeric(12,2) NOT NULL DEFAULT 0,
  paid_amount       numeric(12,2) NOT NULL DEFAULT 0,
  due_date          date,
  paid_at           timestamptz,
  notes             text,
  gf_transaction_id uuid REFERENCES transactions(id),
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biz_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_invoices_member ON biz_invoices
  USING (biz_is_member(business_id));
CREATE POLICY biz_invoices_member_write ON biz_invoices
  FOR INSERT WITH CHECK (biz_is_member(business_id));
CREATE POLICY biz_invoices_member_update ON biz_invoices
  FOR UPDATE USING (biz_is_member(business_id));

CREATE INDEX IF NOT EXISTS biz_invoices_business_idx ON biz_invoices(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS biz_invoices_status_idx   ON biz_invoices(business_id, status);

-- ── biz_invoice_payments ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_invoice_payments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  invoice_id   uuid NOT NULL REFERENCES biz_invoices(id) ON DELETE CASCADE,
  amount       numeric(12,2) NOT NULL,
  method       text NOT NULL DEFAULT 'cash' CHECK (method IN ('cash','momo','card','transfer','other')),
  momo_ref     text,
  note         text,
  paid_at      timestamptz NOT NULL DEFAULT now(),
  created_by   uuid REFERENCES users(id)
);

ALTER TABLE biz_invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_invoice_payments_member ON biz_invoice_payments
  USING (biz_is_member(business_id));
CREATE POLICY biz_invoice_payments_member_insert ON biz_invoice_payments
  FOR INSERT WITH CHECK (biz_is_member(business_id));

-- ── biz_pos_sessions ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_pos_sessions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id        uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  cashier_id         uuid REFERENCES users(id),
  opened_at          timestamptz NOT NULL DEFAULT now(),
  closed_at          timestamptz,
  opening_cash       numeric(12,2) NOT NULL DEFAULT 0,
  closing_cash       numeric(12,2),
  total_sales        numeric(12,2) NOT NULL DEFAULT 0,
  total_transactions integer NOT NULL DEFAULT 0,
  status             text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed'))
);

ALTER TABLE biz_pos_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_pos_sessions_member ON biz_pos_sessions
  USING (biz_is_member(business_id));
CREATE POLICY biz_pos_sessions_member_write ON biz_pos_sessions
  FOR INSERT WITH CHECK (biz_is_member(business_id));
CREATE POLICY biz_pos_sessions_member_update ON biz_pos_sessions
  FOR UPDATE USING (biz_is_member(business_id));

CREATE INDEX IF NOT EXISTS biz_pos_sessions_business_idx ON biz_pos_sessions(business_id, opened_at DESC);

-- ── biz_pos_transactions ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS biz_pos_transactions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  session_id            uuid REFERENCES biz_pos_sessions(id),
  cashier_id            uuid REFERENCES users(id),
  customer_id           uuid REFERENCES biz_customers(id),
  gf_user_id            uuid REFERENCES users(id),
  items                 jsonb NOT NULL DEFAULT '[]',
  subtotal              numeric(12,2) NOT NULL DEFAULT 0,
  tax_amount            numeric(12,2) NOT NULL DEFAULT 0,
  total                 numeric(12,2) NOT NULL DEFAULT 0,
  amount_tendered       numeric(12,2),
  change_given          numeric(12,2),
  payment_method        text NOT NULL DEFAULT 'cash' CHECK (payment_method IN ('cash','momo','card','split')),
  status                text NOT NULL DEFAULT 'completed' CHECK (status IN ('pending','completed','cancelled','refunded')),
  momo_ref              text,
  gf_cashback_triggered boolean NOT NULL DEFAULT false,
  gf_transaction_id     uuid REFERENCES transactions(id),
  receipt_number        text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biz_pos_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY biz_pos_transactions_member ON biz_pos_transactions
  USING (biz_is_member(business_id));
CREATE POLICY biz_pos_transactions_member_insert ON biz_pos_transactions
  FOR INSERT WITH CHECK (biz_is_member(business_id));

CREATE INDEX IF NOT EXISTS biz_pos_tx_business_idx ON biz_pos_transactions(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS biz_pos_tx_session_idx  ON biz_pos_transactions(session_id) WHERE session_id IS NOT NULL;

-- ── Vues analytiques Phase 1 ─────────────────────────────────────────────────

CREATE OR REPLACE VIEW biz_v_daily_sales AS
SELECT
  business_id,
  created_at::date AS sale_date,
  SUM(total)       AS total_sales,
  COUNT(*)         AS transaction_count
FROM biz_pos_transactions
WHERE created_at >= now() - interval '30 days'
GROUP BY business_id, created_at::date;

CREATE OR REPLACE VIEW biz_v_low_stock AS
SELECT
  i.business_id,
  p.id   AS product_id,
  p.name AS product_name,
  p.sku,
  i.quantity,
  i.alert_threshold,
  CASE WHEN i.quantity = 0 THEN 'rupture' ELSE 'alerte' END AS stock_status
FROM biz_inventory i
JOIN biz_products p ON p.id = i.product_id
WHERE i.quantity <= i.alert_threshold
  AND p.active = true
  AND p.is_service = false;

CREATE OR REPLACE VIEW biz_v_stock_value AS
SELECT
  i.business_id,
  SUM(i.quantity * COALESCE(i.cmup, p.buy_price, p.unit_price, 0)) AS total_value,
  COUNT(*) AS product_count
FROM biz_inventory i
JOIN biz_products p ON p.id = i.product_id
WHERE p.active = true
GROUP BY i.business_id;
