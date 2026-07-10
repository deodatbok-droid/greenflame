-- ============================================================
-- GreenFlame — Full 5-Level Network Simulation
-- Creates L3 (27), L4 (81), L5 (243) = 351 new users
-- Each existing L2 buyer gets 3 direct recruits (L3)
-- Each L3 gets 3 recruits (L4), each L4 gets 3 recruits (L5)
-- ============================================================

DO $$
DECLARE
  v_l2_ids   UUID[];
  v_l3_ids   UUID[];
  v_l4_ids   UUID[];
  v_l2_id    UUID;
  v_l3_id    UUID;
  v_l4_id    UUID;
  v_new_id   UUID;
  v_phone    TEXT;
  v_counter  INT := 0;
  v_l3_idx   INT := 0;
  v_l4_idx   INT := 0;
  i           INT;
  j           INT;
  k           INT;
  v_ref_code TEXT;
  v_merchant_id UUID;
BEGIN

  -- ─── Get the 9 existing L2 buyers ─────────────────────────────────
  SELECT ARRAY(
    SELECT u.id
    FROM users u
    JOIN network_tree nt ON nt.user_id = u.id
    WHERE nt.l1_upline IS NOT NULL
      AND nt.l2_upline IS NOT NULL
      AND nt.l3_upline IS NULL
    ORDER BY u.created_at
    LIMIT 9
  ) INTO v_l2_ids;

  IF array_length(v_l2_ids, 1) IS NULL THEN
    RAISE NOTICE 'No L2 users found. Run the base seed first.';
    RETURN;
  END IF;

  RAISE NOTICE 'Found % L2 users, expanding to L3/L4/L5...', array_length(v_l2_ids, 1);

  -- ─── Pick a merchant for test transactions ─────────────────────────
  SELECT id INTO v_merchant_id FROM merchants WHERE is_active = true LIMIT 1;

  -- ─── Create L3 users (27 total: 3 per L2 user) ───────────────────
  v_l3_ids := '{}';

  FOR i IN 1..array_length(v_l2_ids, 1) LOOP
    v_l2_id := v_l2_ids[i];

    FOR j IN 1..3 LOOP
      v_counter := v_counter + 1;
      v_new_id  := gen_random_uuid();
      v_phone   := '+22970' || lpad(v_counter::text, 5, '0');
      v_ref_code := 'GF-' || upper(substring(v_new_id::text, 1, 8));

      -- Auth user (minimal)
      INSERT INTO auth.users (
        id, instance_id, aud, role, phone, phone_confirmed_at,
        encrypted_password, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, confirmation_token, recovery_token,
        email_change_token_new, email_change, phone_change
      ) VALUES (
        v_new_id, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        v_phone, NOW() - (random() * interval '60 days'),
        '', NOW() - (random() * interval '60 days'), NOW(),
        '{"provider":"phone","providers":["phone"]}', '{}',
        false, '', '', '', '', ''
      ) ON CONFLICT (id) DO NOTHING;

      -- Public user
      INSERT INTO users (id, phone, full_name, referral_code, upline_id, role, created_at)
      VALUES (
        v_new_id, v_phone,
        'L3 Member ' || v_counter,
        v_ref_code, v_l2_id, 'user',
        NOW() - (random() * interval '55 days')
      ) ON CONFLICT (id) DO NOTHING;

      -- Wallet
      INSERT INTO wallets (user_id, balance_fcfa, balance_pgf, total_earned_fcfa, total_cashback_fcfa)
      VALUES (v_new_id, 0, 0, 0, 0)
      ON CONFLICT (user_id) DO NOTHING;

      v_l3_ids := v_l3_ids || v_new_id;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Created % L3 users', array_length(v_l3_ids, 1);

  -- ─── Create L4 users (81 total: 3 per L3 user) ───────────────────
  v_l4_ids := '{}';

  FOR i IN 1..array_length(v_l3_ids, 1) LOOP
    v_l3_id := v_l3_ids[i];

    FOR j IN 1..3 LOOP
      v_counter := v_counter + 1;
      v_new_id  := gen_random_uuid();
      v_phone   := '+22971' || lpad(v_counter::text, 5, '0');
      v_ref_code := 'GF-' || upper(substring(v_new_id::text, 1, 8));

      INSERT INTO auth.users (
        id, instance_id, aud, role, phone, phone_confirmed_at,
        encrypted_password, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, confirmation_token, recovery_token,
        email_change_token_new, email_change, phone_change
      ) VALUES (
        v_new_id, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        v_phone, NOW() - (random() * interval '45 days'),
        '', NOW() - (random() * interval '45 days'), NOW(),
        '{"provider":"phone","providers":["phone"]}', '{}',
        false, '', '', '', '', ''
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO users (id, phone, full_name, referral_code, upline_id, role, created_at)
      VALUES (
        v_new_id, v_phone,
        'L4 Member ' || v_counter,
        v_ref_code, v_l3_id, 'user',
        NOW() - (random() * interval '40 days')
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO wallets (user_id, balance_fcfa, balance_pgf, total_earned_fcfa, total_cashback_fcfa)
      VALUES (v_new_id, 0, 0, 0, 0)
      ON CONFLICT (user_id) DO NOTHING;

      v_l4_ids := v_l4_ids || v_new_id;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Created % L4 users', array_length(v_l4_ids, 1);

  -- ─── Create L5 users (243 total: 3 per L4 user) ──────────────────
  FOR i IN 1..array_length(v_l4_ids, 1) LOOP
    v_l4_id := v_l4_ids[i];

    FOR j IN 1..3 LOOP
      v_counter := v_counter + 1;
      v_new_id  := gen_random_uuid();
      v_phone   := '+22972' || lpad(v_counter::text, 5, '0');
      v_ref_code := 'GF-' || upper(substring(v_new_id::text, 1, 8));

      INSERT INTO auth.users (
        id, instance_id, aud, role, phone, phone_confirmed_at,
        encrypted_password, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, confirmation_token, recovery_token,
        email_change_token_new, email_change, phone_change
      ) VALUES (
        v_new_id, '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated',
        v_phone, NOW() - (random() * interval '30 days'),
        '', NOW() - (random() * interval '30 days'), NOW(),
        '{"provider":"phone","providers":["phone"]}', '{}',
        false, '', '', '', '', ''
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO users (id, phone, full_name, referral_code, upline_id, role, created_at)
      VALUES (
        v_new_id, v_phone,
        'L5 Member ' || v_counter,
        v_ref_code, v_l4_id, 'user',
        NOW() - (random() * interval '25 days')
      ) ON CONFLICT (id) DO NOTHING;

      INSERT INTO wallets (user_id, balance_fcfa, balance_pgf, total_earned_fcfa, total_cashback_fcfa)
      VALUES (v_new_id, 0, 0, 0, 0)
      ON CONFLICT (user_id) DO NOTHING;

    END LOOP;
  END LOOP;

  RAISE NOTICE 'Created L5 users. Total new users: %', v_counter;
  RAISE NOTICE 'Done! Run a network_tree count to verify.';

END $$;

-- ─── Verification query ───────────────────────────────────────────────
-- After running this script, query Aurel's network counts with:
-- (Replace 'YOUR_USER_ID' with Aurel's actual user id)
--
-- SELECT
--   COUNT(*) FILTER (WHERE l1_upline = 'YOUR_USER_ID') AS l1,
--   COUNT(*) FILTER (WHERE l2_upline = 'YOUR_USER_ID') AS l2,
--   COUNT(*) FILTER (WHERE l3_upline = 'YOUR_USER_ID') AS l3,
--   COUNT(*) FILTER (WHERE l4_upline = 'YOUR_USER_ID') AS l4,
--   COUNT(*) FILTER (WHERE l5_upline = 'YOUR_USER_ID') AS l5
-- FROM network_tree;
