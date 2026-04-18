-- ENUMS
CREATE TYPE public.player_category AS ENUM ('U13', 'U14', 'U15', 'U16', 'U17');
CREATE TYPE public.player_position AS ENUM ('Attaquant', 'Milieu', 'Défenseur', 'Gardien');
CREATE TYPE public.dominant_foot AS ENUM ('Droit', 'Gauche', 'Les deux');

-- TABLE
CREATE TABLE public.profiles (
  id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  birth_date DATE,
  avatar_url TEXT,
  category public.player_category,
  position public.player_position,
  dominant_foot public.dominant_foot,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, birth_date)
  VALUES (
    NEW.id,
    COALESCE(
      NULLIF(TRIM(CONCAT(NEW.raw_user_meta_data->>'prenom', ' ', NEW.raw_user_meta_data->>'nom')), ''),
      NEW.raw_user_meta_data->>'full_name'
    ),
    (NEW.raw_user_meta_data->>'date_naissance')::DATE
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();