-- Chantier 5 (Immobilier) — Déclaration de deal, split commission, règlement wallet.
-- Forfait plateforme fixe (2000 FCFA/deal) prélevé sur le wallet du démarcheur déclarant,
-- puis commission_amount_fcfa réparti selon les pourcentages déclarés dans biz_property_deal_splits.

CREATE TABLE IF NOT EXISTS biz_property_deals (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  biz_property_id         uuid NOT NULL REFERENCES biz_properties(id) ON DELETE CASCADE,
  commission_amount_fcfa  integer NOT NULL CHECK (commission_amount_fcfa > 0),
  gf_fee_fcfa             integer NOT NULL DEFAULT 2000 CHECK (gf_fee_fcfa >= 0),
  status                  text NOT NULL DEFAULT 'declared' CHECK (status IN ('declared', 'settled')),
  notes                   text,
  created_by              uuid REFERENCES users(id),
  created_at              timestamptz NOT NULL DEFAULT now(),
  settled_at              timestamptz
);

CREATE TABLE IF NOT EXISTS biz_property_deal_splits (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id      uuid NOT NULL REFERENCES biz_property_deals(id) ON DELETE CASCADE,
  business_id  uuid NOT NULL REFERENCES biz_accounts(id) ON DELETE CASCADE,
  role         text NOT NULL DEFAULT 'autre' CHECK (role IN ('lister', 'closer', 'autre')),
  percentage   numeric(5,2) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE biz_property_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE biz_property_deal_splits ENABLE ROW LEVEL SECURITY;

-- biz_property_deals : le démarcheur déclarant gère le deal ; tout démarcheur cité
-- dans un split peut le consulter (transparence sur sa part).
CREATE POLICY biz_property_deals_all ON biz_property_deals
  FOR ALL USING (biz_is_member(business_id));
CREATE POLICY biz_property_deals_insert ON biz_property_deals
  FOR INSERT WITH CHECK (biz_is_member(business_id));
CREATE POLICY biz_property_deals_update ON biz_property_deals
  FOR UPDATE USING (biz_is_member(business_id));
CREATE POLICY biz_property_deals_delete ON biz_property_deals
  FOR DELETE USING (biz_is_member(business_id));
CREATE POLICY biz_property_deals_select_participant ON biz_property_deals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM biz_property_deal_splits s
      WHERE s.deal_id = biz_property_deals.id AND biz_is_member(s.business_id)
    )
  );

-- biz_property_deal_splits : lecture par le déclarant et par le bénéficiaire concerné ;
-- écriture réservée au déclarant du deal parent.
CREATE POLICY biz_property_deal_splits_select_declarant ON biz_property_deal_splits
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM biz_property_deals d WHERE d.id = deal_id AND biz_is_member(d.business_id))
  );
CREATE POLICY biz_property_deal_splits_select_own ON biz_property_deal_splits
  FOR SELECT USING (biz_is_member(business_id));
CREATE POLICY biz_property_deal_splits_insert ON biz_property_deal_splits
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM biz_property_deals d WHERE d.id = deal_id AND biz_is_member(d.business_id))
  );
CREATE POLICY biz_property_deal_splits_update ON biz_property_deal_splits
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM biz_property_deals d WHERE d.id = deal_id AND biz_is_member(d.business_id))
  );
CREATE POLICY biz_property_deal_splits_delete ON biz_property_deal_splits
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM biz_property_deals d WHERE d.id = deal_id AND biz_is_member(d.business_id))
  );

