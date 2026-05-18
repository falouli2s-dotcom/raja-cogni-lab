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
  flexibility: 0.20,
  vitesse_visuo_perceptuelle: 0.20,
  workingMemory: 0.20,
  inhibition: 0.20,
  reactionTime: 0.20,
};

/**
 * Inverse Efficiency Score (IES) — Townsend & Ashby (1983)
 * Combines reaction time and accuracy to control for speed-accuracy trade-off.
 * IES = avgRT / proportion_correct
 * Lower IES = better performance.
 * Normalization: IES ~200ms (perfect) → 100, IES ~800ms+ → 0
 */
function normalizeIES(avgRT: number, accuracy: number): number {
  const pc = accuracy / 100;
  if (pc <= 0) return 0;
  const ies = avgRT / pc;
  if (ies <= 200) return 100;
  if (ies >= 800) return 0;
  return Math.max(0, Math.round(((800 - ies) / 600) * 100));
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

  // 1. Temps de Réaction — IES (Inverse Efficiency Score, Townsend & Ashby 1983)
  const rtScore = scores.simon
    ? normalizeIES(scores.simon.avgRT, scores.simon.accuracy)
    : 50;
  const iesRaw = scores.simon && scores.simon.accuracy > 0
    ? Math.round(scores.simon.avgRT / (scores.simon.accuracy / 100))
    : scores.simon?.avgRT;
  dimensions.push({
    key: "reactionTime",
    label: "Temps de Réaction",
    score: rtScore,
    raw: iesRaw,
    unit: "ms (IES)",
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

  // 5. Vitesse Visuo-Perceptuelle — TMT-A Efficiency Score (adapté de Schiehser et al. 2015)
  // TMT-Ae = (nodesCompleted - errors) / timeSeconds
  let vvpScore = 50;
  let vvpRaw: number | undefined;
  if (scores.tmt) {
    const timeASeconds = scores.tmt.timeA > 1000
      ? scores.tmt.timeA / 1000
      : scores.tmt.timeA;
    const totalNodes = 25; // nœuds totaux TMT-A
    const errorCount = scores.tmt.partAErrors ?? 0;
    const efficiency = (totalNodes - errorCount) / timeASeconds; // nœuds corrects par seconde
    // Normalisation : plafond à 1.5 nœuds/s (≈ 25 nœuds en 17s, 0 erreur) → 100, plancher à 0
    vvpScore = Math.max(0, Math.min(100, Math.round((efficiency / 1.5) * 100)));
    vvpRaw = Math.round(efficiency * 100) / 100; // garder 2 décimales
  }
  dimensions.push({
    key: "vitesse_visuo_perceptuelle",
    label: "Vitesse Visuo-Perceptuelle",
    score: vvpScore,
    raw: vvpRaw,
    unit: "nœuds/s (TMT-Ae)",
    status: getStatus(vvpScore),
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
