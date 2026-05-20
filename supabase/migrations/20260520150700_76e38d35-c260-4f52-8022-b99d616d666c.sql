-- =============================================================================
-- DEMO SEED — CogniRaja jury presentation
-- Idempotent: deletes the player's prior demo sessions before reseeding.
-- =============================================================================

DO $seed$
DECLARE
  v_reda_id    uuid;
  v_taha_id    uuid;
  v_ismail_id  uuid;
  v_coach_id   uuid;
  v_admin_id   uuid;
  v_now        timestamptz := now();
  v_reviewed   timestamptz := now() - interval '10 weeks';

  -- Per-player weekly target arrays: [sgs, tr, inhib, wm, flex, vvp] x 10 sessions
  v_reda   numeric[][] := ARRAY[
    ARRAY[54,58,68,44,50,55], ARRAY[57,61,70,47,53,57], ARRAY[60,63,72,50,55,60],
    ARRAY[58,60,71,48,52,58], ARRAY[62,64,73,53,57,61], ARRAY[65,67,75,56,60,64],
    ARRAY[68,69,77,59,63,66], ARRAY[70,71,78,62,65,68], ARRAY[73,73,80,65,68,71],
    ARRAY[76,75,82,68,71,74]
  ];
  v_taha   numeric[][] := ARRAY[
    ARRAY[46,48,47,45,46,48], ARRAY[50,51,51,49,50,51], ARRAY[54,55,54,53,54,55],
    ARRAY[51,52,52,50,51,52], ARRAY[56,57,57,55,56,57], ARRAY[61,62,61,60,61,62],
    ARRAY[65,65,65,64,65,65], ARRAY[68,68,68,67,68,68], ARRAY[72,71,72,71,72,71],
    ARRAY[76,74,75,75,76,74]
  ];
  v_ismail numeric[][] := ARRAY[
    ARRAY[58,62,59,55,40,74], ARRAY[60,63,61,57,43,76], ARRAY[63,65,63,59,46,78],
    ARRAY[61,63,62,57,44,77], ARRAY[65,67,65,61,49,79], ARRAY[68,69,67,64,53,81],
    ARRAY[71,71,70,67,57,83], ARRAY[73,73,72,69,61,84], ARRAY[76,75,74,71,65,86],
    ARRAY[79,77,76,73,69,88]
  ];

  v_player_id  uuid;
  v_targets    numeric[][];
  i            int;
  v_weeks_back int;
  v_session_date timestamptz;
  v_group_id   uuid;
  v_sid_simon  uuid;
  v_sid_nback  uuid;
  v_sid_tmt    uuid;
  v_sgs        numeric;
  v_tr         numeric;
  v_inhib      numeric;
  v_wm         numeric;
  v_flex       numeric;
  v_vvp        numeric;
  v_avg_rt     numeric;
  v_simon_eff  numeric;
  v_inc_er     numeric;
  v_dprime     numeric;
  v_ratio_ba   numeric;
  v_time_a     numeric;
  v_time_b     numeric;

  -- Exercise catalog ids (selected from existing rows)
  v_ex_reda   uuid[] := ARRAY[
    '8a13ea5a-c139-4ca0-a385-92d7c78bbb5f'::uuid,
    'e6e5e5a1-8604-43ad-a0d3-be5fe2485c10'::uuid,
    'bc8ab0ea-728a-433e-adf8-e84b37ed5081'::uuid,
    '1ec1197f-9196-4ef4-b2a1-4d0269d61268'::uuid
  ];
  v_ex_taha   uuid[] := ARRAY[
    '656b10fa-2b3e-4fc2-b2d6-49e3552feb6d'::uuid,
    'c51d254d-9fff-45e9-a2d6-a2b104f445b5'::uuid,
    'a960e1d7-bcde-44b2-9859-a6f4c30e068c'::uuid,
    'b7a3c5be-9226-4500-b0c6-3a0d9946d569'::uuid
  ];
  v_ex_ismail uuid[] := ARRAY[
    '2e17085a-7d34-4048-8ded-675c87ccded1'::uuid,
    '5ee9a164-2c50-4b98-b808-89c3c133e0a3'::uuid,
    '69aa2eed-ce18-4fe3-83e2-44e1d59f13ea'::uuid,
    '5ee9a164-2c50-4b98-b808-89c3c133e0a3'::uuid
  ];
  v_ex_weeks  int[]   := ARRAY[8,6,4,2];
  v_ex_ids    uuid[];
  v_old_ids   uuid[];

  v_accounts CONSTANT jsonb := jsonb_build_array(
    jsonb_build_object('email','joueur@gmail.com','password','joueur','full_name','Reda AKHETAB','role','joueur','birth_date','2008-04-30','position','Attaquant','category','U18','intended_role','joueur'),
    jsonb_build_object('email','joueur2@gmail.com','password','joueur2','full_name','NOKRY Taha','role','joueur','birth_date','2008-05-06','position','Attaquant','category','U18','intended_role','joueur'),
    jsonb_build_object('email','joueur3@gmail.com','password','joueur3','full_name','CHBILI Ismail','role','joueur','birth_date','2009-05-01','position','Attaquant','category','U18','intended_role','joueur'),
    jsonb_build_object('email','coach@gmail.com','password','coach','full_name','Mohammed BENALI','role','coach','intended_role','coach'),
    jsonb_build_object('email','admin@gmail.com','password','admin','full_name','Admin CogniRaja','role','admin','intended_role','joueur')
  );
  v_acc        jsonb;
  v_uid        uuid;
