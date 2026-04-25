
-- Backfill normalization of sessions_test.score_global to a unified SGS (0-100)
-- across all rows of the same logical session. Mirrors src/lib/sgs-engine.ts.

WITH
-- Step 1: Group rows of sessions_test by logical session (donnees_brutes.sessionId or id fallback)
session_groups AS (
  SELECT
    id,
    user_id,
    COALESCE(donnees_brutes->>'sessionId', id::text) AS session_key
  FROM public.sessions_test
),
-- Step 2: For each logical session, pull the relevant metrics from resultats_test
metrics AS (
  SELECT
    sg.session_key,
    -- Simon
    MAX(CASE WHEN rt.test_type = 'simon' THEN (rt.details->>'avg_rt')::numeric END)    AS simon_avg_rt,
    MAX(CASE WHEN rt.test_type = 'simon' THEN rt.valeur END)                            AS simon_effect,
    MAX(CASE WHEN rt.test_type = 'simon' THEN (rt.details->>'accuracy')::numeric END)  AS simon_accuracy,
    -- N-Back
    MAX(CASE WHEN rt.test_type = 'nback' THEN (rt.details->>'accuracy')::numeric END)  AS nback_accuracy,
    -- TMT
    MAX(CASE WHEN rt.test_type = 'tmt'   THEN rt.valeur END)                            AS tmt_ratio_ba,
    MAX(CASE WHEN rt.test_type = 'tmt'   THEN (rt.details->>'time_a')::numeric END)    AS tmt_time_a
  FROM session_groups sg
  JOIN public.resultats_test rt ON rt.session_id = sg.id
  GROUP BY sg.session_key
),
-- Step 3: Compute each cognitive dimension score (0-100) — identical formulas to src/lib/sgs-engine.ts
dims AS (
  SELECT
    session_key,
    -- 1. reactionTime: 200ms→100, 600ms+→0
    CASE
      WHEN simon_avg_rt IS NULL THEN 50
      WHEN simon_avg_rt <= 200 THEN 100
      WHEN simon_avg_rt >= 600 THEN 0
      ELSE ROUND((600 - simon_avg_rt) / 400.0 * 100)
    END AS s_rt,
    -- 2. inhibition: 0ms→100, 120ms+→0
    CASE
      WHEN simon_effect IS NULL THEN 50
      WHEN simon_effect <= 0 THEN 100
      WHEN simon_effect >= 120 THEN 0
      ELSE ROUND((120 - simon_effect) / 120.0 * 100)
    END AS s_inhib,
    -- 3. workingMemory: nback accuracy clamped 0-100
    CASE
      WHEN nback_accuracy IS NULL THEN 50
      ELSE GREATEST(0, LEAST(100, ROUND(nback_accuracy)))
    END AS s_mem,
    -- 4. flexibility: TMT ratio 1.0→100, 4.0+→0
    CASE
      WHEN tmt_ratio_ba IS NULL THEN 50
      WHEN tmt_ratio_ba <= 1.0 THEN 100
      WHEN tmt_ratio_ba >= 4.0 THEN 0
      ELSE ROUND((4.0 - tmt_ratio_ba) / 3.0 * 100)
    END AS s_flex,
    -- 5. attention: TMT timeA (ms→s if >1000), 30s→100, 120s+→0
    CASE
      WHEN tmt_time_a IS NULL THEN 50
      ELSE ROUND(
        (1 - LEAST(1, GREATEST(0,
          ((CASE WHEN tmt_time_a > 1000 THEN tmt_time_a / 1000.0 ELSE tmt_time_a END) - 30) / 90.0
        ))) * 100
      )
    END AS s_att,
    -- 6. anticipation: proxy = nback accuracy
    CASE
      WHEN nback_accuracy IS NULL THEN 50
      ELSE GREATEST(0, LEAST(100, ROUND(nback_accuracy)))
    END AS s_ant
  FROM metrics
),
-- Step 4: Weighted global SGS (weights: flex 0.25, att 0.20, mem 0.20, inhib 0.15, rt 0.10, ant 0.10)
sgs AS (
  SELECT
    session_key,
    ROUND(
      s_rt * 0.10 + s_inhib * 0.15 + s_mem * 0.20 +
      s_flex * 0.25 + s_att * 0.20 + s_ant * 0.10
    )::numeric AS sgs_global
  FROM dims
)
-- Step 5: Apply unified SGS to every sessions_test row of the same logical session
UPDATE public.sessions_test st
SET score_global = sgs.sgs_global
FROM sgs
WHERE COALESCE(st.donnees_brutes->>'sessionId', st.id::text) = sgs.session_key;
