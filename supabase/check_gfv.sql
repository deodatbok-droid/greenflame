SELECT
  (SELECT COUNT(*) FROM transactions WHERE idempotency_key LIKE 'gfv-%') AS tx_count,
  (SELECT SUM(amount_fcfa) FROM transactions WHERE idempotency_key LIKE 'gfv-%') AS gmv,
  (SELECT balance_fcfa FROM wallets WHERE user_id=(SELECT id FROM users WHERE phone='+22997025083')) AS aurel_fcfa,
  (SELECT balance_pgf FROM wallets WHERE user_id=(SELECT id FROM users WHERE phone='+22997025083')) AS aurel_pgf,
  (SELECT SUM(amount_fcfa) FROM commission_distributions WHERE recipient_id=(SELECT id FROM users WHERE phone='+22997025083') AND distribution_type='network') AS aurel_network_div,
  (SELECT SUM(amount_fcfa) FROM commission_distributions WHERE recipient_id=(SELECT id FROM users WHERE phone='+22997025083') AND distribution_type='cashback') AS aurel_cashback;