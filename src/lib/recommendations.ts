import type { Exercice } from "@/routes/_app.exercises";
import type { CognitiveDimension } from "@/lib/sgs-engine";

export type WeakDimensionKey =
  | "inhibition"
  | "workingMemory"
  | "flexibility"
  | "reactionTime"
  | "vitesse_visuo_perceptuelle";

export interface RecommendedExercise {
  exercice: Exercice;
  dimensionKey: WeakDimensionKey;
  dimensionLabel: string;
}

const PRIORITY: WeakDimensionKey[] = [
  "inhibition",
  "workingMemory",
  "flexibility",
  "reactionTime",
  "vitesse_visuo_perceptuelle",
];

const DIMENSION_LABELS: Record<WeakDimensionKey, string> = {
  inhibition: "Inhibition",
  workingMemory: "Mémoire de travail",
  flexibility: "Flexibilité cognitive",
  reactionTime: "Temps de réaction",
  vitesse_visuo_perceptuelle: "Vitesse visuo-perceptuelle",
};

// Match against the `indicateur_cognitif` text (substring, case-insensitive).
const DIMENSION_INDICATORS: Record<WeakDimensionKey, string[]> = {
  inhibition: ["contrôle inhibiteur"],
  workingMemory: ["mémoire de travail"],
  flexibility: ["flexibilité cognitive"],
  reactionTime: ["temps de réaction", "attention sélective"],
  vitesse_visuo_perceptuelle: ["attention divisée", "attention sélective"],
};

export const DIMENSION_BADGE_CLASS: Record<WeakDimensionKey, string> = {
  inhibition: "bg-red-500/20 text-red-400 border-red-500/30",
  workingMemory: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  flexibility: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  reactionTime: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  vitesse_visuo_perceptuelle: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

export function getDimensionLabel(key: WeakDimensionKey): string {
  return DIMENSION_LABELS[key];
}

function niveauRank(niveau: string): number {
  const n = niveau.toLowerCase();
  if (n.includes("moyen")) return 0;
  if (n.includes("élevé") || n.includes("eleve") || n.includes("avancé")) return 1;
  return 2;
}

function matchesDimension(ex: Exercice, key: WeakDimensionKey): boolean {
  const ind = (ex.indicateur_cognitif ?? "").toLowerCase();
  return DIMENSION_INDICATORS[key].some((needle) => ind.includes(needle));
}

/**
 * Compute exercise recommendations from cognitive dimension scores.
 *
 * - Any dimension with score < 50 is considered "weak".
 * - Weak dimensions are iterated in fixed priority order.
 * - For each weak dimension, matching exercises are added (sorted by niveau:
 *   Moyen first, then Élevé, then Faible), without duplicates across dims.
 * - Returns at most 5 exercises.
 */
export function computeRecommendations(
  dimensions: CognitiveDimension[],
  exercises: Exercice[],
  max = 5
): RecommendedExercise[] {
  const scoreByKey = new Map<string, number>();
  for (const d of dimensions) scoreByKey.set(d.key, d.score);

  const weak = PRIORITY.filter((k) => {
    const s = scoreByKey.get(k);
    return typeof s === "number" && s < 50;
  });

  const out: RecommendedExercise[] = [];
  const seen = new Set<string>();

  for (const key of weak) {
    const matches = exercises
      .filter((ex) => matchesDimension(ex, key) && !seen.has(ex.id))
      .sort((a, b) => niveauRank(a.niveau) - niveauRank(b.niveau));

    for (const ex of matches) {
      if (out.length >= max) return out;
      seen.add(ex.id);
      out.push({
        exercice: ex,
        dimensionKey: key,
        dimensionLabel: DIMENSION_LABELS[key],
      });
    }
  }

  return out;
}
