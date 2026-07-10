-- Migration 043 : Corriger les balance_gfp et wallet_ledger
--
-- Bug corrigé : le code stockait alloc.amountFcfa directement dans balance_gfp
-- (ex: 7 stocké au lieu de split "7 FCFA + 5 GFP" pour un cashback de 7,5 FCFA).
--
-- Règle métier :
--   1 FCFA = 10 GFP
--   cashback 7,5 FCFA → balance_fcfa += 7  ET  balance_gfp += 5
--
-- Les données incorrectes ont été stockées comme si le montant FCFA = montant GFP.
-- On convertit : les GFP mal stockés sont en réalité des FCFA entiers.
-- → balance_fcfa += floor(balance_gfp * 0.1)  (récupère les FCFA)
-- → balance_gfp   = balance_gfp % 10           (garde uniquement le sous-FCFA)
-- Note : la fraction FCFA perdue par le floor original est irrécupérable.

UPDATE public.wallets
SET
  balance_fcfa = balance_fcfa + FLOOR(balance_gfp * 0.1),
  balance_gfp  = balance_gfp % 10
WHERE balance_gfp >= 10;

-- Corriger les entrées wallet_ledger en GFP qui étaient en réalité des FCFA
UPDATE public.wallet_ledger
SET currency_type = 'fcfa'
WHERE currency_type = 'gfp' AND amount >= 10;
