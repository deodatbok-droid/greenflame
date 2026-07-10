-- ================================================================
-- GREENFLAME — Migration 002 : Row Level Security
-- ================================================================

-- Activer RLS sur toutes les tables financières
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commission_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spillover_fund ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pgf_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.network_tree ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mobile_money_ops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.governance_audit ENABLE ROW LEVEL SECURITY;

-- ================================================================
-- Fonctions d'aide pour les policies (dans public, pas auth)
-- ================================================================

CREATE OR REPLACE FUNCTION public.user_role()
RETURNS TEXT[] AS $$
  SELECT role FROM public.users WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT 'admin' = ANY(role) FROM public.users WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_platform_upline()
RETURNS BOOLEAN AS $$
  SELECT 'platform_upline' = ANY(role) FROM public.users WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_merchant()
RETURNS BOOLEAN AS $$
  SELECT 'merchant' = ANY(role) FROM public.users WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.is_kingmaker()
RETURNS BOOLEAN AS $$
  SELECT 'kingmaker' = ANY(role) FROM public.users WHERE id = auth.uid()
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ================================================================
-- USERS — Policies
-- ================================================================

CREATE POLICY "users_select_own" ON public.users
  FOR SELECT USING (id = auth.uid());

CREATE POLICY "users_select_admin" ON public.users
  FOR SELECT USING (public.is_admin() OR public.is_platform_upline());

CREATE POLICY "users_select_recruits" ON public.users
  FOR SELECT USING (upline_id = auth.uid());

CREATE POLICY "users_update_own" ON public.users
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "users_insert_service" ON public.users
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- WALLETS — Policies
-- ================================================================

CREATE POLICY "wallets_select_own" ON public.wallets
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "wallets_select_admin" ON public.wallets
  FOR SELECT USING (public.is_admin() OR public.is_platform_upline());

CREATE POLICY "wallets_update_service" ON public.wallets
  FOR UPDATE USING (auth.role() = 'service_role');

CREATE POLICY "wallets_insert_service" ON public.wallets
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- WALLET LEDGER — Append-only (NO UPDATE, NO DELETE)
-- ================================================================

CREATE POLICY "wallet_ledger_select_own" ON public.wallet_ledger
  FOR SELECT USING (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
  );

CREATE POLICY "wallet_ledger_select_admin" ON public.wallet_ledger
  FOR SELECT USING (public.is_admin() OR public.is_platform_upline());

CREATE POLICY "wallet_ledger_insert_service" ON public.wallet_ledger
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- TRANSACTIONS — Policies
-- ================================================================

CREATE POLICY "transactions_select_buyer" ON public.transactions
  FOR SELECT USING (buyer_id = auth.uid());

CREATE POLICY "transactions_select_merchant" ON public.transactions
  FOR SELECT USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );

CREATE POLICY "transactions_select_admin" ON public.transactions
  FOR SELECT USING (public.is_admin() OR public.is_platform_upline());

CREATE POLICY "transactions_insert_service" ON public.transactions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "transactions_update_service" ON public.transactions
  FOR UPDATE USING (auth.role() = 'service_role');

-- ================================================================
-- COMMISSION DISTRIBUTIONS — Policies
-- ================================================================

CREATE POLICY "commission_dist_select_recipient" ON public.commission_distributions
  FOR SELECT USING (recipient_id = auth.uid());

CREATE POLICY "commission_dist_select_admin" ON public.commission_distributions
  FOR SELECT USING (public.is_admin() OR public.is_platform_upline());

CREATE POLICY "commission_dist_select_buyer_tx" ON public.commission_distributions
  FOR SELECT USING (
    transaction_id IN (SELECT id FROM public.transactions WHERE buyer_id = auth.uid())
  );

CREATE POLICY "commission_dist_insert_service" ON public.commission_distributions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- MERCHANTS — Policies
-- ================================================================

CREATE POLICY "merchants_select_own" ON public.merchants
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "merchants_select_active" ON public.merchants
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "merchants_all_admin" ON public.merchants
  FOR ALL USING (public.is_admin() OR public.is_platform_upline());

CREATE POLICY "merchants_insert_service" ON public.merchants
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "merchants_update_service" ON public.merchants
  FOR UPDATE USING (auth.role() = 'service_role');

-- ================================================================
-- NETWORK TREE — Policies
-- ================================================================

CREATE POLICY "network_tree_select_own" ON public.network_tree
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "network_tree_select_recruits" ON public.network_tree
  FOR SELECT USING (
    l1_upline = auth.uid() OR
    l2_upline = auth.uid() OR
    l3_upline = auth.uid() OR
    l4_upline = auth.uid() OR
    l5_upline = auth.uid()
  );

CREATE POLICY "network_tree_select_admin" ON public.network_tree
  FOR SELECT USING (public.is_admin() OR public.is_platform_upline());

CREATE POLICY "network_tree_insert_service" ON public.network_tree
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "network_tree_update_service" ON public.network_tree
  FOR UPDATE USING (auth.role() = 'service_role');

-- ================================================================
-- SPILLOVER FUND — Admin only
-- ================================================================

CREATE POLICY "spillover_select_admin" ON public.spillover_fund
  FOR SELECT USING (public.is_admin() OR public.is_platform_upline());

CREATE POLICY "spillover_insert_service" ON public.spillover_fund
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- GOVERNANCE AUDIT — Admin only
-- ================================================================

CREATE POLICY "governance_audit_select_admin" ON public.governance_audit
  FOR SELECT USING (public.is_admin() OR public.is_platform_upline());

CREATE POLICY "governance_audit_insert_service" ON public.governance_audit
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- MOBILE MONEY OPS — Policies
-- ================================================================

CREATE POLICY "momo_ops_select_own" ON public.mobile_money_ops
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "momo_ops_select_admin" ON public.mobile_money_ops
  FOR SELECT USING (public.is_admin() OR public.is_platform_upline());

CREATE POLICY "momo_ops_insert_service" ON public.mobile_money_ops
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "momo_ops_update_service" ON public.mobile_money_ops
  FOR UPDATE USING (auth.role() = 'service_role');

-- ================================================================
-- PGF LEDGER — Policies
-- ================================================================

CREATE POLICY "pgf_ledger_select_own" ON public.pgf_ledger
  FOR SELECT USING (
    wallet_id IN (SELECT id FROM public.wallets WHERE user_id = auth.uid())
  );

CREATE POLICY "pgf_ledger_select_admin" ON public.pgf_ledger
  FOR SELECT USING (public.is_admin() OR public.is_platform_upline());

CREATE POLICY "pgf_ledger_insert_service" ON public.pgf_ledger
  FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ================================================================
-- MERCHANT CATEGORIES — Public (lecture seule pour tous)
-- ================================================================

ALTER TABLE public.merchant_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories_select_all" ON public.merchant_categories
  FOR SELECT USING (TRUE);

CREATE POLICY "categories_modify_admin" ON public.merchant_categories
  FOR ALL USING (public.is_admin() OR public.is_platform_upline());
