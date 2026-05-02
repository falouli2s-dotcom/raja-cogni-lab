export const BLOCS = [
  "Gardien de But",
  "Attention",
  "Inhibition",
  "Mémoire de Travail",
  "Flexibilité Cognitive",
  "Inhibition/Flexibilité",
];

export const NIVEAUX = ["Faible", "Moyen", "Élevé"];

export const STIMULUS_TYPES = [
  "COULEUR",
  "FLÈCHE",
  "NOMBRE",
  "FLASH",
  "FORME",
];

export const BLOC_COLORS: Record<string, string> = {
  "Gardien de But": "bg-blue-900/30 text-blue-300",
  "Attention": "bg-orange-500/20 text-orange-400",
  "Inhibition": "bg-red-500/20 text-red-400",
  "Mémoire de Travail": "bg-purple-500/20 text-purple-400",
  "Flexibilité Cognitive": "bg-emerald-500/20 text-emerald-400",
  "Inhibition/Flexibilité": "bg-gradient-to-r from-red-500/20 to-emerald-500/20 text-amber-300",
};

export const NIVEAU_COLORS: Record<string, string> = {
  "Faible": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Moyen": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Élevé": "bg-red-500/20 text-red-400 border-red-500/30",
  "Faible → Moyen": "bg-amber-500/15 text-amber-300 border-amber-500/20",
  "Moyen → Élevé": "bg-orange-500/15 text-orange-300 border-orange-500/20",
};

export const TEST_ICONS: Record<string, string> = {
  "Simon Task": "⚡",
  "N-Back": "🧠",
  "TMT": "🔀",
  "TMT B": "🔀",
  "CRT": "⏱",
  "Go/No-Go": "🎯",
  "Anticipation Task": "👁",
};

export function getTestIcon(alignment: string): string {
  for (const [key, icon] of Object.entries(TEST_ICONS)) {
    if (alignment.includes(key)) return icon;
  }
  return "🧪";
}
