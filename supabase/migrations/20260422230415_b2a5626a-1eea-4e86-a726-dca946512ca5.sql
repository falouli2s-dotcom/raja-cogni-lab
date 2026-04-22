-- Drop the insecure view
DROP VIEW IF EXISTS public.user_emails;

-- Create a secure function to find a player by email
-- Returns only the user id if they have role='joueur', nothing else
CREATE OR REPLACE FUNCTION public.find_player_by_email(_email TEXT)
RETURNS TABLE(id UUID, full_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE lower(u.email) = lower(_email)
    AND p.role = 'joueur'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.find_player_by_email(TEXT) TO authenticated;