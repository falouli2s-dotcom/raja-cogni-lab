-- Add role column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN role TEXT NOT NULL DEFAULT 'joueur' 
CHECK (role IN ('joueur', 'coach'));