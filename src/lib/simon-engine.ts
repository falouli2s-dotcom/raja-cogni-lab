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

export function generateTrials(count: number): Omit<SimonTrial, "responseTime" | "correct" | "responded">[] {
  const trials: Omit<SimonTrial, "responseTime" | "correct" | "responded">[] = [];
  const colors: SimonColor[] = ["green", "red"];
  const sides: SimonSide[] = ["left", "right"];

  // Ensure ~50% congruent
  for (let i = 0; i < count; i++) {
    const color = colors[Math.floor(Math.random() * 2)];
    const isCongruent = i % 2 === 0; // alternate to ensure balance
    let position: SimonSide;

    if (isCongruent) {
      // Congruent: green-left or red-right
      position = color === "green" ? "left" : "right";
    } else {
      // Incongruent: green-right or red-left
      position = color === "green" ? "right" : "left";
    }

    trials.push({
      trialNumber: i + 1,
      color,
      position,
      isCongruent,
    });
  }

  // Shuffle
  for (let i = trials.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [trials[i], trials[j]] = [trials[j], trials[i]];
  }

  // Re-number after shuffle
  return trials.map((t, i) => ({ ...t, trialNumber: i + 1 }));
}

export function computeSimonResults(trials: SimonTrial[]) {
  const validTrials = trials.filter((t) => t.responded && t.responseTime !== null);
  const correctTrials = validTrials.filter((t) => t.correct);
  const congruent = correctTrials.filter((t) => t.isCongruent);
  const incongruent = correctTrials.filter((t) => !t.isCongruent);

  const avgRT = correctTrials.length > 0
    ? correctTrials.reduce((s, t) => s + (t.responseTime || 0), 0) / correctTrials.length
    : 0;

  const avgCongruent = congruent.length > 0
    ? congruent.reduce((s, t) => s + (t.responseTime || 0), 0) / congruent.length
    : 0;

  const avgIncongruent = incongruent.length > 0
    ? incongruent.reduce((s, t) => s + (t.responseTime || 0), 0) / incongruent.length
    : 0;

  const simonEffect = avgIncongruent - avgCongruent;
  const accuracy = validTrials.length > 0 ? correctTrials.length / validTrials.length : 0;
  const errorRate = 1 - accuracy;

  return {
    avgRT: Math.round(avgRT),
    avgCongruent: Math.round(avgCongruent),
    avgIncongruent: Math.round(avgIncongruent),
    simonEffect: Math.round(simonEffect),
    accuracy: Math.round(accuracy * 100),
    errorRate: Math.round(errorRate * 100),
    totalTrials: trials.length,
    correctCount: correctTrials.length,
    missedCount: trials.filter((t) => !t.responded).length,
  };
}
