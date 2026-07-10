DO $$
DECLARE v_aurel UUID;
BEGIN
  SELECT id INTO v_aurel FROM users WHERE phone = '+22997025083';

  WITH earn AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd JOIN transactions t ON t.id = cd.transaction_id
    WHERE t.idempotency_key LIKE 'dlv-%'
      AND cd.distribution_type IN ('network','cashback') AND cd.is_pgf = false AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  UPDATE wallets w SET balance_fcfa=w.balance_fcfa-e.total, total_earned_fcfa=w.total_earned_fcfa-e.total, updated_at=NOW()
  FROM earn e WHERE w.user_id=e.recipient_id;

  WITH pgf AS (
    SELECT cd.recipient_id, SUM(cd.amount_fcfa) AS total
    FROM commission_distributions cd JOIN transactions t ON t.id = cd.transaction_id
    WHERE t.idempotency_key LIKE 'dlv-%' AND cd.distribution_type='cashback' AND cd.is_pgf=true AND cd.recipient_id IS NOT NULL
    GROUP BY cd.recipient_id
  )
  UPDATE wallets w SET balance_pgf=w.balance_pgf-p.total, updated_at=NOW()
  FROM pgf p WHERE w.user_id=p.recipient_id;

  UPDATE merchants m SET total_gmv=m.total_gmv-sub.gmv
  FROM (SELECT merchant_id, SUM(amount_fcfa) AS gmv FROM transactions WHERE idempotency_key LIKE 'dlv-%' GROUP BY merchant_id) sub
  WHERE m.id=sub.merchant_id;

  DELETE FROM commission_distributions WHERE transaction_id IN (SELECT id FROM transactions WHERE idempotency_key LIKE 'dlv-%');
  DELETE FROM transactions WHERE idempotency_key LIKE 'dlv-%';

  RAISE NOTICE 'Rollback dlv- OK. Solde Aurel: % FCFA', (SELECT balance_fcfa FROM wallets WHERE user_id=v_aurel);
END $$;