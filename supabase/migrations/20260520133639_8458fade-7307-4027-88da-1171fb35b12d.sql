CREATE OR REPLACE FUNCTION public.admin_list_user_emails()
RETURNS TABLE(id uuid, email text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RETURN;
  END IF;
  RETURN QUERY SELECT u.id, u.email::text FROM auth.users u;
END;
$$;