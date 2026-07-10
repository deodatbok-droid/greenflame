SELECT
  w.balance_fcfa,
  w.balance_pgf,
  (SELECT SUM(cd.amount_fcfa) FROM commission_distributions cd WHERE cd.recipient_id=u.id AND cd.distribution_type='network') AS div_reseau,
  (SELECT COUNT(*) FROM transactions) AS total_tx,
  (SELECT SUM(t.amount_fcfa) FROM transactions t) AS gmv_total
FROM wallets w JOIN users u ON u.id=w.user_id WHERE u.phone='+22997025083';
