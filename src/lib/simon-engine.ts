export type SimonColor = "green" | "red";
export type SimonSide = "left" | "right";

export interface SimonTrial {
  trialNumber: number;
  color: SimonColor;
  position: SimonSide;
  isCongruent: boolean;
  responseTime: number | null;
  correct: boolean | null;
  responded: boolean;
}

export interface SimonConfig {
  trainingTrials: number;
  realTrials: number;
  isi: number; // inter-stimulus interval ms
  responseLimit: number; // max response time ms
  fixationDuration: number; // fixation cross duration ms
}

export const SIMON_CONFIG: SimonConfig = {
  trainingTrials: 10,
  realTrials: 40,
  isi: 500,
  responseLimit: 1500,
  fixationDuration: 500,
};

/** Single source of truth: response zone per colour (LEFT = ROUGE, RIGHT = VERT). */
export const RESPONSE_SIDE: Record<SimonColor, SimonSide> = { red: "left", green: "right" };

/** Anticipation threshold: RTs below this are excluded from averages. */
export const MIN_RT = 150;

const opposite = (s: SimonSide): SimonSide => (s === "left" ? "right" : "left");

/** Congruence recomputed from raw data (never trust stored isCongruent). */
export function isSimonCongruent(t: { color: SimonColor; position: SimonSide }): boolean {
  return RESPONSE_SIDE[t.color] === t.position;
}

export function generateTrials(count: number): Omit<SimonTrial, "responseTime" | "correct" | "responded">[] {
  const cells: { color: SimonColor; isCongruent: boolean }[] = [
    { color: "red", isCongruent: true },
    { color: "green", isCongruent: true },
    { color: "red", isCongruent: false },
    { color: "green", isCongruent: false },
  ];
  const trials: Omit<SimonTrial, "responseTime" | "correct" | "responded">[] = [];

  for (let i = 0; i < count; i++) {
    const { color, isCongruent } = cells[i % 4];
    const position = isCongruent ? RESPONSE_SIDE[color] : opposite(RESPONSE_SIDE[color]);
    trials.push({ trialNumber: i + 1, color, position, isCongruent });
  }

  // Shuffle (Fisher-Yates)
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trials[i], trials[j]] = [trials[j], trials[i]];
  }

  return trials.map((t, i) => ({ ...t, trialNumber: i + 1 }));
}

export interface SimonResults {
  avgRT: number;
  avgCongruent: number;
  avgIncongruent: number;
  simonEffect: number;
  accuracy: number;
  errorRate: number;
  incongruentErrorRate: number;
  totalTrials: number;
  correctCount: number;
  missedCount: number;
}

export function computeSimonResults(rawTrials: SimonTrial[]): SimonResults {
  const trials = rawTrials.map((t) => ({ ...t, isCongruent: isSimonCongruent(t) }));
  const validTrials = trials.filter(
    (t) => t.responded && t.responseTime !== null && t.responseTime >= MIN_RT
  );
  const correctTrials = validTrials.filter((t) => t.correct);
  const congruent = correctTrials.filter((t) => t.isCongruent);
  const incongruent = correctTrials.filter((t) => !t.isCongruent);

  const mean = (arr: SimonTrial[]) =>
    arr.length > 0 ? arr.reduce((s, t) => s + (t.responseTime || 0), 0) / arr.length : 0;

  const avgRT = mean(correctTrials);
  const avgCongruent = mean(congruent);
  const avgIncongruent = mean(incongruent);

  const simonEffect = avgIncongruent - avgCongruent;
  const accuracy = validTrials.length > 0 ? correctTrials.length / validTrials.length : 0;
  const errorRate = 1 - accuracy;

  const incongruentResponded = validTrials.filter((t) => !t.isCongruent);
  const incongruentErrors = incongruentResponded.filter((t) => !t.correct).length;
  const incongruentErrorRate = incongruentResponded.length > 0
    ? Number((incongruentErrors / incongruentResponded.length).toFixed(3))
    : 0;

  return {
    avgRT: Math.round(avgRT),
    avgCongruent: Math.round(avgCongruent),
    avgIncongruent: Math.round(avgIncongruent),
    simonEffect: Math.round(simonEffect),
    accuracy: Math.round(accuracy * 100),
    errorRate: Math.round(errorRate * 100),
    incongruentErrorRate,
    totalTrials: trials.length,
    correctCount: correctTrials.length,
    missedCount: trials.filter((t) => !t.responded).length,
  };
}
