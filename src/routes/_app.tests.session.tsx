import { createFileRoute } from "@tanstack/react-router";
import { SessionProvider, useSession } from "@/lib/session-manager";
import { SessionStartScreen } from "@/components/session/SessionStartScreen";
import { TestTransitionScreen } from "@/components/session/TestTransitionScreen";
import { SessionResultsScreen } from "@/components/session/SessionResultsScreen";
import { SimonTest } from "@/components/tests/SimonTest";
import { NBackTest } from "@/components/tests/NBackTest";
import { TMTTest } from "@/components/tests/TMTTest";
import { computeSimonResults } from "@/lib/simon-engine";
import { computeNBackResults } from "@/lib/nback-engine";
import type { SimonTrial } from "@/lib/simon-engine";
import type { NBackTrial } from "@/lib/nback-engine";
import type { TMTCombinedResults } from "@/lib/tmt-engine";
import type { TestResult } from "@/lib/session-manager";

export const Route = createFileRoute("/_app/tests/session")({
  component: () => (
    <SessionProvider>
      <SessionOrchestrator />
    </SessionProvider>
  ),
});

function SessionOrchestrator() {
  const { step, getCurrentTest, completeTest } = useSession();

  if (step === "start") {
    return <SessionStartScreen />;
  }

  if (step === "transition") {
    return <TestTransitionScreen />;
  }

  if (step === "final-results") {
    return <SessionResultsScreen />;
  }

  // step === "running-test"
  const currentTest = getCurrentTest();
  if (!currentTest) return null;

  if (currentTest.id === "simon") {
    return (
      <SimonTest
        onComplete={(results, rawTrials) => {
          const testResult: TestResult = {
            testId: "simon",
            data: results,
            rawTrials,
            completedAt: new Date().toISOString(),
          };
          completeTest(testResult);
        }}
      />
    );
  }

  if (currentTest.id === "nback") {
    return (
      <NBackTest
        onComplete={(results, rawTrials) => {
          const testResult: TestResult = {
            testId: "nback",
            data: results,
            rawTrials,
            completedAt: new Date().toISOString(),
          };
          completeTest(testResult);
        }}
      />
    );
  }

  if (currentTest.id === "tmt") {
    return (
      <TMTTest
        onComplete={(results: TMTCombinedResults) => {
          const testResult: TestResult = {
            testId: "tmt",
            data: results,
            completedAt: new Date().toISOString(),
          };
          completeTest(testResult);
        }}
      />
    );
  }

  return null;
}
