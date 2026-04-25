-- Allow any authenticated user to read any profile
DROP POLICY IF EXISTS "Authenticated users can read all profiles" ON public.profiles;
CREATE POLICY "Authenticated users can read all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);
