import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { computeSGS } from "@/lib/sgs-engine";
import type {
  PlayerExportData,
  TeamExportData,
  SessionExportData,
  SGSDimensions,
  SimonMetrics,
  NBackMetrics,
  TMTMetrics,
  TeamAverages,
} from "./types";

type AppSupabaseClient = SupabaseClient<Database>;

type RawResultat = {
  session_id: string;
  metrique: string;
  valeur: number | null;
};

function pivotResultats(rows: RawResultat[], sessionId: string) {
  const map: Record<string, number | null> = {};
  for (const row of rows) {
    if (row.session_id === sessionId) {
      map[row.metrique] = row.valeur;
    }
  }

  const simon: SimonMetrics = {
    simon_effect_ms: map["simon_effect_ms"] ?? null,
    simon_error_pct: map["simon_error_pct"] ?? null,
    simon_rt_congruent: map["simon_rt_congruent"] ?? null,
    simon_rt_incongruent: map["simon_rt_incongruent"] ?? null,
  };

  const nback: NBackMetrics = {
    nback_dprime: map["nback_dprime"] ?? null,
    nback_accuracy: map["nback_accuracy"] ?? null,
    nback_hit_rate: map["nback_hit_rate"] ?? null,
    nback_false_alarm: map["nback_false_alarm"] ?? null,
  };

  const tmt: TMTMetrics = {
    tmt_a_time: map["tmt_a_time"] ?? null,
    tmt_b_time: map["tmt_b_time"] ?? null,
    tmt_ratio: map["tmt_ratio"] ?? null,
    tmt_errors: map["tmt_errors"] ?? null,
  };

  return { simon, nback, tmt };
}

function computeDimensions(
  simon: SimonMetrics,
  nback: NBackMetrics,
  tmt: TMTMetrics
): SGSDimensions {
  const simonInput =
    simon.simon_rt_congruent !== null &&
    simon.simon_rt_incongruent !== null &&
    simon.simon_effect_ms !== null
      ? {
          avgRT:
            (simon.simon_rt_congruent + simon.simon_rt_incongruent) / 2,
          simonEffect: simon.simon_effect_ms,
          accuracy: simon.simon_error_pct !== null ? 100 - simon.simon_error_pct : 50,
        }
      : undefined;

  const nbackInput =
    nback.nback_accuracy !== null
      ? {
          accuracy: nback.nback_accuracy,
          targetErrorRate: nback.nback_false_alarm ?? 0,
          dPrime: nback.nback_dprime ?? 0,
        }
      : undefined;

  const tmtInput =
    tmt.tmt_ratio !== null && tmt.tmt_a_time !== null && tmt.tmt_b_time !== null
      ? {
          ratioBA: tmt.tmt_ratio,
          timeA: tmt.tmt_a_time,
          timeB: tmt.tmt_b_time,
        }
      : undefined;

  const sgs = computeSGS({
    simon: simonInput,
    nback: nbackInput,
    tmt: tmtInput,
  });

  const dim = sgs.dimensions;
  const get = (key: string) =>
    dim.find((d) => d.key === key)?.score ?? 50;

  return {
    reactionTime: get("reactionTime"),
    inhibition: get("inhibition"),
    workingMemory: get("workingMemory"),
    attention: get("attention"),
    flexibility: get("flexibility"),
    anticipation: get("anticipation"),
  };
}

async function fetchSessionsForPlayer(
  supabase: AppSupabaseClient,
  playerId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<SessionExportData[]> {
  let query = supabase
    .from("sessions_test")
    .select("id, created_at, score_global")
    .eq("user_id", playerId)
    .order("created_at", { ascending: false });

  if (dateFrom) {
    query = query.gte("created_at", dateFrom.toISOString());
  }
  if (dateTo) {
    const end = new Date(dateTo);
    end.setDate(end.getDate() + 1);
    query = query.lt("created_at", end.toISOString());
  }

  const { data: sessions, error } = await query;
  if (error || !sessions) return [];

  if (sessions.length === 0) return [];

  const sessionIds = sessions.map((s) => s.id);

  const { data: resultats } = await supabase
    .from("resultats_test")
    .select("session_id, metrique, valeur")
    .in("session_id", sessionIds);

  const rows = (resultats ?? []) as RawResultat[];

  return sessions.map((session) => {
    const { simon, nback, tmt } = pivotResultats(rows, session.id);
    const dimensions = computeDimensions(simon, nback, tmt);

    return {
      id: session.id,
      createdAt: session.created_at,
      sgsScore: session.score_global,
      dimensions,
      simon,
      nback,
      tmt,
    };
  });
}

export async function fetchPlayerExportData(
  supabase: AppSupabaseClient,
  playerId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<PlayerExportData> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, position, avatar_url")
    .eq("id", playerId)
    .single();

  const sessions = await fetchSessionsForPlayer(
    supabase,
    playerId,
    dateFrom,
    dateTo
  );

  return {
    id: playerId,
    fullName: profile?.full_name ?? null,
    position: profile?.position ?? null,
    avatarUrl: profile?.avatar_url ?? null,
    sessions,
  };
}

export async function fetchTeamExportData(
  supabase: AppSupabaseClient,
  coachId: string,
  dateFrom?: Date,
  dateTo?: Date
): Promise<TeamExportData> {
  const { data: relations } = await (supabase as any)
    .from("coach_players")
    .select("player_id")
    .eq("coach_id", coachId)
    .eq("status", "accepted");

  const playerIds: string[] = (relations ?? []).map(
    (r: { player_id: string }) => r.player_id
  );

  if (playerIds.length === 0) {
    return {
      players: [],
      teamAverages: {
        reactionTime: 0,
        inhibition: 0,
        workingMemory: 0,
        attention: 0,
        flexibility: 0,
        anticipation: 0,
        sgsScore: 0,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  const players = await Promise.all(
    playerIds.map((pid) =>
      fetchPlayerExportData(supabase, pid, dateFrom, dateTo)
    )
  );

  const playersWithSessions = players.filter((p) => p.sessions.length > 0);

  let teamAverages: TeamAverages;
  if (playersWithSessions.length === 0) {
    teamAverages = {
      reactionTime: 0,
      inhibition: 0,
      workingMemory: 0,
      attention: 0,
      flexibility: 0,
      anticipation: 0,
      sgsScore: 0,
    };
  } else {
    const avg = (key: keyof SGSDimensions) => {
      const values = playersWithSessions.map(
        (p) => p.sessions[0].dimensions[key]
      );
      return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
    };

    const sgsValues = playersWithSessions
      .map((p) => p.sessions[0].sgsScore)
      .filter((v): v is number => v !== null);

    teamAverages = {
      reactionTime: avg("reactionTime"),
      inhibition: avg("inhibition"),
      workingMemory: avg("workingMemory"),
      attention: avg("attention"),
      flexibility: avg("flexibility"),
      anticipation: avg("anticipation"),
      sgsScore:
        sgsValues.length > 0
          ? Math.round(sgsValues.reduce((a, b) => a + b, 0) / sgsValues.length)
          : 0,
    };
  }

  return {
    players,
    teamAverages,
    generatedAt: new Date().toISOString(),
  };
}
