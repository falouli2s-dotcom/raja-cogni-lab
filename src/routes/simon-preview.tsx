import { createFileRoute } from "@tanstack/react-router";
import { SimonResults } from "@/components/tests/SimonResults";

export const Route = createFileRoute("/simon-preview")({
  component: () => (
    <SimonResults
      results={{
        avgRT: 486,
        avgCongruent: 452,
        avgIncongruent: 531,
        simonEffect: 79,
        accuracy: 93,
        errorRate: 7,
        totalTrials: 40,
        correctCount: 37,
        missedCount: 1,
      }}
      onContinue={() => undefined}
    />
  ),
});
