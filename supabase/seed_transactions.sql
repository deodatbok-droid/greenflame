-- ============================================================
-- GreenFlame — Seed transactions pour les 363 membres réseau
-- Chaque membre fait 1 achat de 5 000 FCFA à 10% de commission
-- Distribue les commissions correctement sur 5 niveaux
-- ============================================================

DO $$
DECLARE
  v_aurel_id   UUID;
  v_merchant_id UUID;

  -- Montants fixes (5 000 FCFA, commission 10%)
  v_amount     BIGINT := 5000;
  v_commission BIGINT := 500;   -- floor(5000 * 0.10)
  v_platform   BIGINT := 225;   -- floor(500 * 0.45)
  v_cashback   BIGINT := 60;    -- floor(500 * 0.12)  ≥ 50 → FCFA
  v_l_amts     BIGINT[] := ARRAY[60, 50, 40, 30, 20]; -- L1..L5
  v_l_pcts     DECIMAL[] := ARRAY[0.12, 0.10, 0.08, 0.06, 0.04];

  v_member     RECORD;
  v_tree       RECORD;
  v_tx_id      UUID;
  v_created_at TIMESTAMPTZ;

  -- Upline loop
  v_uplines    UUID[];
  v_upline_id  UUID;
  v_up_amt     BIGINT;
  v_up_pct     DECIMAL;
  v_lvl        INT;
  i            INT;

  -- Wallet helpers
  v_w_id       UUID;
  v_bal        BIGINT;
  v_new_bal    BIGINT;
BEGIN

  -- ── 1. Trouver Aurel ─────────────────────────────────────────
  SELECT id INTO v_aurel_id FROM users WHERE phone = '+22997025083';
  IF v_aurel_id IS NULL THEN
    RAISE EXCEPTION 'Aurel introuvable — vérifier le numéro de téléphone';
  END IF;
  RAISE NOTICE 'Aurel ID : %', v_aurel_id;

  -- ── 2. Marchand actif ────────────────────────────────────────
  SELECT id INTO v_merchant_id FROM merchants WHERE is_active = true ORDER BY created_at LIMIT 1;
  IF v_merchant_id IS NULL THEN
    RAISE EXCEPTION 'Aucun marchand actif trouvé';
  END IF;
  RAISE NOTICE 'Marchand : %', v_merchant_id;

  -- ── 3. Boucle sur tous les membres du réseau d'Aurel ─────────
  FOR v_member IN
    SELECT DISTINCT nt.user_id
    FROM network_tree nt
    WHERE nt.l1_upline = v_aurel_id
       OR nt.l2_upline = v_aurel_id
       OR nt.l3_upline = v_aurel_id
       OR nt.l4_upline = v_aurel_id
       OR nt.l5_upline = v_aurel_id
    ORDER BY nt.user_id
  LOOP

    -- Horodatage aléatoire dans les 29 derniers jours
    v_created_at := NOW() - (random() * interval '29 days');
    v_tx_id      := gen_random_uuid();

    -- Chaîne d'uplines du membre
    SELECT l1_upline, l2_upline, l3_upline, l4_upline, l5_upline
    INTO v_tree
    FROM network_tree
    WHERE user_id = v_member.user_id;

    -- ── Transaction ─────────────────────────────────────────────
    INSERT INTO transactions (
      id, merchant_id, buyer_id, amount_fcfa,
      commission_total, commission_rate, status,
      payment_method, idempotency_key, created_at, completed_at
    ) VALUES (
      v_tx_id, v_merchant_id, v_member.user_id, v_amount,
      v_commission, 0.10, 'completed',
      'cash_confirmed', 'seed-' || v_tx_id::text,
      v_created_at, v_created_at + interval '2 seconds'
    );

    -- ── Distribution plateforme ─────────────────────────────────
    INSERT INTO commission_distributions (
      transaction_id, recipient_id, level, amount_fcfa,
      percentage, distribution_type, is_pgf, created_at
    ) VALUES (
      v_tx_id, NULL, 0, v_platform, 0.45, 'platform', false, v_created_at
    );

    -- ── Cashback acheteur ────────────────────────────────────────
    INSERT INTO commission_distributions (
      transaction_id, recipient_id, level, amount_fcfa,
      percentage, distribution_type, is_pgf, created_at
    ) VALUES (
      v_tx_id, v_member.user_id, 6, v_cashback, 0.12, 'cashback', false, v_created_at
    );

    -- Wallet acheteur
    SELECT id, balance_fcfa INTO v_w_id, v_bal
    FROM wallets WHERE user_id = v_member.user_id;

    IF v_w_id IS NOT NULL THEN
      v_new_bal := v_bal + v_cashback;
      UPDATE wallets
        SET balance_fcfa = v_new_bal,
            total_earned_fcfa = total_earned_fcfa + v_cashback,
            updated_at = v_created_at
      WHERE id = v_w_id;
      INSERT INTO wallet_ledger (
        wallet_id, amount, currency_type, transaction_type,
        reference_id, balance_after, created_at
      ) VALUES (
        v_w_id, v_cashback, 'fcfa', 'cashback',
        v_tx_id, v_new_bal, v_created_at
      );
    END IF;

    -- ── Commissions réseau L1-L5 ─────────────────────────────────
    v_uplines := ARRAY[
      v_tree.l1_upline, v_tree.l2_upline, v_tree.l3_upline,
      v_tree.l4_upline, v_tree.l5_upline
    ];

    FOR i IN 1..5 LOOP
      v_upline_id := v_uplines[i];
      v_up_amt    := v_l_amts[i];
      v_up_pct    := v_l_pcts[i];
      v_lvl       := i;

      IF v_upline_id IS NOT NULL THEN
        -- Distribution record
        INSERT INTO commission_distributions (
          transaction_id, recipient_id, level, amount_fcfa,
          percentage, distribution_type, is_pgf, created_at
        ) VALUES (
          v_tx_id, v_upline_id, v_lvl, v_up_amt,
          v_up_pct, 'network', false, v_created_at
        );

        -- Wallet upline
        SELECT id, balance_fcfa INTO v_w_id, v_bal
        FROM wallets WHERE user_id = v_upline_id;

        IF v_w_id IS NOT NULL THEN
          v_new_bal := v_bal + v_up_amt;
          UPDATE wallets
            SET balance_fcfa = v_new_bal,
                total_earned_fcfa = total_earned_fcfa + v_up_amt,
                updated_at = v_created_at
          WHERE id = v_w_id;
          INSERT INTO wallet_ledger (
            wallet_id, amount, currency_type, transaction_type,
            reference_id, balance_after, created_at
          ) VALUES (
            v_w_id, v_up_amt, 'fcfa', 'commission_network',
            v_tx_id, v_new_bal, v_created_at
          );
        END IF;
      END IF;

    END LOOP;

    -- GMV marchand
    UPDATE merchants
    SET total_gmv = total_gmv + v_amount
    WHERE id = v_merchant_id;

  END LOOP;

  RAISE NOTICE 'Seed terminé. Vérification :';

  -- Résumé dividendes réseau d'Aurel
  RAISE NOTICE 'Dividendes réseau Aurel : % FCFA',
    (SELECT COALESCE(SUM(amount_fcfa),0)
     FROM commission_distributions
     WHERE recipient_id = v_aurel_id
       AND distribution_type = 'network');

  RAISE NOTICE 'Solde wallet Aurel : % FCFA',
    (SELECT balance_fcfa FROM wallets WHERE user_id = v_aurel_id);

END $$;
