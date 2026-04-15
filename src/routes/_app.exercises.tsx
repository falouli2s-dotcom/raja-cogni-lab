import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExerciseCatalog } from "@/components/exercises/ExerciseCatalog";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/exercises")({
  component: ExercisesPage,
});

export type Exercice = Tables<"exercices">;

function ExercisesPage() {
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("exercices")
        .select("*")
        .order("numero");
      if (data) setExercices(data);
      setLoading(false);
    }
    load();
  }, []);

  return <ExerciseCatalog exercices={exercices} loading={loading} />;
}
