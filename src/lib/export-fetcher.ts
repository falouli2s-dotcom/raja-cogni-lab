/**
 * CogniRaja — Export Data Fetcher
 *
 * Fetches and transforms data from Supabase into the shape
 * expected by pdf-export-engine.ts.
 *
 * Drop this in: src/lib/export-fetcher.ts
 */

import { supabase } from "@/integrations/supabase/client";
import type { PlayerData, SessionResult, DimensionScore, TestMetric } from "./pdf-export-engine";

// ─── Dimension order must match sgs-engine.ts ─────────────────────────────────
const DIMENSION_LABELS = [
  "Temps de réaction",
  "Inhibition",
  "Mémoire de travail",
  "Attention",
  "Flexibilité",
  "Anticipation",
];

// ─── Single player ────────────────────────────────────────────────────────────

export async function fetchPlayerExportData(playerId: string): Promise<PlayerData> {
  // 1. Profile
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, position")
    .eq("id", playerId)
    .single();

  if (profileErr || !profile) throw new Error("Joueur introuvable");

  // 2. Sessions (with results)
  const { data: sessions, error: sessErr } = await (supabase as any)
    .from("sessions_test")
    .select("id, created_at, resultats_test(*)")
    .eq("user_id", playerId)
    .order("created_at", { ascending: true });

  if (sessErr) throw new Error("Erreur lors de la récupération des sessions");

  const mappedSessions: SessionResult[] = (sessions ?? []).map((s: any) => {
    const results: any[] = s.resultats_test ?? [];

    // Extract SGS
    const sgsRow = results.find((r) => r.metrique === "sgs_score");
    const sgsScore = sgsRow ? Math.round(Number(sgsRow.valeur)) : 0;

    // Extract dimensions — match by metrique name conventions in your DB
    const getDim = (key: string): number => {
      const row = results.find((r) => r.metrique === key);
      return row ? Math.round(Number(row.valeur)) : 0;
    };

    const dimensions: DimensionScore[] = DIMENSION_LABELS.map((label, i) => {
      const keys = [
        "reaction_time_score",
        "inhibition_score",
        "working_memory_score",
        "attention_score",
        "flexibility_score",
        "anticipation_score",
      ];
      const score = getDim(keys[i]);
      return { label, score, percentile: score }; // replace percentile with real norm if available
    });

    // Simon metrics
    const simonMetrics: TestMetric[] = results
      .filter((r) => r.metrique?.startsWith("simon_"))
      .map((r) => ({ metrique: r.metrique.replace("simon_", ""), valeur: Number(r.valeur) }));

    // N-Back metrics
    const nbackMetrics: TestMetric[] = results
      .filter((r) => r.metrique?.startsWith("nback_"))
      .map((r) => ({ metrique: r.metrique.replace("nback_", ""), valeur: Number(r.valeur) }));

    // TMT metrics
    const tmtMetrics: TestMetric[] = results
      .filter((r) => r.metrique?.startsWith("tmt_"))
      .map((r) => ({ metrique: r.metrique.replace("tmt_", ""), valeur: Number(r.valeur) }));

    return {
      session_id: s.id,
      date: s.created_at,
      sgs_score: sgsScore,
      dimensions,
      tests: {
        simon: simonMetrics,
        nback: nbackMetrics,
        tmt: tmtMetrics,
      },
    };
  });

  return {
    id: profile.id,
    full_name: profile.full_name ?? "Joueur",
    position: profile.position ?? "—",
    sessions: mappedSessions,
  };
}

// ─── Full team (all players belonging to a coach) ────────────────────────────

export async function fetchTeamExportData(coachId: string): Promise<PlayerData[]> {
  // 1. Get player IDs from coach_players
  const { data: links, error: linkErr } = await supabase
    .from("coach_players")
    .select("player_id")
    .eq("coach_id", coachId);

  if (linkErr || !links || links.length === 0) return [];

  // 2. Fetch each player in parallel
  const results = await Promise.allSettled(
    links.map((l: any) => fetchPlayerExportData(l.player_id))
  );

  return results
    .filter((r): r is PromiseFulfilledResult<PlayerData> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ─── Coach name helper ────────────────────────────────────────────────────────

export async function fetchCoachName(coachId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", coachId)
    .single();
  return data?.full_name ?? "Coach";
}
