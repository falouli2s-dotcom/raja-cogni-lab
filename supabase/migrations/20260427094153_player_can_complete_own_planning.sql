-- Allow the player to mark their own planning as completed.
-- Without this policy the UPDATE silently returns 0 rows (RLS blocks it)
-- even though supabase-js v2 does not throw an error on RLS violations.

CREATE POLICY "player can complete own planning"
  ON public.sessions_planifiees
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = player_id)
  WITH CHECK (auth.uid() = player_id);
