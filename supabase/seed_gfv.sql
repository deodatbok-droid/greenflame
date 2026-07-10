-- Seed GFV : 365 personnes × 5 000 FCFA/jour × 30 jours = 54 750 000 FCFA GMV
-- Répartition quotidienne par personne :
--   ALIMENTATION 2 500 FCFA × 7%  = 175 FCFA commission
--   TRANSPORT    1 500 FCFA × 3%  =  45 FCFA commission
--   BEAUTE       1 000 FCFA × 10% = 100 FCFA commission
-- Total commission/jour/personne ≈ 320 FCFA
-- Règles GreenFlame appliquées :
--   45% plateforme · 12% cashback · 3% pool récompenses · L1=12% L2=10% L3=8% L4=6% L5=4%

DO $$
DECLARE
  v_aurel UUID;
  v_ep UUID; v_st UUID; v_bq UUID;
  v_start TIMESTAMPTZ := NOW() - INTERVAL '30 days';
  v_tx_count BIGINT;
BEGIN
  SELECT id INTO v_aurel FROM users WHERE phone = '+22997025083';
  SELECT id INTO v_ep FROM merchants WHERE business_category = 'ALIMENTATION'    LIMIT 1;
  SELECT id INTO v_st FROM merchants WHERE business_category = 'TRANSPORT_SMALL' LIMIT 1;
  SELECT id INTO v_bq FROM merchants WHERE business_category = 'BEAUTE'          LIMIT 1;

  IF v_ep IS NULL OR v_st IS NULL OR v_bq IS NULL THEN
    RAISE EXCEPTION 'Marchands introuvables';
  END IF;

  CREATE TEMP TABLE _gfv (
    tx_id UUID    DEFAULT gen_random_uuid(),
    buyer UUID    NOT NULL,
    mch   UUID    NOT NULL,
    cr    DECIMAL NOT NULL,
    amt   BIGINT  NOT NULL,
    comm  BIGINT  DEFAULT 0,
    ts    TIMESTAMPTZ NOT NULL,
    ikey  TEXT    NOT NULL,
    l1 UUID, l2 UUID, l3 UUID, l4 UUID, l5 UUID
  ) ON COMMIT DROP;

  -- ALIMENTATION : 2 500 FCFA/jour · tous les utilisateurs actifs
  INSERT INTO _gfv(buyer,mch,cr,amt,ts,ikey,l1,l2,l3,l4,l5)
  SELECT u.id, v_ep, 0.07, 2500,
    v_start + (d||' days')::interval + ((random()*14+6)||' hours')::interval,
    'gfv-ep-'||u.id||'-'||d,
    nt.l1_upline, nt.l2_upline, nt.l3_upline, nt.l4_upline, nt.l5_upline
  FROM users u
  LEFT JOIN network_tree nt ON nt.user_id = u.id
  CROSS JOIN generate_series(0,29) d
  WHERE u.is_active = true;

  -- TRANSPORT : 1 500 FCFA/jour · tous les utilisateurs actifs
  INSERT INTO _gfv(buyer,mch,cr,amt,ts,ikey,l1,l2,l3,l4,l5)
  SELECT u.id, v_st, 0.03, 1500,
    v_start + (d||' days')::interval + ((random()*14+6)||' hours')::interval,
    'gfv-st-'||u.id||'-'||d,
    nt.l1_upline, nt.l2_upline, nt.l3_upline, nt.l4_upline, nt.l5_upline
  FROM users u
  LEFT JOIN network_tree nt ON nt.user_id = u.id
  CROSS JOIN generate_series(0,29) d
  WHERE u.is_active = true;

  -- BEAUTE : 1 000 FCFA/jour · tous les utilisateurs actifs
  INSERT INTO _gfv(buyer,mch,cr,amt,ts,ikey,l1,l2,l3,l4,l5)
  SELECT u.id, v_bq, 0.10, 1000,
    v_start + (d||' days')::interval + ((random()*14+6)||' hours')::interval,
    'gfv-bq-'||u.id||'-'||d,
    nt.l1_upline, nt.l2_upline, nt.l3_upline, nt.l4_upline, nt.l5_upline
  FROM users u
  LEFT JOIN network_tree nt ON nt.user_id = u.id
  CROSS JOIN generate_series(0,29) d
  WHERE u.is_active = true;

  UPDATE _gfv SET comm = floor(amt * cr);

  v_tx_count := (SELECT count(*) FROM _gfv);
  RAISE NOTICE 'Transactions a inserer : %', v_tx_count;

  -- Transactions
  INSERT INTO transactions
    (id,merchant_id,buyer_id,amount_fcfa,commission_total,commission_rate,status,payment_method,idempotency_key,created_at,completed_at)
  SELECT tx_id,mch,buyer,amt,comm,cr,'completed','cash_confirmed',ikey,ts,ts+interval'3s'
  FROM _gfv ON CONFLICT(idempotency_key) DO NOTHING;

  -- Platform (45%)
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,NULL,0,floor(d.comm*0.45),0.45,'platform',false,d.ts
  FROM _gfv d JOIN transactions t ON t.id=d.tx_id;

  -- Cashback acheteur (15%) — PGF si < 50 FCFA
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.buyer,6,floor(d.comm*0.12),0.12,'cashback',(floor(d.comm*0.12)<50),d.ts
  FROM _gfv d JOIN transactions t ON t.id=d.tx_id;

  -- Réseau L1-L5 (12%-10%-8%-6%-4%)
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l1,1,floor(d.comm*0.12),0.12,'network',false,d.ts FROM _gfv d JOIN transactions t ON t.id=d.tx_id WHERE d.l1 IS NOT NULL;
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l2,2,floor(d.comm*0.10),0.10,'network',false,d.ts FROM _gfv d JOIN transactions t ON t.id=d.tx_id WHERE d.l2 IS NOT NULL;
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l3,3,floor(d.comm*0.08),0.08,'network',false,d.ts FROM _gfv d JOIN transactions t ON t.id=d.tx_id WHERE d.l3 IS NOT NULL;
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l4,4,floor(d.comm*0.06),0.06,'network',false,d.ts FROM _gfv d JOIN transactions t ON t.id=d.tx_id WHERE d.l4 IS NOT NULL;
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l5,5,floor(d.comm*0.04),0.04,'network',false,d.ts FROM _gfv d JOIN transactions t ON t.id=d.tx_id WHERE d.l5 IS NOT NULL;

  -- Wallets FCFA (réseau + cashback FCFA)
  WITH earn AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd JOIN _gfv d ON d.tx_id=cd.transaction_id
    WHERE cd.distribution_type IN ('network','cashback') AND cd.is_pgf=false AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  UPDATE wallets w SET balance_fcfa=w.balance_fcfa+e.total, total_earned_fcfa=w.total_earned_fcfa+e.total, updated_at=NOW()
  FROM earn e WHERE w.user_id=e.recipient_id;

  -- Wallets PGF (cashback < 50 FCFA)
  WITH pgf AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd JOIN _gfv d ON d.tx_id=cd.transaction_id
    WHERE cd.distribution_type='cashback' AND cd.is_pgf=true AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  UPDATE wallets w SET balance_pgf=w.balance_pgf+p.total, updated_at=NOW()
  FROM pgf p WHERE w.user_id=p.recipient_id;

  -- GMV marchands
  UPDATE merchants m SET total_gmv=m.total_gmv+sub.gmv
  FROM (SELECT mch, SUM(amt) AS gmv FROM _gfv GROUP BY mch) sub
  WHERE m.id=sub.mch;

  -- Ledger (entrée synthèse par utilisateur)
  WITH net AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd JOIN _gfv d ON d.tx_id=cd.transaction_id
    WHERE cd.distribution_type='network' AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  INSERT INTO wallet_ledger(wallet_id,amount,currency_type,transaction_type,balance_after,created_at)
  SELECT w.id,n.total,'fcfa','commission_network',w.balance_fcfa,NOW()-interval'1s'
  FROM net n JOIN wallets w ON w.user_id=n.recipient_id WHERE n.total>0;

  WITH pgfl AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd JOIN _gfv d ON d.tx_id=cd.transaction_id
    WHERE cd.distribution_type='cashback' AND cd.is_pgf=true AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  INSERT INTO wallet_ledger(wallet_id,amount,currency_type,transaction_type,balance_after,created_at)
  SELECT w.id,p.total,'pgf','cashback',w.balance_pgf,NOW()-interval'1s'
  FROM pgfl p JOIN wallets w ON w.user_id=p.recipient_id WHERE p.total>0;

  RAISE NOTICE 'TERMINE — Solde Aurel: % FCFA | PGF: % | Dividendes réseau: % FCFA | GMV total: %',
    (SELECT balance_fcfa FROM wallets WHERE user_id=v_aurel),
    (SELECT balance_pgf  FROM wallets WHERE user_id=v_aurel),
    (SELECT SUM(amount_fcfa) FROM commission_distributions WHERE recipient_id=v_aurel AND distribution_type='network'),
    (SELECT SUM(total_gmv) FROM merchants);
END $$;
