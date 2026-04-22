-- Create coach_players table
CREATE TABLE public.coach_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(coach_id, player_id)
);

-- Enable RLS
ALTER TABLE public.coach_players ENABLE ROW LEVEL SECURITY;

-- SELECT: coach or player can view their relations
CREATE POLICY "Coach or player can view their relations"
ON public.coach_players
FOR SELECT
TO authenticated
USING (coach_id = auth.uid() OR player_id = auth.uid());

-- INSERT: only coach can create invitation
CREATE POLICY "Coach can create invitations"
ON public.coach_players
FOR INSERT
TO authenticated
WITH CHECK (coach_id = auth.uid());

-- UPDATE: only player can update status
CREATE POLICY "Player can update invitation status"
ON public.coach_players
FOR UPDATE
TO authenticated
USING (player_id = auth.uid());

-- DELETE: only coach can remove
CREATE POLICY "Coach can delete relations"
ON public.coach_players
FOR DELETE
TO authenticated
USING (coach_id = auth.uid());

-- Index
CREATE INDEX idx_coach_players_coach ON public.coach_players(coach_id);
CREATE INDEX idx_coach_players_player ON public.coach_players(player_id);

-- Secure email lookup view
CREATE OR REPLACE VIEW public.user_emails AS
SELECT id, email FROM auth.users;

GRANT SELECT ON public.user_emails TO authenticated;