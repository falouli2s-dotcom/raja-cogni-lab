import type { TestScores } from "./sgs-engine";

type Row = {
  test_type: string;
  metrique?: string | null;
  valeur: number | null;
  details?: any;
};

/**
 * Build a TestScores object from raw `resultats_test` rows.
 *
 * The table is EAV: one row per metric. We must look up values by the
 * `metrique` column rather than blindly trusting `r.valeur` of whichever
 * row happens to carry the legacy `details` summary payload.
 *
 * Falls back to snake_case metric names for historical rows.
 */
export function buildTestScoresFromRows(rows: Row[]): TestScores {
  const scores: TestScores = {};

  const get = (testType: string, ...names: string[]): number | undefined => {
    for (const n of names) {
      const r = rows.find((x) => x.test_type === testType && x.metrique === n);
      if (r && r.valeur != null) return Number(r.valeur);
    }
    return undefined;
  };

  // Find the row that carries the legacy `details` summary for each test.
  const detailsFor = (testType: string): any => {
    const r = rows.find((x) => x.test_type === testType && x.details);
    return r?.details ?? null;
  };

  const simonDetails = detailsFor("simon");
  const simonEffect = get("simon", "simonEffect", "simon_effect");
  if (simonDetails || simonEffect !== undefined) {
    scores.simon = {
      avgRT: Number(get("simon", "avgRT") ?? simonDetails?.avg_rt ?? 0),
      simonEffect: Number(simonEffect ?? 0),
      accuracy: Number(simonDetails?.accuracy ?? 0),
    };
  }

  const nbackDetails = detailsFor("nback");
  const dPrime = get("nback", "dPrime");
  if (nbackDetails || dPrime !== undefined) {
    scores.nback = {
      accuracy: Number(nbackDetails?.accuracy ?? 0),
      targetErrorRate: Number(
        get("nback", "target_error_rate") ?? nbackDetails?.target_error_rate ?? 0
      ),
      dPrime: Number(dPrime ?? nbackDetails?.d_prime ?? 0),
    };
  }

  const tmtDetails = detailsFor("tmt");
  const ratioBA = get("tmt", "ratioBA", "ratio_ba");
  if (tmtDetails || ratioBA !== undefined) {
    scores.tmt = {
      ratioBA: Number(ratioBA ?? 0),
      timeA: Number(get("tmt", "timeA") ?? tmtDetails?.time_a ?? 0),
      timeB: Number(tmtDetails?.time_b ?? 0),
    };
  }

  return scores;
}
