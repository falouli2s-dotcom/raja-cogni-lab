import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Brain, Zap, GitBranch, Clock, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/tests/")({
  component: TestsPage,
});

const tests = [
  {
    id: "simon",
    name: "Tâche de Simon",
    description: "Inhibition & Temps de réaction",
    icon: Zap,
    duration: "~5 min",
    trials: "30 essais",
    color: "text-accent",
    bgColor: "bg-accent/10",
  },
  {
    id: "nback",
    name: "N-Back 2",
    description: "Mémoire de travail",
    icon: Brain,
    duration: "~8 min",
    trials: "80 stimuli",
    color: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    id: "tmt",
    name: "Trail Making Test",
    description: "Flexibilité cognitive",
    icon: GitBranch,
    duration: "~6 min",
    trials: "Parties A & B",
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
  },
];

function TestsPage() {
  return (
    <div className="px-5 pt-12 pb-4">
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h1 className="text-2xl font-bold text-foreground">Tests Cognitifs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisis un test pour évaluer tes capacités
        </p>
      </motion.div>

      <div className="mt-6 flex flex-col gap-3">
        {tests.map((test, i) => {
          const Icon = test.icon;
          return (
            <motion.div
              key={test.id}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.1 * (i + 1) }}
            >
              <Link
                to="/tests/$testId"
                params={{ testId: test.id }}
                className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors active:bg-muted"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${test.bgColor}`}>
                  <Icon className={`h-6 w-6 ${test.color}`} />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">{test.name}</p>
                  <p className="text-xs text-muted-foreground">{test.description}</p>
                  <div className="mt-1 flex items-center gap-3">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {test.duration}
                    </span>
                    <span className="text-xs text-muted-foreground">{test.trials}</span>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
