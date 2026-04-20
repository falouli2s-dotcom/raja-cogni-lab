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
  flexibility: 0.25,
  attention: 0.20,
  workingMemory: 0.20,
  inhibition: 0.15,
  reactionTime: 0.10,
  anticipation: 0.10,
};

/**
 * Normalize reaction time (ms) to 0-100 score.
 * 200ms → 100, 600ms+ → 0
 */
function normalizeRT(avgRT: number): number {
  if (avgRT <= 200) return 100;
  if (avgRT >= 600) return 0;
  return Math.round(((600 - avgRT) / 400) * 100);
}

/**
 * Normalize Simon effect (ms) to 0-100 score.
 * 0ms → 100, 120ms+ → 0
 */
function normalizeSimonEffect(effect: number): number {
  if (effect <= 0) return 100;
  if (effect >= 120) return 0;
  return Math.round(((120 - effect) / 120) * 100);
}

/**
 * Normalize N-Back accuracy (%) to 0-100 score.
 * Already 0-100, just clamp.
 */
function normalizeNBackAccuracy(accuracy: number): number {
  return Math.max(0, Math.min(100, Math.round(accuracy)));
}

/**
 * Normalize TMT B/A ratio to 0-100 score.
 * 1.0 → 100, 4.0+ → 0
 */
function normalizeRatioBA(ratio: number): number {
  if (ratio <= 1.0) return 100;
  if (ratio >= 4.0) return 0;
  return Math.round(((4.0 - ratio) / 3.0) * 100);
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

  // 2. Contrôle Inhibiteur (Simon effect)
  const inhibScore = scores.simon ? normalizeSimonEffect(scores.simon.simonEffect) : 50;
  dimensions.push({
    key: "inhibition",
    label: "Contrôle Inhibiteur",
    score: inhibScore,
    raw: scores.simon?.simonEffect,
    unit: "ms (effet Simon)",
    status: getStatus(inhibScore),
  });

  // 3. Mémoire de Travail (N-Back accuracy)
  const memScore = scores.nback ? normalizeNBackAccuracy(scores.nback.accuracy) : 50;
  dimensions.push({
    key: "workingMemory",
    label: "Mémoire de Travail",
    score: memScore,
    raw: scores.nback?.accuracy,
    unit: "%",
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

  // 5. Attention Sélective — proxy: TMT Part A speed (faster = more focused attention)
  // Normalize TMT-A time: 30s → 100, 120s+ → 0
  let attentionScore = 50;
  let attentionRaw: number | undefined;
  if (scores.tmt) {
    attentionRaw = Math.round((1 - Math.min(1, Math.max(0, (scores.tmt.timeA - 30) / 90))) * 100);
    attentionScore = Math.max(0, Math.min(100, attentionRaw));
  }
  dimensions.push({
    key: "attention",
    label: "Attention Sélective",
    score: attentionScore,
    raw: scores.tmt ? attentionScore : undefined,
    unit: "%",
    status: getStatus(attentionScore),
  });

  // 6. Anticipation Perceptuelle — proxy: N-Back hit rate (no dedicated test yet)
  const anticipationScore = scores.nback
    ? normalizeNBackAccuracy(scores.nback.accuracy)
    : 50;
  dimensions.push({
    key: "anticipation",
    label: "Anticipation Perceptuelle",
    score: anticipationScore,
    raw: scores.nback?.accuracy,
    unit: "%",
    status: getStatus(anticipationScore),
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
