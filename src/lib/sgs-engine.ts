// SGS — Score Global Synthétique
// 6 axes cognitifs, chacun noté de 0 à 100

export interface CognitiveDimension {
  key: string;
  label: string;
  score: number; // 0-100
  raw?: number;
  unit?: string;
  status: "excellent" | "normal" | "limite" | "faible";
}

export interface SGSResult {
  global: number; // 0-100 weighted average
  dimensions: CognitiveDimension[];
  date: string;
}

// Scientific weights (sum = 1.0) — based on cognitive synthesis for football
const WEIGHTS: Record<string, number> = {
  flexibility: 0.28,
  attention: 0.22,
  workingMemory: 0.22,
  inhibition: 0.17,
  reactionTime: 0.11,
};

/**
 * Normalize reaction time (ms) to 0-100 score.
 * 200ms → 100, 600ms+ → 0
 */
function normalizeRT(avgRT: number): number {
  if (!Number.isFinite(avgRT)) return 50;
  if (avgRT <= 200) return 100;
  if (avgRT >= 600) return 0;
  return Math.round(((600 - avgRT) / 400) * 100);
}

/**
 * Normalize inhibition score from Simon effect (ms) and incongruent error rate.
 * Combines speed (effect) and accuracy (error rate), each weighted 50%.
 */
function normalizeInhibition(simonEffect: number, incongruentErrorRate: number): number {
  const effectScore = simonEffect <= 0
    ? 100
    : Math.max(0, Math.round(((120 - simonEffect) / 120) * 100));
  const errorScore = Math.max(0, Math.round((1 - incongruentErrorRate * 2) * 100));
  return Math.round(effectScore * 0.5 + errorScore * 0.5);
}

/**
 * Normalize N-Back d-prime sensitivity index to 0-100 score.
 * dPrime 0 → 0, 3+ → 100
 */
function normalizeNBack(dPrime: number): number {
  if (!Number.isFinite(dPrime)) return 50;
  return Math.max(0, Math.min(100, Math.round((dPrime / 3) * 100)));
}

/**
 * Normalize TMT B/A ratio to 0-100 score.
 * ratio < 1 → suspect (capped at 70), 1.0–1.5 → 100, 4.0+ → 0
 */
function normalizeRatioBA(ratio: number): number {
  if (!Number.isFinite(ratio)) return 50;
  if (ratio < 1.0) return 70;
  if (ratio <= 1.5) return 100;
  if (ratio >= 4.0) return 0;
  return Math.round(((4.0 - ratio) / 2.5) * 100);
}

function getStatus(score: number): CognitiveDimension["status"] {
  if (score >= 75) return "excellent";
  if (score >= 50) return "normal";
  if (score >= 30) return "limite";
  return "faible";
}

export interface TestScores {
  simon?: {
    avgRT: number;
    simonEffect: number;
    accuracy: number;
    incongruentErrorRate: number;
  };
  nback?: {
    accuracy: number;
    targetErrorRate: number;
    dPrime: number;
  };
  tmt?: {
    ratioBA: number;
    timeA: number;
    timeB: number;
    partAErrors?: number;
  };
}

/**
 * Compute the SGS from the latest test scores.
 */
export function computeSGS(scores: TestScores): SGSResult {
  const dimensions: CognitiveDimension[] = [];

  // 1. Temps de Réaction (Simon avgRT)
  const rtScore = scores.simon ? normalizeRT(scores.simon.avgRT) : 50;
  dimensions.push({
    key: "reactionTime",
    label: "Temps de Réaction",
    score: rtScore,
    raw: scores.simon?.avgRT,
    unit: "ms",
    status: getStatus(rtScore),
  });

  // 2. Contrôle Inhibiteur (Simon effect + incongruent error rate)
  const inhibScore = scores.simon
    ? normalizeInhibition(scores.simon.simonEffect, scores.simon.incongruentErrorRate)
    : 50;
  dimensions.push({
    key: "inhibition",
    label: "Contrôle Inhibiteur",
    score: inhibScore,
    raw: scores.simon?.simonEffect,
    unit: "ms (effet Simon)",
    status: getStatus(inhibScore),
  });

  // 3. Mémoire de Travail (N-Back d-prime)
  const memScore = scores.nback ? normalizeNBack(scores.nback.dPrime) : 50;
  dimensions.push({
    key: "workingMemory",
    label: "Mémoire de Travail",
    score: memScore,
    raw: scores.nback?.dPrime,
    unit: "d'",
    status: getStatus(memScore),
  });

  // 4. Flexibilité Cognitive (TMT ratio B/A)
  const flexScore = scores.tmt ? normalizeRatioBA(scores.tmt.ratioBA) : 50;
  dimensions.push({
    key: "flexibility",
    label: "Flexibilité Cognitive",
    score: flexScore,
    raw: scores.tmt?.ratioBA,
    unit: "ratio B/A",
    status: getStatus(flexScore),
  });

  // 5. Attention Sélective — proxy: TMT Part A speed + error penalty
  // Normalize TMT-A time: 30s → 100, 120s+ → 0
  let attentionScore = 50;
  let attentionRaw: number | undefined;
  if (scores.tmt) {
    // Convert ms → seconds if needed (TMT returns ms)
    const timeASeconds = scores.tmt.timeA > 1000
      ? scores.tmt.timeA / 1000
      : scores.tmt.timeA;
    const baseTimeScore = Math.round(
      (1 - Math.min(1, Math.max(0, (timeASeconds - 30) / 90))) * 100
    );
    const errorPenalty = Math.min(100, (scores.tmt.partAErrors ?? 0) * 5);
    attentionScore = Math.max(0, baseTimeScore - errorPenalty);
    attentionRaw = scores.tmt.timeA; // keep original raw value for display
  }
  dimensions.push({
    key: "attention",
    label: "Attention Sélective",
    score: attentionScore,
    raw: attentionRaw,
    unit: "s",
    status: getStatus(attentionScore),
  });

  // Weighted global score
  const global = Math.round(
    dimensions.reduce((sum, d) => sum + d.score * (WEIGHTS[d.key] || 0), 0)
  );

  return {
    global,
    dimensions,
    date: new Date().toISOString(),
  };
}

export function getGlobalStatus(score: number): {
  label: string;
  color: string;
} {
  if (score >= 75) return { label: "Excellent", color: "text-primary" };
  if (score >= 50) return { label: "Bon", color: "text-chart-3" };
  if (score >= 30) return { label: "Moyen", color: "text-accent" };
  return { label: "À améliorer", color: "text-destructive" };
}

export function getStatusColor(status: CognitiveDimension["status"]): string {
  switch (status) {
    case "excellent": return "text-primary";
    case "normal": return "text-chart-3";
    case "limite": return "text-accent";
    case "faible": return "text-destructive";
  }
}
