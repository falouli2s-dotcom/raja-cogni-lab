-- 6a. Remove anticipation from exercise category enum
--     (PostgreSQL requires rename-then-drop pattern)
ALTER TYPE public.exercice_categorie RENAME TO exercice_categorie_old;
CREATE TYPE public.exercice_categorie AS ENUM (
  'attention', 'memoire', 'flexibilite', 'inhibition', 'vitesse'
);
ALTER TABLE public.exercices
  ALTER COLUMN categorie TYPE public.exercice_categorie
  USING categorie::text::public.exercice_categorie;
DROP TYPE public.exercice_categorie_old;

-- 6b. Soft-delete (do NOT hard-delete) anticipation exercises —
--     gate for v2 by setting a v2_feature flag column if it exists,
--     otherwise deactivate them:
ALTER TABLE public.exercices
  ADD COLUMN IF NOT EXISTS active boolean DEFAULT true;
UPDATE public.exercices
SET active = false
WHERE categorie::text = 'anticipation'
   OR titre ILIKE '%anticipat%';
-- Note: if the table uses categorie enum directly and active column exists.
-- Adjust column names to match actual schema.

-- 6c. Remove anticipation from test_type CHECK constraint on sessions_planifiees:
ALTER TABLE public.sessions_planifiees
  DROP CONSTRAINT IF EXISTS sessions_planifiees_test_type_check;
ALTER TABLE public.sessions_planifiees
  ADD CONSTRAINT sessions_planifiees_test_type_check
  CHECK (test_type IN ('simon_task', 'n_back', 'tmt', 'crt'));

-- 6d. Update SGS recompute function — remove s_ant, reweight to 5 dims:
--     In the sgs AS (...) SELECT, remove the s_ant * 0.10 term and update
--     the weights to match GROUP 1a:
--     s_rt * 0.11 + s_inhib * 0.17 + s_mem * 0.22 + s_flex * 0.28 + s_att * 0.22
--     Also remove the s_ant CASE block from scores_normalized CTE.
--     Show the full updated function body before applying.
CREATE OR REPLACE FUNCTION public.recompute_sgs_global()
RETURNS void
LANGUAGE sql
AS $function$
WITH
session_groups AS (
  SELECT
    id,
    user_id,
    COALESCE(donnees_brutes->>'sessionId', id::text) AS session_key
  FROM public.sessions_test
),
metrics AS (
  SELECT
    sg.session_key,
    MAX(CASE WHEN rt.test_type = 'simon' THEN (rt.details->>'avg_rt')::numeric END)    AS simon_avg_rt,
    MAX(CASE WHEN rt.test_type = 'simon' THEN rt.valeur END)                            AS simon_effect,
    MAX(CASE WHEN rt.test_type = 'simon' THEN (rt.details->>'accuracy')::numeric END)  AS simon_accuracy,
    MAX(CASE WHEN rt.test_type = 'nback' THEN (rt.details->>'accuracy')::numeric END)  AS nback_accuracy,
    MAX(CASE WHEN rt.test_type = 'tmt'   THEN rt.valeur END)                            AS tmt_ratio_ba,
    MAX(CASE WHEN rt.test_type = 'tmt'   THEN (rt.details->>'time_a')::numeric END)    AS tmt_time_a
  FROM session_groups sg
  JOIN public.resultats_test rt ON rt.session_id = sg.id
  GROUP BY sg.session_key
),
scores_normalized AS (
  SELECT
    session_key,
    CASE
      WHEN simon_avg_rt IS NULL THEN 50
      WHEN simon_avg_rt <= 200 THEN 100
      WHEN simon_avg_rt >= 600 THEN 0
      ELSE ROUND((600 - simon_avg_rt) / 400.0 * 100)
    END AS s_rt,
    CASE
      WHEN simon_effect IS NULL THEN 50
      WHEN simon_effect <= 0 THEN 100
      WHEN simon_effect >= 120 THEN 0
      ELSE ROUND((120 - simon_effect) / 120.0 * 100)
    END AS s_inhib,
    CASE
      WHEN nback_accuracy IS NULL THEN 50
      ELSE GREATEST(0, LEAST(100, ROUND(nback_accuracy)))
    END AS s_mem,
    CASE
      WHEN tmt_ratio_ba IS NULL THEN 50
      WHEN tmt_ratio_ba <= 1.0 THEN 100
      WHEN tmt_ratio_ba >= 4.0 THEN 0
      ELSE ROUND((4.0 - tmt_ratio_ba) / 3.0 * 100)
    END AS s_flex,
    CASE
      WHEN tmt_time_a IS NULL THEN 50
      ELSE ROUND(
        (1 - LEAST(1, GREATEST(0,
          ((CASE WHEN tmt_time_a > 1000 THEN tmt_time_a / 1000.0 ELSE tmt_time_a END) - 30) / 90.0
        ))) * 100
      )
    END AS s_att
  FROM metrics
),
sgs AS (
  SELECT
    session_key,
    ROUND(
      s_rt * 0.11 + s_inhib * 0.17 + s_mem * 0.22 +
      s_flex * 0.28 + s_att * 0.22
    )::numeric AS sgs_global
  FROM scores_normalized
)
UPDATE public.sessions_test st
SET score_global = sgs.sgs_global
FROM sgs
WHERE COALESCE(st.donnees_brutes->>'sessionId', st.id::text) = sgs.session_key;
$function$;

