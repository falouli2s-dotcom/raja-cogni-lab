-- 1. Profiles: bloquer le changement de role
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (
  auth.uid() = id
  AND role = (SELECT role FROM public.profiles WHERE id = auth.uid())
);

-- 2. coach_players: joueur peut seulement passer status à accepted/declined
DROP POLICY IF EXISTS "Player can update invitation status" ON public.coach_players;
DROP POLICY IF EXISTS "Players can update invitation status" ON public.coach_players;
CREATE POLICY "Players can update invitation status"
ON public.coach_players FOR UPDATE
TO authenticated
USING (player_id = auth.uid())
WITH CHECK (
  player_id = auth.uid()
  AND status IN ('accepted', 'declined')
  AND coach_id = (SELECT coach_id FROM public.coach_players cp WHERE cp.id = coach_players.id)
  AND player_id = (SELECT player_id FROM public.coach_players cp WHERE cp.id = coach_players.id)
);

-- 3. Storage avatars: restreindre SELECT au propriétaire du dossier
DROP POLICY IF EXISTS "Authenticated users can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own avatar files" ON storage.objects;
CREATE POLICY "Users view own avatar"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[1]
);