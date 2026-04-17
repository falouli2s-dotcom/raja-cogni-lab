export interface NBackTrial {
  trialNumber: number;
  letter: string;
  isTarget: boolean;
  response: "yes" | "no" | null; // user response
  correct: boolean | null;
  responseTime: number | null;
  responded: boolean;
}

export interface NBackConfig {
  trainingTrials: number;
  realTrials: number;
  nLevel: number;
  targetPercentage: number; // 0.25 = 25%
  stimulusDuration: number; // ms to show letter
  isiDuration: number; // inter-stimulus interval (blank)
  responseLimitDuration: number; // total time per trial (stimulus + isi)
}

export const NBACK_CONFIG: NBackConfig = {
  trainingTrials: 10,
  realTrials: 40,
  nLevel: 2,
  targetPercentage: 0.25,
  stimulusDuration: 1500,
  isiDuration: 500,
  responseLimitDuration: 2000, // stimulus + isi combined
};

const LETTERS = "BCDFGHJKLMNPQRSTVWXYZ".split("");

function randomLetter(exclude?: string): string {
  const available = exclude ? LETTERS.filter((l) => l !== exclude) : LETTERS;
  return available[Math.floor(Math.random() * available.length)];
}

export function generateNBackTrials(count: number, nLevel: number, targetPct: number): Omit<NBackTrial, "response" | "correct" | "responseTime" | "responded">[] {
  const trials: Omit<NBackTrial, "response" | "correct" | "responseTime" | "responded">[] = [];
  const targetCount = Math.round(count * targetPct);

  // Decide which trial indices will be targets (must be >= nLevel)
  const possibleTargetIndices: number[] = [];
  for (let i = nLevel; i < count; i++) {
    possibleTargetIndices.push(i);
  }

  // Shuffle and pick targetCount indices
  for (let i = possibleTargetIndices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [possibleTargetIndices[i], possibleTargetIndices[j]] = [possibleTargetIndices[j], possibleTargetIndices[i]];
  }
  const targetIndices = new Set(possibleTargetIndices.slice(0, targetCount));

  // Generate letters
  const letters: string[] = [];
  for (let i = 0; i < count; i++) {
    if (targetIndices.has(i) && i >= nLevel) {
      // Target: same letter as n positions back
      letters.push(letters[i - nLevel]);
    } else {
      // Non-target: different from n positions back
      const excludeLetter = i >= nLevel ? letters[i - nLevel] : undefined;
      letters.push(randomLetter(excludeLetter));
    }
  }

  for (let i = 0; i < count; i++) {
    trials.push({
      trialNumber: i + 1,
      letter: letters[i],
      isTarget: targetIndices.has(i),
    });
  }

  return trials;
}

export function computeNBackResults(trials: NBackTrial[]) {
  const targetTrials = trials.filter((t) => t.isTarget);
  const nonTargetTrials = trials.filter((t) => !t.isTarget);

  // Hits: target trials where user said "yes"
  const hits = targetTrials.filter((t) => t.response === "yes").length;
  // Misses: target trials where user said "no" or didn't respond
  const misses = targetTrials.length - hits;
  // False alarms: non-target trials where user said "yes"
  const falseAlarms = nonTargetTrials.filter((t) => t.response === "yes").length;
  // Correct rejections: non-target trials where user said "no" or didn't respond
  const correctRejections = nonTargetTrials.length - falseAlarms;

  const totalCorrect = hits + correctRejections;
  const accuracy = trials.length > 0 ? (totalCorrect / trials.length) * 100 : 0;
  const errorRate = 100 - accuracy;

  // Error rate specifically for targets (miss rate)
  const targetErrorRate = targetTrials.length > 0
    ? (misses / targetTrials.length) * 100
    : 0;

  // Average RT for hits only
  const hitTrials = targetTrials.filter((t) => t.response === "yes" && t.responseTime !== null);
  const avgRT = hitTrials.length > 0
    ? hitTrials.reduce((s, t) => s + (t.responseTime || 0), 0) / hitTrials.length
    : 0;

  // d-prime approximation (sensitivity)
  const hitRate = Math.min(Math.max(hits / Math.max(targetTrials.length, 1), 0.01), 0.99);
  const faRate = Math.min(Math.max(falseAlarms / Math.max(nonTargetTrials.length, 1), 0.01), 0.99);

  // Z-score approximation using probit
  function zScore(p: number): number {
    // Rational approximation of inverse normal CDF
    const a = [
      -3.969683028665376e1, 2.209460984245205e2,
      -2.759285104469687e2, 1.383577518672690e2,
      -3.066479806614716e1, 2.506628277459239e0,
    ];
    const b = [
      -5.447609879822406e1, 1.615858368580409e2,
      -1.556989798598866e2, 6.680131188771972e1,
      -1.328068155288572e1,
    ];
    const c = [
      -7.784894002430293e-3, -3.223964580411365e-1,
      -2.400758277161838e0, -2.549732539343734e0,
      4.374664141464968e0, 2.938163982698783e0,
    ];
    const d = [
      7.784695709041462e-3, 3.224671290700398e-1,
      2.445134137142996e0, 3.754408661907416e0,
    ];
    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q: number, r: number;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
        (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
  }

  const dPrime = Number((zScore(hitRate) - zScore(faRate)).toFixed(2));

  return {
    hits,
    misses,
    falseAlarms,
    correctRejections,
    accuracy: Math.round(accuracy),
    errorRate: Math.round(errorRate),
    targetErrorRate: Math.round(targetErrorRate),
    avgRT: Math.round(avgRT),
    dPrime,
    totalTrials: trials.length,
    totalTargets: targetTrials.length,
  };
}