BEGIN
  -- ---------------------------------------------------------------------------
  -- 1. Create / refresh auth users
  -- ---------------------------------------------------------------------------
  FOR v_acc IN SELECT * FROM jsonb_array_elements(v_accounts) LOOP
    SELECT id INTO v_uid FROM auth.users WHERE email = v_acc->>'email';

    IF v_uid IS NULL THEN
      v_uid := gen_random_uuid();
      INSERT INTO auth.users (
        instance_id, id, aud, role, email, encrypted_password,
        email_confirmed_at, confirmation_sent_at, created_at, updated_at,
        raw_app_meta_data, raw_user_meta_data,
        is_super_admin, is_sso_user, is_anonymous
      ) VALUES (
        '00000000-0000-0000-0000-000000000000', v_uid, 'authenticated', 'authenticated',
        v_acc->>'email', crypt(v_acc->>'password', gen_salt('bf')),
        v_now, v_now, v_now, v_now,
        '{"provider":"email","providers":["email"]}'::jsonb,
        jsonb_build_object(
          'full_name', v_acc->>'full_name',
          'intended_role', v_acc->>'intended_role',
          'date_naissance', COALESCE(v_acc->>'birth_date','')
        ),
        false, false, false
      );

      INSERT INTO auth.identities (
        id, user_id, provider_id, identity_data, provider,
        last_sign_in_at, created_at, updated_at
      ) VALUES (
        gen_random_uuid(), v_uid, v_uid::text,
        jsonb_build_object('sub', v_uid::text, 'email', v_acc->>'email', 'email_verified', true),
        'email', v_now, v_now, v_now
      );
    ELSE
      -- Refresh password + confirm
      UPDATE auth.users
      SET encrypted_password = crypt(v_acc->>'password', gen_salt('bf')),
          email_confirmed_at = COALESCE(email_confirmed_at, v_now),
          updated_at = v_now
      WHERE id = v_uid;
    END IF;

    -- Upsert profile with full info + correct role
    INSERT INTO public.profiles (id, full_name, role, birth_date, position, category)
    VALUES (
      v_uid,
      v_acc->>'full_name',
      CASE WHEN v_acc->>'role' = 'coach' THEN 'coach'
           WHEN v_acc->>'role' = 'admin' THEN 'admin'
           ELSE 'joueur' END,
      NULLIF(v_acc->>'birth_date','')::date,
      NULLIF(v_acc->>'position','')::player_position,
      NULLIF(v_acc->>'category','')::player_category
    )
    ON CONFLICT (id) DO UPDATE SET
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      birth_date = EXCLUDED.birth_date,
      position = EXCLUDED.position,
      category = EXCLUDED.category,
      updated_at = v_now;
  END LOOP;

  SELECT id INTO v_reda_id   FROM auth.users WHERE email='joueur@gmail.com';
  SELECT id INTO v_taha_id   FROM auth.users WHERE email='joueur2@gmail.com';
  SELECT id INTO v_ismail_id FROM auth.users WHERE email='joueur3@gmail.com';
  SELECT id INTO v_coach_id  FROM auth.users WHERE email='coach@gmail.com';
  SELECT id INTO v_admin_id  FROM auth.users WHERE email='admin@gmail.com';

  -- ---------------------------------------------------------------------------
  -- 2. Coach request — mark approved 10 weeks ago
  -- ---------------------------------------------------------------------------
  IF EXISTS (SELECT 1 FROM public.coach_requests WHERE user_id = v_coach_id) THEN
    UPDATE public.coach_requests
    SET status='approved', reviewed_at=v_reviewed
    WHERE user_id = v_coach_id;
  ELSE
    INSERT INTO public.coach_requests (user_id, full_name, email, status, reviewed_at, created_at)
    VALUES (v_coach_id, 'Mohammed BENALI', 'coach@gmail.com', 'approved', v_reviewed, v_reviewed);
  END IF;

  -- ---------------------------------------------------------------------------
  -- 3. Coach <-> player links (accepted)
  -- ---------------------------------------------------------------------------
  DELETE FROM public.coach_players
  WHERE coach_id = v_coach_id
    AND player_id IN (v_reda_id, v_taha_id, v_ismail_id);

  INSERT INTO public.coach_players (coach_id, player_id, status, created_at)
  VALUES
    (v_coach_id, v_reda_id,   'accepted', v_reviewed),
    (v_coach_id, v_taha_id,   'accepted', v_reviewed),
    (v_coach_id, v_ismail_id, 'accepted', v_reviewed);

  -- ---------------------------------------------------------------------------
  -- 4. Wipe and reseed sessions + exercises for each player
  -- ---------------------------------------------------------------------------
  FOR v_player_id, v_targets, v_ex_ids IN
    SELECT * FROM (VALUES
      (v_reda_id,   v_reda,   v_ex_reda),
      (v_taha_id,   v_taha,   v_ex_taha),
      (v_ismail_id, v_ismail, v_ex_ismail)
    ) AS t(pid, targets, ex_ids)
  LOOP
    -- Wipe previous demo data
    SELECT array_agg(id) INTO v_old_ids
    FROM public.sessions_test WHERE user_id = v_player_id;
    IF v_old_ids IS NOT NULL THEN
      DELETE FROM public.resultats_test WHERE session_id = ANY(v_old_ids);
      DELETE FROM public.sessions_test WHERE id = ANY(v_old_ids);
    END IF;
    DELETE FROM public.completed_exercises WHERE user_id = v_player_id;

    -- 10 weekly sessions: W-10 .. W-1
    FOR i IN 1..10 LOOP
      v_weeks_back   := 11 - i; -- i=1 -> 10 weeks ago, i=10 -> 1 week ago
      v_session_date := date_trunc('hour', now() - (v_weeks_back || ' weeks')::interval);
      v_group_id     := gen_random_uuid();
      v_sgs   := v_targets[i][1];
      v_tr    := v_targets[i][2];
      v_inhib := v_targets[i][3];
      v_wm    := v_targets[i][4];
      v_flex  := v_targets[i][5];
      v_vvp   := v_targets[i][6];

      -- Inverse of src/lib/sgs-engine.ts formulas
      v_avg_rt    := GREATEST(200, ROUND(800 - v_tr * 6));
      IF v_inhib >= 50 THEN
        v_inc_er    := 0;
        v_simon_eff := GREATEST(0, ROUND(120 - (2*v_inhib - 100) * 1.2));
      ELSE
        v_simon_eff := 120;
        v_inc_er    := ROUND(((50 - v_inhib) / 100.0)::numeric, 4);
      END IF;
      v_dprime    := ROUND((v_wm * 0.03)::numeric, 2);
      v_ratio_ba  := ROUND((4 - v_flex * 0.025)::numeric, 3);
      v_time_a    := ROUND(1000 * GREATEST(15, 1666.667 / GREATEST(v_vvp, 5)));
      v_time_b    := ROUND(v_time_a * v_ratio_ba);

      -- Simon session row
      INSERT INTO public.sessions_test (user_id, test_type, created_at, status, sgs_score, score_global, donnees_brutes)
      VALUES (v_player_id, 'simon', v_session_date, 'completed', v_sgs, v_sgs,
              jsonb_build_object('sessionId', v_group_id::text))
      RETURNING id INTO v_sid_simon;

      INSERT INTO public.resultats_test (session_id, user_id, test_type, metrique, valeur, unite, created_at) VALUES
        (v_sid_simon, v_player_id, 'simon', 'avgRT', v_avg_rt, 'ms', v_session_date),
        (v_sid_simon, v_player_id, 'simon', 'simonEffect', v_simon_eff, 'ms', v_session_date),
        (v_sid_simon, v_player_id, 'simon', 'incongruentErrorRate', v_inc_er, 'ratio', v_session_date);
      INSERT INTO public.resultats_test (session_id, user_id, test_type, metrique, valeur, unite, details, created_at)
      VALUES (v_sid_simon, v_player_id, 'simon', 'accuracy', 100, '%',
              jsonb_build_object('avg_rt', v_avg_rt, 'accuracy', 100, 'incongruent_error_rate', v_inc_er),
              v_session_date);

      -- N-Back session row
      INSERT INTO public.sessions_test (user_id, test_type, created_at, status, sgs_score, score_global, donnees_brutes)
      VALUES (v_player_id, 'nback', v_session_date, 'completed', v_sgs, v_sgs,
              jsonb_build_object('sessionId', v_group_id::text))
      RETURNING id INTO v_sid_nback;

      INSERT INTO public.resultats_test (session_id, user_id, test_type, metrique, valeur, unite, details, created_at) VALUES
        (v_sid_nback, v_player_id, 'nback', 'dPrime', v_dprime, 'd''', NULL, v_session_date),
        (v_sid_nback, v_player_id, 'nback', 'accuracy', 80, '%',
         jsonb_build_object('accuracy', 80, 'target_error_rate', 0.1, 'd_prime', v_dprime),
         v_session_date);

      -- TMT session row
      INSERT INTO public.sessions_test (user_id, test_type, created_at, status, sgs_score, score_global, donnees_brutes)
      VALUES (v_player_id, 'tmt', v_session_date, 'completed', v_sgs, v_sgs,
              jsonb_build_object('sessionId', v_group_id::text))
      RETURNING id INTO v_sid_tmt;

      INSERT INTO public.resultats_test (session_id, user_id, test_type, metrique, valeur, unite, details, created_at) VALUES
        (v_sid_tmt, v_player_id, 'tmt', 'ratioBA', v_ratio_ba, 'ratio', NULL, v_session_date),
        (v_sid_tmt, v_player_id, 'tmt', 'timeA',   v_time_a,   'ms',    NULL, v_session_date),
        (v_sid_tmt, v_player_id, 'tmt', 'partAErrors', 0, 'count',
         jsonb_build_object('time_a', v_time_a, 'time_b', v_time_b, 'ratio_ba', v_ratio_ba, 'errors_a', 0),
         v_session_date);
    END LOOP;

    -- Completed exercises at weeks 8, 6, 4, 2
    FOR i IN 1..4 LOOP
      INSERT INTO public.completed_exercises (user_id, exercise_id, series_completed, completed_at, created_at)
      VALUES (
        v_player_id, v_ex_ids[i], 3,
        date_trunc('hour', now() - (v_ex_weeks[i] || ' weeks')::interval),
        date_trunc('hour', now() - (v_ex_weeks[i] || ' weeks')::interval)
      );
    END LOOP;
  END LOOP;
END
$seed$;