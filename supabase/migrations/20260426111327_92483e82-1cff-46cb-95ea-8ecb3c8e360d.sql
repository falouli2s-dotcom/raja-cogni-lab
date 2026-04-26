-- Add per-planning override fields and a discriminator to support
-- exercise customization (Change 3) and notification routing (Change 4).

-- Overrides: nullable JSON map from exercice_id -> { stimuli?, materiel?, distances? }
-- Stored on the planning record so the catalog exercise stays untouched.
ALTER TABLE public.sessions_planifiees
  ADD COLUMN IF NOT EXISTS exercice_overrides jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Notification routing: ensure each notification carries its target type so
-- the player client can deep-link correctly (training vs test).
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS session_type text;

-- Backfill session_type for existing planned-session notifications based on metadata.
UPDATE public.notifications
SET session_type = CASE
  WHEN metadata->>'session_category' = 'exercices' THEN 'training'
  WHEN type = 'session_planifiee' THEN 'test'
  ELSE session_type
END
WHERE session_type IS NULL
  AND type = 'session_planifiee';

-- Update the notify trigger to populate session_type and a planning_session_id
-- in metadata so the player can deep-link to the planned training.
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
      WHEN 'anticipation' THEN 'Test d''Anticipation'
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