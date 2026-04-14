
-- Sessions de test
CREATE TABLE public.sessions_test (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  test_type TEXT NOT NULL,
  score_global NUMERIC,
  duree_totale NUMERIC,
  donnees_brutes JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Résultats détaillés
CREATE TABLE public.resultats_test (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions_test(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  test_type TEXT NOT NULL,
  metrique TEXT NOT NULL,
  valeur NUMERIC,
  unite TEXT,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.sessions_test ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resultats_test ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own sessions" ON public.sessions_test FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own sessions" ON public.sessions_test FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own results" ON public.resultats_test FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can read own results" ON public.resultats_test FOR SELECT TO authenticated USING (auth.uid() = user_id);