-- 6e. Remove anticipation WHEN clauses from the 3 notification triggers:
--     Files: 20260423102957, 20260423112050, 20260426111327
--     Since we cannot edit existing migrations, add ALTER FUNCTION statements
--     here that replace the trigger function bodies with anticipation removed.
--     Show each updated function body before applying.
CREATE OR REPLACE FUNCTION public.notify_player_on_session_planned()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  coach_name TEXT;
  test_label TEXT;
  notif_title TEXT;
  notif_message TEXT;
  exercice_count INT;
  notif_session_type TEXT;
BEGIN
  SELECT full_name INTO coach_name FROM public.profiles WHERE id = NEW.coach_id;

  IF NEW.session_category = 'exercices' THEN
    exercice_count := COALESCE(array_length(NEW.exercice_ids, 1), 0);
    notif_title := 'Exercices assignés';
    notif_message := 'Votre coach ' || COALESCE(coach_name, 'inconnu')
      || ' vous a assigné ' || exercice_count || ' exercice(s) terrain prévu(s) le '
      || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
    notif_session_type := 'training';
  ELSIF NEW.session_category = 'session' AND NEW.test_type IS NULL THEN
    notif_title := 'Session cognitive assignée';
    notif_message := 'Votre coach ' || COALESCE(coach_name, 'inconnu')
      || ' vous a assigné une session cognitive complète (Simon Task, N-Back 2, TMT) prévue le '
      || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
    notif_session_type := 'test';
  ELSE
    test_label := CASE NEW.test_type
      WHEN 'simon_task' THEN 'Simon Task'
      WHEN 'n_back' THEN 'N-Back 2'
      WHEN 'tmt' THEN 'Trail Making Test'
      WHEN 'crt' THEN 'Choice Reaction Time'
      ELSE NEW.test_type
    END;
    notif_title := 'Nouvelle session assignée';
    notif_message := 'Votre coach ' || COALESCE(coach_name, 'inconnu')
      || ' vous a assigné un test : ' || test_label
      || ' prévu le ' || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
    notif_session_type := 'test';
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, session_type, metadata)
  VALUES (
    NEW.player_id,
    'session_planifiee',
    notif_title,
    notif_message,
    notif_session_type,
    jsonb_build_object(
      'planning_session_id', NEW.id,
      'session_id', NEW.id,
      'test_type', NEW.test_type,
      'session_category', NEW.session_category,
      'exercice_ids', NEW.exercice_ids,
      'scheduled_at', NEW.scheduled_at
    )
  );
  RETURN NEW;
END;
$function$;
