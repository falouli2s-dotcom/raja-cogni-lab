import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Brain, Zap, GitBranch, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";

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
    <div className="px-5 pt-12 pb-24">
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h1 className="text-2xl font-bold text-foreground">Évaluation Cognitive</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Passe les 3 tests en une seule session (~20 min)
        </p>
      </motion.div>

      {/* Test overview */}
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
              <div className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
                  {i + 1}
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${test.bgColor}`}>
                  <Icon className={`h-5 w-5 ${test.color}`} />
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
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Start session */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8"
      >
        <Link to="/tests/session">
          <Button className="h-14 w-full text-base font-semibold" size="lg">
            <Play className="mr-2 h-5 w-5" /> Démarrer la Session
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
