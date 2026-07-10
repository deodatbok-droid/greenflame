-- ================================================================
-- GREENFLAME — Migration 001 : Schéma initial
-- ================================================================

-- Extension pour générer des UUIDs
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ================================================================
-- USERS (extension de auth.users de Supabase)
-- ================================================================
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone VARCHAR(20) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  role TEXT[] DEFAULT ARRAY['consumer'],
  upline_id UUID REFERENCES public.users(id),
  referral_code VARCHAR(20) UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  kyc_level INTEGER DEFAULT 0 CHECK (kyc_level BETWEEN 0 AND 3),
  country_code VARCHAR(5) DEFAULT 'BJ',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_roles CHECK (
    role <@ ARRAY['consumer','merchant','kingmaker','kingmaker_stockiste','admin','platform_upline']::text[]
  )
);

-- ================================================================
-- WALLETS
-- ================================================================
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  balance_fcfa BIGINT DEFAULT 0 CHECK (balance_fcfa >= 0),
  balance_pgf BIGINT DEFAULT 0 CHECK (balance_pgf >= 0),
  locked_balance BIGINT DEFAULT 0 CHECK (locked_balance >= 0),
  total_earned_fcfa BIGINT DEFAULT 0,
  total_spent_fcfa BIGINT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- MERCHANT CATEGORIES
-- ================================================================
CREATE TABLE public.merchant_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name_fr VARCHAR(255) NOT NULL,
  commission_rate DECIMAL(5,4) NOT NULL,
  min_ticket_fcfa BIGINT DEFAULT 0,
  max_ticket_fcfa BIGINT,
  notes TEXT
);

-- ================================================================
-- MERCHANTS
-- ================================================================
CREATE TABLE public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  business_name VARCHAR(255) NOT NULL,
  business_category VARCHAR(100) NOT NULL,
  commission_rate DECIMAL(5,4) NOT NULL DEFAULT 0.10,
  address_text TEXT,
  latitude DECIMAL(10,7),
  longitude DECIMAL(10,7),
  qr_code_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  onboarded_by UUID REFERENCES public.users(id),
  total_gmv BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- TRANSACTIONS
-- ================================================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id),
  buyer_id UUID NOT NULL REFERENCES public.users(id),
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa > 0),
  commission_total BIGINT NOT NULL CHECK (commission_total >= 0),
  commission_rate DECIMAL(5,4) NOT NULL,
  status VARCHAR(30) DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','refunded')),
  payment_method VARCHAR(50)
    CHECK (payment_method IN ('mtn_momo','moov_money','celtiis','wallet_gf','cash_confirmed')),
  payment_reference VARCHAR(255),
  idempotency_key VARCHAR(255) UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- ================================================================
-- COMMISSION DISTRIBUTIONS
-- ================================================================
CREATE TABLE public.commission_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id),
  recipient_id UUID REFERENCES public.users(id),
  level INTEGER NOT NULL CHECK (level BETWEEN 0 AND 7),
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa >= 0),
  percentage DECIMAL(5,4) NOT NULL,
  distribution_type VARCHAR(30) NOT NULL
    CHECK (distribution_type IN ('platform','cashback','network','spillover')),
  is_pgf BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- SPILLOVER FUND
-- ================================================================
CREATE TABLE public.spillover_fund (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES public.transactions(id),
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa > 0),
  reason VARCHAR(100)
    CHECK (reason IN ('orphan_level','inactive_kingmaker','chain_too_short','rounding')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- WALLET LEDGER (immuable — append-only)
-- ================================================================
CREATE TABLE public.wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id),
  amount BIGINT NOT NULL,
  currency_type VARCHAR(10) NOT NULL CHECK (currency_type IN ('fcfa','pgf')),
  transaction_type VARCHAR(50) NOT NULL CHECK (
    transaction_type IN (
      'cashback','commission_network','platform_fee',
      'mobile_money_deposit','mobile_money_withdrawal',
      'purchase_payment','pgf_conversion','spillover','refund'
    )
  ),
  reference_id UUID,
  balance_after BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
-- Note: l'immuabilité est garantie par RLS (pas d'UPDATE/DELETE autorisé)

-- ================================================================
-- PGF LEDGER
-- ================================================================
CREATE TABLE public.pgf_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id),
  amount BIGINT NOT NULL,
  operation_type VARCHAR(50) NOT NULL
    CHECK (operation_type IN ('earn','spend','transfer','expire','convert_to_cash')),
  reference_id UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- NETWORK TREE (dénormalisé pour performances)
