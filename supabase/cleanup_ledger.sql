DELETE FROM wallet_ledger
WHERE wallet_id = (SELECT id FROM wallets WHERE user_id = (SELECT id FROM users WHERE phone = '+22997025083'))
  AND transaction_type = 'commission_network'
  AND amount = 5048;