-- Clean up any previous attempts
DROP TRIGGER IF EXISTS recompute_sgs_after_insert ON public.resultats_test;
DROP TRIGGER IF EXISTS recompute_sgs_after_insert ON public.sessions_test;
DROP FUNCTION IF EXISTS public.recompute_sgs_global() CASCADE;
DROP FUNCTION IF EXISTS public.recompute_sgs_global_backfill(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.get_metric(UUID, TEXT, TEXT) CASCADE;

-- Helper
CREATE OR REPLACE FUNCTION public.get_metric(
  p_session_id UUID, p_test_type TEXT, p_metrique TEXT
) RETURNS NUMERIC LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT valeur::NUMERIC
  FROM public.resultats_test
  WHERE session_id = p_session_id AND test_type = p_test_type AND metrique = p_metrique
  LIMIT 1;
$$;

-- Main trigger function
CREATE OR REPLACE FUNCTION public.recompute_sgs_global()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sid UUID := NEW.session_id;
  v_types TEXT[];
  v_avg_rt NUMERIC; v_simon_effect NUMERIC; v_incong_er NUMERIC;
  v_d_prime NUMERIC; v_false_alarms NUMERIC;
  v_total_targets NUMERIC; v_total_trials NUMERIC;
  v_ratio_ba NUMERIC; v_time_a NUMERIC;
  v_s_rt NUMERIC; v_s_inhib NUMERIC; v_s_wm NUMERIC;
  v_s_att NUMERIC; v_s_flex NUMERIC; v_fa_rate NUMERIC; v_sgs NUMERIC;
BEGIN
  SELECT ARRAY_AGG(DISTINCT test_type) INTO v_types
  FROM public.resultats_test
  WHERE session_id = v_sid
    AND test_type IN ('simon','nback','tmt')
    AND metrique IN ('avgRT','simonEffect','incongruentErrorRate',
                     'dPrime','falseAlarms','totalTargets','totalTrials',
                     'ratioBA','timeA');

  IF v_types IS NULL OR NOT (v_types @> ARRAY['simon','nback','tmt']) THEN
    RETURN NEW;
  END IF;

  v_avg_rt       := public.get_metric(v_sid, 'simon', 'avgRT');
  v_simon_effect := public.get_metric(v_sid, 'simon', 'simonEffect');
  v_incong_er    := public.get_metric(v_sid, 'simon', 'incongruentErrorRate');
  v_d_prime      := public.get_metric(v_sid, 'nback', 'dPrime');
  v_false_alarms := COALESCE(public.get_metric(v_sid, 'nback', 'falseAlarms'), 0);
  v_total_targets:= COALESCE(public.get_metric(v_sid, 'nback', 'totalTargets'), 10);
  v_total_trials := COALESCE(public.get_metric(v_sid, 'nback', 'totalTrials'), 40);
  v_ratio_ba     := public.get_metric(v_sid, 'tmt', 'ratioBA');
  v_time_a       := public.get_metric(v_sid, 'tmt', 'timeA');

  v_s_rt    := GREATEST(0, LEAST(100, (600 - COALESCE(v_avg_rt, 600)) / 4.0));
  v_s_inhib := GREATEST(0, LEAST(100,
    (1.0 - COALESCE(v_simon_effect,120)/120.0)*70 +
    (1.0 - COALESCE(v_incong_er,0.5)/0.5)*30));
  v_fa_rate := v_false_alarms / GREATEST(v_total_trials - v_total_targets, 1);
  v_s_wm    := GREATEST(0, LEAST(100,
    (COALESCE(v_d_prime,0)/3.0)*80 + (1.0-LEAST(v_fa_rate,0.5)/0.5)*20));
  v_s_att   := GREATEST(0, LEAST(100, (80000-COALESCE(v_time_a,80000))/600.0));
  v_s_flex  := GREATEST(0, LEAST(100, (3.5-COALESCE(v_ratio_ba,3.5))/2.5*100));

  v_sgs := ROUND(
    v_s_flex*0.28 + v_s_att*0.22 + v_s_wm*0.22 + v_s_inhib*0.17 + v_s_rt*0.11, 1);

  UPDATE public.sessions_test SET sgs_score = v_sgs, status = 'completed'
  WHERE id = v_sid;

  RETURN NEW;
END;
$$;

-- Backfill helper (forces compute, no guard)
CREATE OR REPLACE FUNCTION public.recompute_sgs_global_backfill(p_sid UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_avg_rt NUMERIC; v_simon_effect NUMERIC; v_incong_er NUMERIC;
  v_d_prime NUMERIC; v_false_alarms NUMERIC;
  v_total_targets NUMERIC; v_total_trials NUMERIC;
  v_ratio_ba NUMERIC; v_time_a NUMERIC;
  v_s_rt NUMERIC; v_s_inhib NUMERIC; v_s_wm NUMERIC;
  v_s_att NUMERIC; v_s_flex NUMERIC; v_fa_rate NUMERIC; v_sgs NUMERIC;
BEGIN
  v_avg_rt       := public.get_metric(p_sid, 'simon', 'avgRT');
  v_simon_effect := public.get_metric(p_sid, 'simon', 'simonEffect');
  v_incong_er    := public.get_metric(p_sid, 'simon', 'incongruentErrorRate');
  v_d_prime      := public.get_metric(p_sid, 'nback', 'dPrime');
  v_false_alarms := COALESCE(public.get_metric(p_sid, 'nback', 'falseAlarms'), 0);
  v_total_targets:= COALESCE(public.get_metric(p_sid, 'nback', 'totalTargets'), 10);
  v_total_trials := COALESCE(public.get_metric(p_sid, 'nback', 'totalTrials'), 40);
  v_ratio_ba     := public.get_metric(p_sid, 'tmt', 'ratioBA');
  v_time_a       := public.get_metric(p_sid, 'tmt', 'timeA');

  v_s_rt    := GREATEST(0, LEAST(100, (600 - COALESCE(v_avg_rt, 600)) / 4.0));
  v_s_inhib := GREATEST(0, LEAST(100,
    (1.0 - COALESCE(v_simon_effect,120)/120.0)*70 +
    (1.0 - COALESCE(v_incong_er,0.5)/0.5)*30));
  v_fa_rate := v_false_alarms / GREATEST(v_total_trials - v_total_targets, 1);
  v_s_wm    := GREATEST(0, LEAST(100,
    (COALESCE(v_d_prime,0)/3.0)*80 + (1.0-LEAST(v_fa_rate,0.5)/0.5)*20));
  v_s_att   := GREATEST(0, LEAST(100, (80000-COALESCE(v_time_a,80000))/600.0));
  v_s_flex  := GREATEST(0, LEAST(100, (3.5-COALESCE(v_ratio_ba,3.5))/2.5*100));

  v_sgs := ROUND(
    v_s_flex*0.28 + v_s_att*0.22 + v_s_wm*0.22 + v_s_inhib*0.17 + v_s_rt*0.11, 1);

  UPDATE public.sessions_test SET sgs_score = v_sgs, status = 'completed'
  WHERE id = p_sid;
END;
$$;

-- Lock down direct execution
REVOKE EXECUTE ON FUNCTION public.get_metric(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_sgs_global() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recompute_sgs_global_backfill(UUID) FROM PUBLIC, anon, authenticated;

-- Trigger
CREATE TRIGGER recompute_sgs_after_insert
AFTER INSERT ON public.resultats_test
FOR EACH ROW EXECUTE FUNCTION public.recompute_sgs_global();

-- Backfill existing sessions
DO $$
DECLARE v_sid UUID;
BEGIN
  FOR v_sid IN
    SELECT DISTINCT session_id FROM public.resultats_test
  LOOP
    PERFORM public.recompute_sgs_global_backfill(v_sid);
  END LOOP;
END $$;