import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, Brain, Zap, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession, type TestResult, type SimonResultData, type NBackResultData } from "@/lib/session-manager";
import type { TMTCombinedResults } from "@/lib/tmt-engine";

const testIcons: Record<string, typeof Brain> = {
  simon: Zap,
  nback: Brain,
  tmt: GitBranch,
};

function getResultSummary(result: TestResult): string {
  switch (result.testId) {
    case "simon": {
      const d = result.data as SimonResultData;
      return `Précision ${d.accuracy.toFixed(0)}% · TR moyen ${d.avgRT.toFixed(0)}ms`;
    }
    case "nback": {
      const d = result.data as NBackResultData;
      return `Précision ${d.accuracy.toFixed(0)}% · d' = ${d.dPrime.toFixed(2)}`;
    }
    case "tmt": {
      const d = result.data as TMTCombinedResults;
      return `Ratio B/A = ${d.ratioBA.toFixed(2)} · A: ${(d.partA.completionTime / 1000).toFixed(1)}s · B: ${(d.partB.completionTime / 1000).toFixed(1)}s`;
    }
    default:
      return "";
  }
}

export function TestTransitionScreen() {
  const { session, proceedToNextTest, getNextTest, currentTestIndex } = useSession();
  const lastResult = session?.results[session.results.length - 1];
  const nextTest = getNextTest();

  if (!lastResult || !nextTest) return null;

  const CompletedIcon = testIcons[lastResult.testId] || Brain;
  const NextIcon = testIcons[nextTest.id] || Brain;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-5">
      {/* Completed test result */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 text-center"
      >
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle className="h-7 w-7 text-primary" />
        </div>
        <p className="text-lg font-bold text-foreground">Test terminé !</p>
        <div className="mt-2 flex items-center justify-center gap-2">
          <CompletedIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">
            {session?.results.length || 0}/{3} tests complétés
          </span>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{getResultSummary(lastResult)}</p>
      </motion.div>

      {/* Next test */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6 w-full max-w-sm rounded-2xl border border-border bg-card p-5"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Test suivant
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <NextIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-foreground">{nextTest.name}</p>
            <p className="text-xs text-muted-foreground">{nextTest.description} · {nextTest.duration}</p>
          </div>
        </div>
      </motion.div>

      {/* Continue button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 w-full max-w-sm"
      >
        <Button onClick={proceedToNextTest} className="h-14 w-full text-base font-semibold" size="lg">
          Test Suivant <ArrowRight className="ml-2 h-5 w-5" />
        </Button>
      </motion.div>
    </div>
  );
}
