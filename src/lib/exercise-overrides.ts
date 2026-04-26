// Shared types and constants for per-planning exercise overrides.
// override_stimuli: string[]  — list of selected stimuli (predefined + custom)
// override_distances: { distance: string | null; grid: string | null }
// override_materiel: string   — free text

export type StimuliOverride = string[];

export type DistancesOverride = {
  distance: string | null;
  grid: string | null;
};

export type ExerciceOverride = {
  stimuli?: StimuliOverride;
  materiel?: string;
  distances?: DistancesOverride;
};

export type ExerciceOverridesMap = Record<string, ExerciceOverride>;

export const STIMULI_GROUPS: { label: string; items: string[] }[] = [
  {
    label: "Visuel",
    items: [
      "Signal lumineux",
      "Couleur de maillot (rouge/vert)",
      "Cône coloré",
      "Panneau directionnel",
      "Balle colorée",
    ],
  },
  {
    label: "Audio",
    items: [
      "Coup de sifflet",
      "Signal sonore court",
      "Voix coach (instruction orale)",
    ],
  },
  {
    label: "Tactile / Combiné",
    items: ["Signal lumineux + sonore", "Signal sonore + couleur"],
  },
];

export const PREDEFINED_STIMULI: Set<string> = new Set(
  STIMULI_GROUPS.flatMap((g) => g.items)
);

export const PREDEFINED_DISTANCES = ["5m", "10m", "15m", "20m", "25m", "30m"];

// Backward compatibility helpers — earlier overrides may have been stored as
// plain strings. Normalize to the new structured shape on read.
export function normalizeStimuli(raw: unknown): string[] {
  if (Array.isArray(raw))
    return raw.filter((x): x is string => typeof x === "string");
  if (typeof raw === "string" && raw.trim() !== "")
    return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

export function normalizeDistances(raw: unknown): DistancesOverride | null {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const r = raw as Record<string, unknown>;
    const distance =
      typeof r.distance === "string" && r.distance.trim() !== ""
        ? r.distance
        : null;
    const grid =
      typeof r.grid === "string" && r.grid.trim() !== "" ? r.grid : null;
    if (distance === null && grid === null) return null;
    return { distance, grid };
  }
  if (typeof raw === "string" && raw.trim() !== "")
    return { distance: raw.trim(), grid: null };
  return null;
}
