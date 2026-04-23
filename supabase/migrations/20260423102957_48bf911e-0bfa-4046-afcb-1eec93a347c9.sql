-- ============ TABLE: sessions_planifiees ============
CREATE TABLE public.sessions_planifiees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  test_type TEXT NOT NULL CHECK (test_type IN ('simon_task','n_back','tmt','crt','anticipation')),
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','cancelled')),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.sessions_planifiees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach or player can view planned sessions"
ON public.sessions_planifiees FOR SELECT TO authenticated
USING (coach_id = auth.uid() OR player_id = auth.uid());

CREATE POLICY "Coach can create planned sessions for accepted players"
ON public.sessions_planifiees FOR INSERT TO authenticated
WITH CHECK (
  coach_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.coach_players
    WHERE coach_id = auth.uid()
      AND player_id = sessions_planifiees.player_id
      AND status = 'accepted'
  )
);

CREATE POLICY "Coach can update own planned sessions"
ON public.sessions_planifiees FOR UPDATE TO authenticated
USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coach can delete own planned sessions"
ON public.sessions_planifiees FOR DELETE TO authenticated
USING (coach_id = auth.uid());

CREATE INDEX idx_sessions_planifiees_player ON public.sessions_planifiees(player_id, status);
CREATE INDEX idx_sessions_planifiees_coach ON public.sessions_planifiees(coach_id, status);

-- ============ TABLE: notifications ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('invitation_coach','session_planifiee','session_completee')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users insert own notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users delete own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read, created_at DESC);

-- ============ Coach reads on sessions_test / resultats_test ============
CREATE POLICY "Coach reads player sessions"
ON public.sessions_test FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.coach_players
    WHERE coach_id = auth.uid()
      AND player_id = sessions_test.user_id
      AND status = 'accepted'
  )
);

CREATE POLICY "Coach reads player results"
ON public.resultats_test FOR SELECT TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.coach_players
    WHERE coach_id = auth.uid()
      AND player_id = resultats_test.user_id
      AND status = 'accepted'
  )
);

-- ============ TRIGGER: Notify player on coach invitation ============
CREATE OR REPLACE FUNCTION public.notify_player_on_invitation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coach_name TEXT;
BEGIN
  IF NEW.status = 'pending' THEN
    SELECT full_name INTO coach_name FROM public.profiles WHERE id = NEW.coach_id;
    INSERT INTO public.notifications (user_id, type, title, message, metadata)
    VALUES (
      NEW.player_id,
      'invitation_coach',
      'Invitation d''un coach',
      'Le coach ' || COALESCE(coach_name, 'inconnu') || ' vous invite à rejoindre son équipe',
      jsonb_build_object('coach_players_id', NEW.id, 'coach_name', coach_name)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_player_on_invitation
AFTER INSERT ON public.coach_players
FOR EACH ROW EXECUTE FUNCTION public.notify_player_on_invitation();

-- ============ TRIGGER: Notify player on planned session ============
CREATE OR REPLACE FUNCTION public.notify_player_on_session_planned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  coach_name TEXT;
  test_label TEXT;
BEGIN
  SELECT full_name INTO coach_name FROM public.profiles WHERE id = NEW.coach_id;
  test_label := CASE NEW.test_type
    WHEN 'simon_task' THEN 'Simon Task'
    WHEN 'n_back' THEN 'N-Back 2'
    WHEN 'tmt' THEN 'Trail Making Test'
    WHEN 'crt' THEN 'Choice Reaction Time'
    WHEN 'anticipation' THEN 'Test d''Anticipation'
    ELSE NEW.test_type
  END;
  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    NEW.player_id,
    'session_planifiee',
    'Nouvelle session assignée',
    'Votre coach ' || COALESCE(coach_name, 'inconnu') || ' vous a assigné un test : ' || test_label
      || ' prévu le ' || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI'),
    jsonb_build_object('session_id', NEW.id, 'test_type', NEW.test_type, 'scheduled_at', NEW.scheduled_at)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_player_on_session_planned
AFTER INSERT ON public.sessions_planifiees
FOR EACH ROW EXECUTE FUNCTION public.notify_player_on_session_planned();

-- ============ TRIGGER: Auto-complete planned session when test is done ============
CREATE OR REPLACE FUNCTION public.auto_complete_planned_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sessions_planifiees
  SET status = 'completed'
  WHERE id = (
    SELECT id FROM public.sessions_planifiees
    WHERE player_id = NEW.user_id
      AND test_type = NEW.test_type
      AND status = 'pending'
    ORDER BY scheduled_at ASC
    LIMIT 1
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_complete_planned_session
AFTER INSERT ON public.sessions_test
FOR EACH ROW EXECUTE FUNCTION public.auto_complete_planned_session();