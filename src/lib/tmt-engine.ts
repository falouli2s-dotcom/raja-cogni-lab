// Trail Making Test Engine
// Part A: 1→2→3→...→25 (numbers only)
// Part B: 1→A→2→B→3→C→...→13 (alternating numbers and letters)

export interface TMTNode {
  id: string;
  label: string;
  x: number;
  y: number;
  order: number; // 0-based order in the correct sequence
}

export interface TMTConfig {
  trainingNodesA: number;
  trainingNodesB: number;
  realNodesA: number;
  realNodesB: number;
  nodeRadius: number;
  minDistance: number;
}

export const TMT_CONFIG: TMTConfig = {
  trainingNodesA: 8,
  trainingNodesB: 8,
  realNodesA: 25,
  realNodesB: 25, // 13 numbers + 12 letters = 25 nodes
  nodeRadius: 22,
  minDistance: 60,
};

export interface TMTResult {
  part: "A" | "B";
  completionTime: number; // ms
  errors: number;
  nodesCompleted: number;
  totalNodes: number;
}

export interface TMTCombinedResults {
  partA: TMTResult;
  partB: TMTResult;
  ratioBA: number; // partB.completionTime / partA.completionTime
}

/**
 * Generate the correct sequence of labels for a TMT part.
 */
export function generateSequence(part: "A" | "B", count: number): string[] {
  if (part === "A") {
    return Array.from({ length: count }, (_, i) => String(i + 1));
  }
  // Part B: 1, A, 2, B, 3, C, ...
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const seq: string[] = [];
  const numCount = Math.ceil(count / 2);
  const letterCount = Math.floor(count / 2);
  for (let i = 0; i < numCount; i++) {
    seq.push(String(i + 1));
    if (i < letterCount) {
      seq.push(letters[i]);
    }
  }
  return seq.slice(0, count);
}

/**
 * Place nodes randomly in a grid area, ensuring minimum distance between nodes.
 */
export function generateNodes(
  part: "A" | "B",
  count: number,
  width: number,
  height: number
): TMTNode[] {
  const sequence = generateSequence(part, count);
  const padding = TMT_CONFIG.nodeRadius + 10;
  const minDist = TMT_CONFIG.minDistance;
  const nodes: TMTNode[] = [];

  for (let i = 0; i < sequence.length; i++) {
    let x: number, y: number;
    let attempts = 0;
    const maxAttempts = 500;

    do {
      x = padding + Math.random() * (width - 2 * padding);
      y = padding + Math.random() * (height - 2 * padding);
      attempts++;
    } while (
      attempts < maxAttempts &&
      nodes.some(
        (n) => Math.hypot(n.x - x, n.y - y) < minDist
      )
    );

    nodes.push({
      id: `node-${i}`,
      label: sequence[i],
      x,
      y,
      order: i,
    });
  }

  return nodes;
}

/**
 * Compute combined results and B/A ratio.
 */
export function computeTMTResults(
  partA: TMTResult,
  partB: TMTResult
): TMTCombinedResults {
  return {
    partA,
    partB,
    ratioBA: partA.completionTime > 0
      ? partB.completionTime / partA.completionTime
      : 0,
  };
}

/**
 * Qualitative interpretation of B/A ratio.
 */
export function interpretRatioBA(ratio: number): {
  label: string;
  color: string;
} {
  if (ratio <= 2.0) return { label: "Excellent", color: "text-primary" };
  if (ratio <= 2.5) return { label: "Normal", color: "text-chart-3" };
  if (ratio <= 3.0) return { label: "Limite", color: "text-accent" };
  return { label: "À améliorer", color: "text-destructive" };
}