-- ================================================================
CREATE TABLE public.network_tree (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  l1_upline UUID REFERENCES public.users(id),
  l2_upline UUID REFERENCES public.users(id),
  l3_upline UUID REFERENCES public.users(id),
  l4_upline UUID REFERENCES public.users(id),
  l5_upline UUID REFERENCES public.users(id),
  depth INTEGER DEFAULT 0,
  tree_path UUID[],
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- MOBILE MONEY OPERATIONS
-- ================================================================
CREATE TABLE public.mobile_money_ops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id),
  operator VARCHAR(20) NOT NULL
    CHECK (operator IN ('mtn_momo','moov_money','celtiis')),
  operation_type VARCHAR(20) NOT NULL
    CHECK (operation_type IN ('cash_in','cash_out')),
  amount_fcfa BIGINT NOT NULL CHECK (amount_fcfa > 0),
  phone_number VARCHAR(20) NOT NULL,
  external_reference VARCHAR(255),
  status VARCHAR(20) DEFAULT 'pending'
    CHECK (status IN ('pending','success','failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- GOVERNANCE AUDIT (log des tentatives de modification des constantes)
-- ================================================================
CREATE TABLE public.governance_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempted_by UUID REFERENCES public.users(id),
  field_attempted VARCHAR(255) NOT NULL,
  current_value TEXT,
  attempted_value TEXT,
  was_blocked BOOLEAN DEFAULT TRUE,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================================
-- INDEXES pour performances
-- ================================================================
CREATE INDEX idx_transactions_merchant ON public.transactions(merchant_id);
CREATE INDEX idx_transactions_buyer ON public.transactions(buyer_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_created ON public.transactions(created_at DESC);
CREATE INDEX idx_commission_distributions_tx ON public.commission_distributions(transaction_id);
CREATE INDEX idx_commission_distributions_recipient ON public.commission_distributions(recipient_id);
CREATE INDEX idx_wallet_ledger_wallet ON public.wallet_ledger(wallet_id);
CREATE INDEX idx_wallet_ledger_created ON public.wallet_ledger(created_at DESC);
CREATE INDEX idx_network_tree_l1 ON public.network_tree(l1_upline);
CREATE INDEX idx_users_upline ON public.users(upline_id);
CREATE INDEX idx_users_referral_code ON public.users(referral_code);
CREATE UNIQUE INDEX idx_transactions_idempotency ON public.transactions(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- ================================================================
-- TRIGGER : mise à jour automatique du wallet updated_at
-- ================================================================
CREATE OR REPLACE FUNCTION update_wallet_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wallet_updated_at_trigger
  BEFORE UPDATE ON public.wallets
  FOR EACH ROW EXECUTE FUNCTION update_wallet_updated_at();

-- ================================================================
-- TRIGGER : mise à jour last_active_at lors d'une transaction
-- ================================================================
CREATE OR REPLACE FUNCTION update_user_last_active()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE public.users SET last_active_at = NOW()
    WHERE id = NEW.buyer_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_completed_update_active
  AFTER UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION update_user_last_active();

-- ================================================================
-- TRIGGER : construction automatique du network_tree à l'enrôlement
-- ================================================================
CREATE OR REPLACE FUNCTION build_network_tree()
RETURNS TRIGGER AS $$
DECLARE
  upline_tree public.network_tree%ROWTYPE;
BEGIN
  IF NEW.upline_id IS NULL THEN
    INSERT INTO public.network_tree (user_id, depth, tree_path)
    VALUES (NEW.id, 0, ARRAY[NEW.id])
    ON CONFLICT (user_id) DO UPDATE SET
      l1_upline = NULL, l2_upline = NULL, l3_upline = NULL,
      l4_upline = NULL, l5_upline = NULL, depth = 0,
      tree_path = ARRAY[NEW.id], updated_at = NOW();
  ELSE
    SELECT * INTO upline_tree FROM public.network_tree WHERE user_id = NEW.upline_id;
    INSERT INTO public.network_tree (
      user_id, l1_upline, l2_upline, l3_upline, l4_upline, l5_upline,
      depth, tree_path
    ) VALUES (
      NEW.id,
      NEW.upline_id,
      upline_tree.l1_upline,
      upline_tree.l2_upline,
      upline_tree.l3_upline,
      upline_tree.l4_upline,
      COALESCE(upline_tree.depth, 0) + 1,
      ARRAY[NEW.id] || COALESCE(upline_tree.tree_path, ARRAY[]::UUID[])
    )
    ON CONFLICT (user_id) DO UPDATE SET
      l1_upline = NEW.upline_id,
      l2_upline = upline_tree.l1_upline,
      l3_upline = upline_tree.l2_upline,
      l4_upline = upline_tree.l3_upline,
      l5_upline = upline_tree.l4_upline,
      depth = COALESCE(upline_tree.depth, 0) + 1,
      tree_path = ARRAY[NEW.id] || COALESCE(upline_tree.tree_path, ARRAY[]::UUID[]),
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_enrolled_build_tree
  AFTER INSERT OR UPDATE OF upline_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION build_network_tree();
