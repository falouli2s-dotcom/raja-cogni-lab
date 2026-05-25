import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildTestScoresFromRows } from "@/lib/build-test-scores";
import { computeSGS } from "@/lib/sgs-engine";
import { computeRecommendations, type RecommendedExercise } from "@/lib/recommendations";
import type { Exercice } from "@/routes/_app.exercises";

export interface SessionRecommendations {
  hasSession: boolean;
  recommendations: RecommendedExercise[];
}

export function useSessionRecommendations() {
  const [data, setData] = useState<SessionRecommendations | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const user = auth?.user;
        if (!user) {
          if (!cancelled) setData({ hasSession: false, recommendations: [] });
          return;
        }

        const { data: sessions } = await supabase
          .from("sessions_test")
          .select("id, created_at, donnees_brutes")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10);

        if (!sessions || sessions.length === 0) {
          if (!cancelled) setData({ hasSession: false, recommendations: [] });
          return;
        }

        const latestKey =
          (sessions[0].donnees_brutes as any)?.sessionId ?? sessions[0].id;
        const groupSessionIds = sessions
          .filter(
            (s) => ((s.donnees_brutes as any)?.sessionId ?? s.id) === latestKey
          )
          .map((s) => s.id);

        const { data: results } = await supabase
          .from("resultats_test")
          .select("session_id, test_type, metrique, valeur, details")
          .in("session_id", groupSessionIds);

        const scores = buildTestScoresFromRows(results ?? []);
        const sgs = computeSGS(scores);

        const { data: exercises } = await supabase
          .from("exercices")
          .select("*")
          .order("numero");

        const recommendations = computeRecommendations(
          sgs.dimensions,
          (exercises ?? []) as Exercice[],
          5
        );

        if (!cancelled) setData({ hasSession: true, recommendations });
      } catch {
        if (!cancelled) setData({ hasSession: false, recommendations: [] });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, isLoading };
}
