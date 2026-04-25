// Shared grouping logic for cognitive test sessions.
// Used by both the player history view (/sessions) and the coach view
// (/coach/sessions) to guarantee identical session counts and contents.
//
// A "logical session" groups all `sessions_test` rows that were performed
// together (e.g. Simon + N-Back + TMT in a single sitting). The grouping key
// is `donnees_brutes.sessionId` when present, otherwise the row's own `id`
// (so isolated rows still form their own group).

export type RawTestSessionRow = {
  id: string;
  user_id: string;
  test_type: string;
  created_at: string;
  score_global?: number | null;
  donnees_brutes?: unknown;
};

export type GroupedTestSession<TRow extends RawTestSessionRow = RawTestSessionRow> = {
  /** Stable key for the logical session (sessionId fallback to first row id). */
  sessionKey: string;
  user_id: string;
  /** Most recent created_at across all rows in the group (ISO string). */
  startedAt: string;
  /** Distinct test_type values, in insertion order. */
  testTypes: string[];
  /** Underlying sessions_test ids that compose this logical session. */
  rawIds: string[];
  /** Average score_global across rows that have one, or null. */
  avgScore: number | null;
  /** Original rows belonging to this group (sorted desc by created_at). */
  rows: TRow[];
};

function readSessionId(donneesBrutes: unknown): string | null {
  if (donneesBrutes && typeof donneesBrutes === "object") {
    const v = (donneesBrutes as Record<string, unknown>).sessionId;
    if (typeof v === "string" && v.length > 0) return v;
  }
  return null;
}

/**
 * Group sessions_test rows into logical sessions.
 *
 * - Key: `${user_id}::${donnees_brutes.sessionId ?? row.id}` so two different
 *   players can never collide on the same key.
 * - The returned `sessionKey` is just the `sessionId` part (without user_id),
 *   matching how it is stored in `donnees_brutes`.
 * - Groups and inner rows are sorted by `created_at` descending.
 */
export function groupTestSessions<TRow extends RawTestSessionRow>(
  rows: TRow[]
): GroupedTestSession<TRow>[] {
  const groups = new Map<string, TRow[]>();

  for (const row of rows) {
    const sid = readSessionId(row.donnees_brutes) ?? row.id;
    const key = `${row.user_id}::${sid}`;
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }

  const result: GroupedTestSession<TRow>[] = [];
  for (const [key, groupRows] of groups) {
    const sorted = [...groupRows].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const testTypes: string[] = [];
    for (const r of sorted) {
      if (!testTypes.includes(r.test_type)) testTypes.push(r.test_type);
    }
    const scoreVals = sorted
      .map((r) => (r.score_global == null ? null : Number(r.score_global)))
      .filter((v): v is number => v != null && !Number.isNaN(v));
    const avg =
      scoreVals.length === 0
        ? null
        : Math.round(scoreVals.reduce((a, b) => a + b, 0) / scoreVals.length);

    const sessionKey = key.split("::")[1] ?? sorted[0].id;
    result.push({
      sessionKey,
      user_id: sorted[0].user_id,
      startedAt: sorted[0].created_at,
      testTypes,
      rawIds: sorted.map((r) => r.id),
      avgScore: avg,
      rows: sorted,
    });
  }

  result.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
  );
  return result;
}
