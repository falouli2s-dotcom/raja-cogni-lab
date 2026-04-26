
CREATE TABLE IF NOT EXISTS public.completed_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  exercise_id UUID NOT NULL,
  planning_id UUID REFERENCES public.sessions_planifiees(id) ON DELETE CASCADE,
  series_completed INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_completed_exercises_user_planning
  ON public.completed_exercises(user_id, planning_id);

ALTER TABLE public.completed_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own completions"
  ON public.completed_exercises FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users read own completions"
  ON public.completed_exercises FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Coach reads player completions"
  ON public.completed_exercises FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_players
    WHERE coach_id = auth.uid()
      AND player_id = completed_exercises.user_id
      AND status = 'accepted'
  ));
