
-- 1. profiles: replace overly broad read policy
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;

CREATE POLICY "Coaches read related players"
  ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_players cp
    WHERE cp.coach_id = auth.uid() AND cp.player_id = profiles.id
  ));

CREATE POLICY "Players read related coaches"
  ON public.profiles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_players cp
    WHERE cp.player_id = auth.uid() AND cp.coach_id = profiles.id
  ));

-- 2. resultats_test: enforce session ownership on insert
DROP POLICY IF EXISTS "Users can insert own results" ON public.resultats_test;
CREATE POLICY "Users can insert own results"
  ON public.resultats_test FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.sessions_test st
      WHERE st.id = session_id AND st.user_id = auth.uid()
    )
  );

-- 3. exercise-images bucket: restrict writes to admin/coach
DROP POLICY IF EXISTS "Authenticated users can upload exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update exercise images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete exercise images" ON storage.objects;

CREATE POLICY "Admins and coaches can upload exercise images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exercise-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'coach')
    )
  );

CREATE POLICY "Admins and coaches can update exercise images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'exercise-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'coach')
    )
  );

CREATE POLICY "Admins and coaches can delete exercise images"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'exercise-images'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('admin', 'coach')
    )
  );

-- 4. notifications: remove client insert (server triggers handle creation)
DROP POLICY IF EXISTS "Users insert own notifications" ON public.notifications;

-- 5. find_player_by_email: coach-only guard + restrict execute
CREATE OR REPLACE FUNCTION public.find_player_by_email(_email text)
 RETURNS TABLE(id uuid, full_name text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'coach'
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(u.email) = lower(_email)
    AND p.role = 'joueur'
  LIMIT 1;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.find_player_by_email(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_player_by_email(text) TO authenticated;

-- 6. sessions_planifiees: column-restricted completion via RPC
DROP POLICY IF EXISTS "player can complete own planning" ON public.sessions_planifiees;

CREATE OR REPLACE FUNCTION public.player_complete_session(_session_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.sessions_planifiees
  SET status = 'completed',
      completed_at = COALESCE(completed_at, now())
  WHERE id = _session_id
    AND player_id = auth.uid();
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.player_complete_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_complete_session(uuid) TO authenticated;

-- 7. revoke EXECUTE on internal SECURITY DEFINER helpers from anon
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_metric(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.recompute_sgs_global_backfill(uuid) FROM PUBLIC, anon;