CREATE INDEX IF NOT EXISTS biz_property_deals_business_idx  ON biz_property_deals(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS biz_property_deals_property_idx  ON biz_property_deals(biz_property_id);
CREATE INDEX IF NOT EXISTS biz_property_deal_splits_deal_idx ON biz_property_deal_splits(deal_id);
CREATE INDEX IF NOT EXISTS biz_property_deal_splits_biz_idx  ON biz_property_deal_splits(business_id);

-- Nouveaux types de transaction dédiés au règlement des deals immobiliers
-- (mêmes conventions que 'merchant_withdrawal'/'sale_revenue' : un type par nature de flux).
ALTER TABLE merchant_wallet_ledger DROP CONSTRAINT IF EXISTS merchant_wallet_ledger_transaction_type_check;
ALTER TABLE merchant_wallet_ledger ADD CONSTRAINT merchant_wallet_ledger_transaction_type_check CHECK (
  transaction_type IN (
    'sale_revenue',
    'agent_deposit_out',
    'agent_withdrawal_in',
    'merchant_withdrawal',
    'admin_adjustment',
    'property_deal_fee',
    'property_deal_commission'
  )
);

-- settle_property_deal — verrou de statut atomique, prélève le forfait plateforme sur le
-- wallet du déclarant puis crédite chaque bénéficiaire au prorata de son pourcentage.
CREATE OR REPLACE FUNCTION settle_property_deal(p_deal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deal                  biz_property_deals%ROWTYPE;
  v_declarant_merchant_id uuid;
  v_declarant_wallet_id   uuid;
  v_declarant_balance     integer;
  v_total_percentage      numeric;
  v_split                 record;
  v_split_merchant_id     uuid;
  v_split_amount          integer;
BEGIN
  UPDATE biz_property_deals
  SET status = 'settled', settled_at = now()
  WHERE id = p_deal_id AND status = 'declared'
  RETURNING * INTO v_deal;

  IF v_deal.id IS NULL THEN
    RAISE EXCEPTION 'Deal introuvable ou déjà réglé';
  END IF;

  SELECT COALESCE(SUM(percentage), 0) INTO v_total_percentage
  FROM biz_property_deal_splits WHERE deal_id = p_deal_id;

  IF v_total_percentage != 100 THEN
    RAISE EXCEPTION 'La répartition doit totaliser 100%% (actuel : %)', v_total_percentage;
  END IF;

  SELECT m.id INTO v_declarant_merchant_id
  FROM biz_accounts a JOIN merchants m ON m.user_id = a.owner_id
  WHERE a.id = v_deal.business_id;

  IF v_declarant_merchant_id IS NULL THEN
    RAISE EXCEPTION 'Compte marchand introuvable pour le démarcheur déclarant';
  END IF;

  SELECT id, balance_fcfa INTO v_declarant_wallet_id, v_declarant_balance
  FROM merchant_wallets WHERE merchant_id = v_declarant_merchant_id
  FOR UPDATE;

  IF v_declarant_wallet_id IS NULL THEN
    RAISE EXCEPTION 'Wallet introuvable pour le démarcheur déclarant';
  END IF;

  IF v_declarant_balance < v_deal.gf_fee_fcfa THEN
    RAISE EXCEPTION 'Solde insuffisant pour le forfait plateforme (% FCFA disponibles)', v_declarant_balance;
  END IF;

  UPDATE merchant_wallets
  SET balance_fcfa = balance_fcfa - v_deal.gf_fee_fcfa, updated_at = now()
  WHERE id = v_declarant_wallet_id;

  INSERT INTO merchant_wallet_ledger (merchant_wallet_id, amount, transaction_type, reference_id, balance_after, notes)
  VALUES (v_declarant_wallet_id, -v_deal.gf_fee_fcfa, 'property_deal_fee', v_deal.id, v_declarant_balance - v_deal.gf_fee_fcfa, 'Forfait plateforme — deal immobilier');

  FOR v_split IN SELECT * FROM biz_property_deal_splits WHERE deal_id = p_deal_id LOOP
    SELECT m.id INTO v_split_merchant_id
    FROM biz_accounts a JOIN merchants m ON m.user_id = a.owner_id
    WHERE a.id = v_split.business_id;

    IF v_split_merchant_id IS NULL THEN
      RAISE EXCEPTION 'Compte marchand introuvable pour un des bénéficiaires du split';
    END IF;

    v_split_amount := ROUND(v_deal.commission_amount_fcfa * v_split.percentage / 100);

    PERFORM merchant_wallet_credit(
      v_split_merchant_id,
      v_split_amount,
      'property_deal_commission',
      v_deal.id,
      'Commission deal immobilier (' || v_split.role || ')'
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION settle_property_deal(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION settle_property_deal(uuid) TO service_role;
