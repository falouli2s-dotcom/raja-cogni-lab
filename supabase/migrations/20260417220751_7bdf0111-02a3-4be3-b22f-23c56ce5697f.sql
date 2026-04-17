ALTER TABLE public.exercices
  ADD COLUMN IF NOT EXISTS stimulus_interval_min INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS stimulus_interval_max INTEGER NOT NULL DEFAULT 7;

UPDATE public.exercices SET stimulus_interval_min = 5, stimulus_interval_max = 8 WHERE numero = 1;
UPDATE public.exercices SET stimulus_interval_min = 5, stimulus_interval_max = 8 WHERE numero = 2;
UPDATE public.exercices SET stimulus_interval_min = 4, stimulus_interval_max = 7 WHERE numero = 3;
UPDATE public.exercices SET stimulus_interval_min = 5, stimulus_interval_max = 8 WHERE numero = 4;
UPDATE public.exercices SET stimulus_interval_min = 4, stimulus_interval_max = 6 WHERE numero = 5;
UPDATE public.exercices SET stimulus_interval_min = 5, stimulus_interval_max = 7 WHERE numero = 6;
UPDATE public.exercices SET stimulus_interval_min = 5, stimulus_interval_max = 8 WHERE numero = 7;
UPDATE public.exercices SET stimulus_interval_min = 4, stimulus_interval_max = 7 WHERE numero = 8;
UPDATE public.exercices SET stimulus_interval_min = 4, stimulus_interval_max = 6 WHERE numero = 9;
UPDATE public.exercices SET stimulus_interval_min = 4, stimulus_interval_max = 6 WHERE numero = 10;
UPDATE public.exercices SET stimulus_interval_min = 4, stimulus_interval_max = 6 WHERE numero = 11;
UPDATE public.exercices SET stimulus_interval_min = 5, stimulus_interval_max = 8 WHERE numero = 12;
UPDATE public.exercices SET stimulus_interval_min = 5, stimulus_interval_max = 8 WHERE numero = 13;
UPDATE public.exercices SET stimulus_interval_min = 5, stimulus_interval_max = 7 WHERE numero = 14;
UPDATE public.exercices SET stimulus_interval_min = 5, stimulus_interval_max = 7 WHERE numero = 15;
UPDATE public.exercices SET stimulus_interval_min = 5, stimulus_interval_max = 7 WHERE numero = 16;
UPDATE public.exercices SET stimulus_interval_min = 5, stimulus_interval_max = 8 WHERE numero = 17;
UPDATE public.exercices SET stimulus_interval_min = 5, stimulus_interval_max = 8 WHERE numero = 18;