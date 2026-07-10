-- Simule 30 jours d'achats quotidiens pour les 363 membres du reseau
-- Epicerie 50%/jour · Station 30%/jour · Boutique Awa 20%/jour

DO $$
DECLARE
  v_aurel UUID;
  v_ep    UUID; v_st UUID; v_bq UUID;
  v_ep_cr DECIMAL := 0.07;
  v_st_cr DECIMAL := 0.03;
  v_bq_cr DECIMAL := 0.10;
  v_start TIMESTAMPTZ := NOW() - INTERVAL '30 days';

  -- Prix des produits par boutique (arrays paralleles)
  ep_prices BIGINT[] := ARRAY[500,150,75,150,250];
  ep_names  TEXT[]   := ARRAY['Repas du jour','Pain et beignets','Eau potable','Boisson fraiche','Condiments'];
  st_prices BIGINT[] := ARRAY[700,300,200];
  st_names  TEXT[]   := ARRAY['Carburant essence','Credit telephone','Course taxi-moto'];
  bq_prices BIGINT[] := ARRAY[350,500];
  bq_names  TEXT[]   := ARRAY['Savon et hygiene','Medicaments'];

  v_tx_count BIGINT;
BEGIN
  SELECT id INTO v_aurel FROM users WHERE phone = '+22997025083';
  SELECT id INTO v_ep FROM merchants WHERE business_category = 'ALIMENTATION'    LIMIT 1;
  SELECT id INTO v_st FROM merchants WHERE business_category = 'TRANSPORT_SMALL' LIMIT 1;
  SELECT id INTO v_bq FROM merchants WHERE business_category = 'BEAUTE'          LIMIT 1;

  -- Table de travail
  CREATE TEMP TABLE _dp (
    tx_id   UUID    DEFAULT gen_random_uuid(),
    buyer   UUID    NOT NULL,
    mch     UUID    NOT NULL,
    cr      DECIMAL NOT NULL,
    amt     BIGINT  NOT NULL,
    comm    BIGINT  NOT NULL,
    pname   TEXT,
    ts      TIMESTAMPTZ NOT NULL,
    ikey    TEXT    NOT NULL,
    l1 UUID, l2 UUID, l3 UUID, l4 UUID, l5 UUID
  ) ON COMMIT DROP;

  -- Epicerie : 50% par jour
  INSERT INTO _dp (buyer,mch,cr,amt,comm,pname,ts,ikey,l1,l2,l3,l4,l5)
  SELECT
    nt.user_id, v_ep, v_ep_cr,
    GREATEST(50, ep_prices[1+(random()*4)::int] + (random()*200-100)::bigint),
    0,
    ep_names[1+(random()*4)::int],
    v_start + (d||' days')::interval + ((random()*14+6)||' hours')::interval,
    'dly-ep-'||nt.user_id||'-'||d,
    nt.l1_upline,nt.l2_upline,nt.l3_upline,nt.l4_upline,nt.l5_upline
  FROM network_tree nt
  CROSS JOIN generate_series(0,29) d
  WHERE (nt.l1_upline=v_aurel OR nt.l2_upline=v_aurel OR nt.l3_upline=v_aurel
      OR nt.l4_upline=v_aurel OR nt.l5_upline=v_aurel)
    AND random() < 0.5;

  -- Station Koffi : 30% par jour
  INSERT INTO _dp (buyer,mch,cr,amt,comm,pname,ts,ikey,l1,l2,l3,l4,l5)
  SELECT
    nt.user_id, v_st, v_st_cr,
    GREATEST(100, st_prices[1+(random()*2)::int] + (random()*400-200)::bigint),
    0,
    st_names[1+(random()*2)::int],
    v_start + (d||' days')::interval + ((random()*14+6)||' hours')::interval,
    'dly-st-'||nt.user_id||'-'||d,
    nt.l1_upline,nt.l2_upline,nt.l3_upline,nt.l4_upline,nt.l5_upline
  FROM network_tree nt
  CROSS JOIN generate_series(0,29) d
  WHERE (nt.l1_upline=v_aurel OR nt.l2_upline=v_aurel OR nt.l3_upline=v_aurel
      OR nt.l4_upline=v_aurel OR nt.l5_upline=v_aurel)
    AND random() < 0.3;

  -- Boutique Awa : 20% par jour
  INSERT INTO _dp (buyer,mch,cr,amt,comm,pname,ts,ikey,l1,l2,l3,l4,l5)
  SELECT
    nt.user_id, v_bq, v_bq_cr,
    GREATEST(200, bq_prices[1+(random()*1)::int] + (random()*300-150)::bigint),
    0,
    bq_names[1+(random()*1)::int],
    v_start + (d||' days')::interval + ((random()*14+6)||' hours')::interval,
    'dly-bq-'||nt.user_id||'-'||d,
    nt.l1_upline,nt.l2_upline,nt.l3_upline,nt.l4_upline,nt.l5_upline
  FROM network_tree nt
  CROSS JOIN generate_series(0,29) d
  WHERE (nt.l1_upline=v_aurel OR nt.l2_upline=v_aurel OR nt.l3_upline=v_aurel
      OR nt.l4_upline=v_aurel OR nt.l5_upline=v_aurel)
    AND random() < 0.2;

  -- Calcul commissions
  UPDATE _dp SET comm = floor(amt * cr);

  v_tx_count := (SELECT count(*) FROM _dp);
  RAISE NOTICE 'Plan : % transactions a inserer', v_tx_count;

  -- Transactions
  INSERT INTO transactions
    (id,merchant_id,buyer_id,amount_fcfa,commission_total,commission_rate,status,payment_method,idempotency_key,metadata,created_at,completed_at)
  SELECT tx_id,mch,buyer,amt,comm,cr,'completed','cash_confirmed',ikey,
         jsonb_build_object('product',pname,'source','daily_seed'),ts,ts+interval'3s'
  FROM _dp ON CONFLICT(idempotency_key) DO NOTHING;

  -- Distributions : plateforme (level 0)
  INSERT INTO commission_distributions
    (transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,NULL,0,floor(d.comm*0.45),0.45,'platform',false,d.ts
  FROM _dp d JOIN transactions t ON t.id=d.tx_id;

  -- Cashback acheteur (level 6)
  INSERT INTO commission_distributions
    (transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.buyer,6,floor(d.comm*0.12),0.12,'cashback',(floor(d.comm*0.12)<50),d.ts
  FROM _dp d JOIN transactions t ON t.id=d.tx_id;

  -- Reseau L1..L5
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l1,1,floor(d.comm*0.12),0.12,'network',false,d.ts FROM _dp d JOIN transactions t ON t.id=d.tx_id WHERE d.l1 IS NOT NULL;
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l2,2,floor(d.comm*0.10),0.10,'network',false,d.ts FROM _dp d JOIN transactions t ON t.id=d.tx_id WHERE d.l2 IS NOT NULL;
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l3,3,floor(d.comm*0.08),0.08,'network',false,d.ts FROM _dp d JOIN transactions t ON t.id=d.tx_id WHERE d.l3 IS NOT NULL;
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l4,4,floor(d.comm*0.06),0.06,'network',false,d.ts FROM _dp d JOIN transactions t ON t.id=d.tx_id WHERE d.l4 IS NOT NULL;
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l5,5,floor(d.comm*0.04),0.04,'network',false,d.ts FROM _dp d JOIN transactions t ON t.id=d.tx_id WHERE d.l5 IS NOT NULL;

  RAISE NOTICE 'Distributions inserees.';

  -- Wallets FCFA (commissions reseau + cashback FCFA)
  WITH earn AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd
    JOIN _dp d ON d.tx_id=cd.transaction_id
    WHERE cd.distribution_type IN ('network','cashback') AND cd.is_pgf=false AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  UPDATE wallets w
  SET balance_fcfa=w.balance_fcfa+e.total, total_earned_fcfa=w.total_earned_fcfa+e.total, updated_at=NOW()
  FROM earn e WHERE w.user_id=e.recipient_id;

  -- Wallets PGF (cashback < 50 FCFA)
  WITH pgf AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd
    JOIN _dp d ON d.tx_id=cd.transaction_id
    WHERE cd.distribution_type='cashback' AND cd.is_pgf=true AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  UPDATE wallets w
  SET balance_pgf=w.balance_pgf+p.total, updated_at=NOW()
  FROM pgf p WHERE w.user_id=p.recipient_id;

  -- GMV marchands
  UPDATE merchants m SET total_gmv=m.total_gmv+sub.gmv
  FROM (SELECT mch, SUM(amt) AS gmv FROM _dp GROUP BY mch) sub
  WHERE m.id=sub.mch;

  -- Wallet ledger : 1 entree de synthese mensuelle par utilisateur
  WITH net AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd JOIN _dp d ON d.tx_id=cd.transaction_id
    WHERE cd.distribution_type='network' AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  INSERT INTO wallet_ledger(wallet_id,amount,currency_type,transaction_type,balance_after,created_at)
  SELECT w.id, n.total,'fcfa','commission_network',w.balance_fcfa,NOW()-interval'1s'
  FROM net n JOIN wallets w ON w.user_id=n.recipient_id WHERE n.total>0;

  WITH pgfl AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd JOIN _dp d ON d.tx_id=cd.transaction_id
    WHERE cd.distribution_type='cashback' AND cd.is_pgf=true AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  INSERT INTO wallet_ledger(wallet_id,amount,currency_type,transaction_type,balance_after,created_at)
  SELECT w.id, p.total,'pgf','cashback',w.balance_pgf,NOW()-interval'1s'
  FROM pgfl p JOIN wallets w ON w.user_id=p.recipient_id WHERE p.total>0;

  RAISE NOTICE 'TERMINE — solde Aurel: % FCFA | PGF: % | dividendes reseau total: % FCFA',
    (SELECT balance_fcfa FROM wallets WHERE user_id=v_aurel),
    (SELECT balance_pgf  FROM wallets WHERE user_id=v_aurel),
    (SELECT SUM(amount_fcfa) FROM commission_distributions WHERE recipient_id=v_aurel AND distribution_type='network');
END $$;
