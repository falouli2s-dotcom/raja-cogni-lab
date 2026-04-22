-- 1. Fix coach_players INSERT policy: require role='coach'
DROP POLICY IF EXISTS "Coach can create invitations" ON public.coach_players;

CREATE POLICY "Coach can create invitations"
ON public.coach_players
FOR INSERT
TO authenticated
WITH CHECK (
  coach_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'coach'
  )
);

-- 2. Make avatars bucket private
UPDATE storage.buckets SET public = false WHERE id = 'avatars';

-- Ensure authenticated users can still view avatars via RLS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can view avatars'
  ) THEN
    CREATE POLICY "Authenticated users can view avatars"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'avatars');
  END IF;
END $$;