-- Add new columns
ALTER TABLE public.sessions_planifiees
  ADD COLUMN IF NOT EXISTS session_category TEXT NOT NULL DEFAULT 'session';

ALTER TABLE public.sessions_planifiees
  DROP CONSTRAINT IF EXISTS sessions_planifiees_session_category_check;

ALTER TABLE public.sessions_planifiees
  ADD CONSTRAINT sessions_planifiees_session_category_check
  CHECK (session_category IN ('session', 'exercices'));

ALTER TABLE public.sessions_planifiees
  ADD COLUMN IF NOT EXISTS exercice_ids UUID[] DEFAULT NULL;

-- Allow test_type to be NULL (exercices case)
ALTER TABLE public.sessions_planifiees
  ALTER COLUMN test_type DROP NOT NULL;

-- Update notification trigger function to handle both categories
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
BEGIN
  SELECT full_name INTO coach_name FROM public.profiles WHERE id = NEW.coach_id;

  IF NEW.session_category = 'exercices' THEN
    exercice_count := COALESCE(array_length(NEW.exercice_ids, 1), 0);
    notif_title := 'Exercices assignés';
    notif_message := 'Votre coach ' || COALESCE(coach_name, 'inconnu')
      || ' vous a assigné ' || exercice_count || ' exercice(s) terrain prévu(s) le '
      || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
  ELSIF NEW.session_category = 'session' AND NEW.test_type IS NULL THEN
    notif_title := 'Session cognitive assignée';
    notif_message := 'Votre coach ' || COALESCE(coach_name, 'inconnu')
      || ' vous a assigné une session cognitive complète (Simon Task, N-Back 2, TMT) prévue le '
      || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
  ELSE
    test_label := CASE NEW.test_type
      WHEN 'simon_task' THEN 'Simon Task'
      WHEN 'n_back' THEN 'N-Back 2'
      WHEN 'tmt' THEN 'Trail Making Test'
      WHEN 'crt' THEN 'Choice Reaction Time'
      WHEN 'anticipation' THEN 'Test d''Anticipation'
      ELSE NEW.test_type
    END;
    notif_title := 'Nouvelle session assignée';
    notif_message := 'Votre coach ' || COALESCE(coach_name, 'inconnu')
      || ' vous a assigné un test : ' || test_label
      || ' prévu le ' || to_char(NEW.scheduled_at AT TIME ZONE 'UTC', 'DD/MM/YYYY HH24:MI');
  END IF;

  INSERT INTO public.notifications (user_id, type, title, message, metadata)
  VALUES (
    NEW.player_id,
    'session_planifiee',
    notif_title,
    notif_message,
    jsonb_build_object(
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