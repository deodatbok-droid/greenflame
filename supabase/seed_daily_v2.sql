-- Seed daily v2 — montants réalistes Bénin, garantissant ≥1 FCFA à L5
--
-- Montants par boutique :
--   Épicerie Fatimata (7%) : 500–2 500 FCFA  → commission 35–175 FCFA
--   Station Koffi     (3%) : 1 000–6 000 FCFA → commission 30–180 FCFA (fuel 1–8L ou crédit)
--   Boutique Awa     (10%) : 400–3 000 FCFA  → commission 40–300 FCFA
--
-- Garanties floor() :
--   L5 (4%) ≥ 1 FCFA si commission ≥ 25 FCFA → tous les minimum ci-dessus OK
--   Station min 1 000 FCFA × 3% = 30 FCFA → L5 : floor(30×0.04) = 1 FCFA ✓
--
-- Fréquence : Épicerie 60%/jour · Station 50%/jour · Boutique 25%/jour
-- (tout le monde mange, achète de l'eau et du carburant chaque jour)

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

  CREATE TEMP TABLE _dp2 (
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

  -- ── Épicerie Fatimata (60% / jour) ──────────────────────────────────
  -- Alimentation journalière : repas + eau + condiments
  -- Montant : 500 à 2 500 FCFA (famille ou individu, marché ou resto)
  INSERT INTO _dp2(buyer,mch,cr,amt,ts,ikey,l1,l2,l3,l4,l5)
  SELECT nt.user_id, v_ep, 0.07,
    500  + floor(random()*2000)::bigint,          -- [500, 2 500]
    v_start + (d||' days')::interval + ((random()*14+6)||' hours')::interval,
    'dlv-ep-'||nt.user_id||'-'||d,
    nt.l1_upline,nt.l2_upline,nt.l3_upline,nt.l4_upline,nt.l5_upline
  FROM network_tree nt CROSS JOIN generate_series(0,29) d
  WHERE (nt.l1_upline=v_aurel OR nt.l2_upline=v_aurel OR nt.l3_upline=v_aurel
      OR nt.l4_upline=v_aurel OR nt.l5_upline=v_aurel)
    AND random() < 0.60;

  -- ── Station Koffi (50% / jour) ──────────────────────────────────────
  -- Carburant moto : 1–3L = 700–2 100 FCFA
  -- Carburant voiture : 5–8L = 3 500–5 600 FCFA
  -- Crédit téléphonique : 300–2 000 FCFA
  -- Montant global : 1 000 à 6 000 FCFA
  INSERT INTO _dp2(buyer,mch,cr,amt,ts,ikey,l1,l2,l3,l4,l5)
  SELECT nt.user_id, v_st, 0.03,
    1000 + floor(random()*5000)::bigint,          -- [1 000, 6 000]
    v_start + (d||' days')::interval + ((random()*14+6)||' hours')::interval,
    'dlv-st-'||nt.user_id||'-'||d,
    nt.l1_upline,nt.l2_upline,nt.l3_upline,nt.l4_upline,nt.l5_upline
  FROM network_tree nt CROSS JOIN generate_series(0,29) d
  WHERE (nt.l1_upline=v_aurel OR nt.l2_upline=v_aurel OR nt.l3_upline=v_aurel
      OR nt.l4_upline=v_aurel OR nt.l5_upline=v_aurel)
    AND random() < 0.50;

  -- ── Boutique Awa (25% / jour) ────────────────────────────────────────
  -- Savon, shampoing, médicaments, produits bébé
  -- Montant : 400 à 3 000 FCFA
  INSERT INTO _dp2(buyer,mch,cr,amt,ts,ikey,l1,l2,l3,l4,l5)
  SELECT nt.user_id, v_bq, 0.10,
    400  + floor(random()*2600)::bigint,          -- [400, 3 000]
    v_start + (d||' days')::interval + ((random()*14+6)||' hours')::interval,
    'dlv-bq-'||nt.user_id||'-'||d,
    nt.l1_upline,nt.l2_upline,nt.l3_upline,nt.l4_upline,nt.l5_upline
  FROM network_tree nt CROSS JOIN generate_series(0,29) d
  WHERE (nt.l1_upline=v_aurel OR nt.l2_upline=v_aurel OR nt.l3_upline=v_aurel
      OR nt.l4_upline=v_aurel OR nt.l5_upline=v_aurel)
    AND random() < 0.25;

  UPDATE _dp2 SET comm = floor(amt * cr);

  v_tx_count := (SELECT count(*) FROM _dp2);
  RAISE NOTICE 'Transactions planifiees : %', v_tx_count;

  -- ── Transactions ─────────────────────────────────────────────────────
  INSERT INTO transactions
    (id,merchant_id,buyer_id,amount_fcfa,commission_total,commission_rate,
     status,payment_method,idempotency_key,created_at,completed_at)
  SELECT tx_id,mch,buyer,amt,comm,cr,'completed','cash_confirmed',ikey,ts,ts+interval'3s'
  FROM _dp2 ON CONFLICT(idempotency_key) DO NOTHING;

  -- ── Distributions ────────────────────────────────────────────────────
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,NULL,0,floor(d.comm*0.45),0.45,'platform',false,d.ts
  FROM _dp2 d JOIN transactions t ON t.id=d.tx_id;

  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.buyer,6,floor(d.comm*0.12),0.12,'cashback',(floor(d.comm*0.12)<50),d.ts
  FROM _dp2 d JOIN transactions t ON t.id=d.tx_id;

  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l1,1,floor(d.comm*0.12),0.12,'network',false,d.ts FROM _dp2 d JOIN transactions t ON t.id=d.tx_id WHERE d.l1 IS NOT NULL;
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l2,2,floor(d.comm*0.10),0.10,'network',false,d.ts FROM _dp2 d JOIN transactions t ON t.id=d.tx_id WHERE d.l2 IS NOT NULL;
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l3,3,floor(d.comm*0.08),0.08,'network',false,d.ts FROM _dp2 d JOIN transactions t ON t.id=d.tx_id WHERE d.l3 IS NOT NULL;
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l4,4,floor(d.comm*0.06),0.06,'network',false,d.ts FROM _dp2 d JOIN transactions t ON t.id=d.tx_id WHERE d.l4 IS NOT NULL;
  INSERT INTO commission_distributions(transaction_id,recipient_id,level,amount_fcfa,percentage,distribution_type,is_pgf,created_at)
  SELECT d.tx_id,d.l5,5,floor(d.comm*0.04),0.04,'network',false,d.ts FROM _dp2 d JOIN transactions t ON t.id=d.tx_id WHERE d.l5 IS NOT NULL;

  RAISE NOTICE 'Distributions inserees.';

  -- ── Wallets FCFA ─────────────────────────────────────────────────────
  WITH earn AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd JOIN _dp2 d ON d.tx_id=cd.transaction_id
    WHERE cd.distribution_type IN ('network','cashback') AND cd.is_pgf=false AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  UPDATE wallets w
  SET balance_fcfa=w.balance_fcfa+e.total, total_earned_fcfa=w.total_earned_fcfa+e.total, updated_at=NOW()
  FROM earn e WHERE w.user_id=e.recipient_id;

  -- ── Wallets PGF ──────────────────────────────────────────────────────
  WITH pgf AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd JOIN _dp2 d ON d.tx_id=cd.transaction_id
    WHERE cd.distribution_type='cashback' AND cd.is_pgf=true AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  UPDATE wallets w SET balance_pgf=w.balance_pgf+p.total, updated_at=NOW()
  FROM pgf p WHERE w.user_id=p.recipient_id;

  -- ── GMV marchands ────────────────────────────────────────────────────
  UPDATE merchants m SET total_gmv=m.total_gmv+sub.gmv
  FROM (SELECT mch, SUM(amt) AS gmv FROM _dp2 GROUP BY mch) sub
  WHERE m.id=sub.mch;

  -- ── Wallet ledger (synthèse mensuelle par utilisateur) ───────────────
  WITH net AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd JOIN _dp2 d ON d.tx_id=cd.transaction_id
    WHERE cd.distribution_type='network' AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  INSERT INTO wallet_ledger(wallet_id,amount,currency_type,transaction_type,balance_after,created_at)
  SELECT w.id,n.total,'fcfa','commission_network',w.balance_fcfa,NOW()-interval'1s'
  FROM net n JOIN wallets w ON w.user_id=n.recipient_id WHERE n.total>0;

  WITH pgfl AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd JOIN _dp2 d ON d.tx_id=cd.transaction_id
    WHERE cd.distribution_type='cashback' AND cd.is_pgf=true AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  INSERT INTO wallet_ledger(wallet_id,amount,currency_type,transaction_type,balance_after,created_at)
  SELECT w.id,p.total,'pgf','cashback',w.balance_pgf,NOW()-interval'1s'
  FROM pgfl p JOIN wallets w ON w.user_id=p.recipient_id WHERE p.total>0;

  RAISE NOTICE 'TERMINE — solde Aurel: % FCFA | PGF: % | dividendes reseau: % FCFA | GMV total: %',
    (SELECT balance_fcfa FROM wallets WHERE user_id=v_aurel),
    (SELECT balance_pgf  FROM wallets WHERE user_id=v_aurel),
    (SELECT SUM(amount_fcfa) FROM commission_distributions WHERE recipient_id=v_aurel AND distribution_type='network'),
    (SELECT SUM(total_gmv) FROM merchants);
END $$;
