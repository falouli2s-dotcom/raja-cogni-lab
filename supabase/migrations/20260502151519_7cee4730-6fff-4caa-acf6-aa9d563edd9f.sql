CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_intended_role TEXT;
  v_full_name TEXT;
  v_initial_role TEXT;
BEGIN
  v_intended_role := COALESCE(NEW.raw_user_meta_data->>'intended_role', 'joueur');

  v_full_name := COALESCE(
    NULLIF(TRIM(CONCAT(NEW.raw_user_meta_data->>'prenom', ' ', NEW.raw_user_meta_data->>'nom')), ''),
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name'
  );

  IF v_intended_role = 'coach' THEN
    v_initial_role := 'coach_pending';
  ELSE
    v_initial_role := 'joueur';
  END IF;

  INSERT INTO public.profiles (id, full_name, birth_date, role)
  VALUES (
    NEW.id,
    v_full_name,
    NULLIF(NEW.raw_user_meta_data->>'date_naissance', '')::DATE,
    v_initial_role
  )
  ON CONFLICT (id) DO NOTHING;

  IF v_intended_role = 'coach' THEN
    INSERT INTO public.coach_requests (user_id, full_name, email, status)
    VALUES (
      NEW.id,
      COALESCE(v_full_name, NEW.email),
      NEW.email,
      'pending'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;