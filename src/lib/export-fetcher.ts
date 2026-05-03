/**
 * CogniRaja — Export Data Fetcher
 *
 * Fetches and transforms data from Supabase into the shape
 * expected by pdf-export-engine.ts.
 */

import { supabase } from "@/integrations/supabase/client";
import { computeSGS, type TestScores } from "./sgs-engine";
import { buildTestScoresFromRows } from "./build-test-scores";
import type { PlayerData, SessionResult, DimensionScore, TestMetric } from "./pdf-export-engine";

// Maps sgs-engine dimension keys (in fixed order) to display labels for the radar/bars.
const DIMENSION_LABELS: Record<string, string> = {
  reactionTime: "Temps de réaction",
  inhibition: "Inhibition",
  workingMemory: "Mémoire de travail",
  flexibility: "Flexibilité",
  attention: "Attention",
};

// ─── Single player ────────────────────────────────────────────────────────────

export async function fetchPlayerExportData(playerId: string): Promise<PlayerData> {
  // 1. Profile
  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id, full_name, position")
    .eq("id", playerId)
    .single();

  if (profileErr || !profile) throw new Error("Joueur introuvable");

  // 2. Sessions (with results). Each row of sessions_test corresponds to a single
  //    test (simon | nback | tmt). We group by donnees_brutes->>sessionId so the
  //    PDF reflects "cognitive sessions" (the trio) like the player UI does.
  const { data: rows, error: sessErr } = await (supabase as any)
    .from("sessions_test")
    .select("id, created_at, test_type, score_global, donnees_brutes, resultats_test(*)")
    .eq("user_id", playerId)
    .order("created_at", { ascending: true });

  if (sessErr) throw new Error("Erreur lors de la récupération des sessions");

  // Group rows by their sessionId (donnees_brutes.sessionId) — fall back to row.id.
  const groups = new Map<string, any[]>();
  for (const r of (rows ?? []) as any[]) {
    const key = r?.donnees_brutes?.sessionId ?? r.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }

  const mappedSessions: SessionResult[] = Array.from(groups.entries()).map(
    ([sessionKey, groupRows]) => {
      // Earliest createdAt in the group as "session date"
      const date = groupRows
        .map((g) => g.created_at)
        .sort()[0];

      // SGS: score_global is duplicated on every row of the same session.
      const sgsScore = Math.round(Number(groupRows[0]?.score_global ?? 0));

      // Build TestScores for sgs-engine from the EAV metric rows.
      // Flatten resultats_test from each test row (each test row has its own
      // results array attached via the join), then map by `metrique`.
      const allResults = groupRows.flatMap((g) =>
        ((g.resultats_test ?? []) as any[]).map((rt) => ({
          test_type: g.test_type,
          metrique: rt.metrique,
          valeur: rt.valeur,
          details: rt.details,
        }))
      );
      const scores: TestScores = buildTestScoresFromRows(allResults);

      // Order matches the radar/labels: Réaction, Inhibition, Mémoire, Attention, Flexibilité (5 dimensions)
      const orderedKeys = [
        "reactionTime",
        "inhibition",
        "workingMemory",
        "attention",
        "flexibility",
      ];
      const dimensions: DimensionScore[] = orderedKeys.map((key) => {
        const d = sgs.dimensions.find((x) => x.key === key);
        const score = d?.score ?? 0;
        return {
          label: DIMENSION_LABELS[key] ?? key,
          score,
          percentile: score,
        };
      });

      // Use score_global from DB if present, otherwise the freshly computed one.
      const finalSgs = sgsScore > 0 ? sgsScore : sgs.global;

      const toMetrics = (row: any): TestMetric[] => {
        const r = row?.resultats_test?.[0];
        if (!r) return [];
        const out: TestMetric[] = [
          { metrique: r.metrique, valeur: Number(r.valeur ?? 0) },
        ];
        if (r.details && typeof r.details === "object") {
          for (const [k, v] of Object.entries(r.details)) {
            if (typeof v === "number") out.push({ metrique: k, valeur: v });
          }
        }
        return out;
      };

      return {
        session_id: String(sessionKey),
        date,
        sgs_score: finalSgs,
        dimensions,
        tests: {
          simon: toMetrics(simonRow),
          nback: toMetrics(nbackRow),
          tmt: toMetrics(tmtRow),
        },
        simonRawTrials: Array.isArray(simonResult?.details?.raw_trials)
          ? simonResult.details.raw_trials
          : [],
      };
    }
  );

  // Sort sessions chronologically
  mappedSessions.sort((a, b) => a.date.localeCompare(b.date));

  return {
    id: profile.id,
    full_name: profile.full_name ?? "Joueur",
    position: profile.position ?? "—",
    sessions: mappedSessions,
  };
}

// ─── Full team (all players belonging to a coach) ────────────────────────────

export async function fetchTeamExportData(coachId: string): Promise<PlayerData[]> {
  const { data: links, error: linkErr } = await (supabase as any)
    .from("coach_players")
    .select("player_id")
    .eq("coach_id", coachId)
    .eq("status", "accepted");

  if (linkErr || !links || links.length === 0) return [];

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
