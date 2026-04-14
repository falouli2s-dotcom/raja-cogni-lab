import { motion } from "framer-motion";
import { Brain, Zap, GitBranch, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SESSION_TESTS, useSession } from "@/lib/session-manager";

const testIcons: Record<string, typeof Brain> = {
  simon: Zap,
  nback: Brain,
  tmt: GitBranch,
};

const testColors: Record<string, { text: string; bg: string }> = {
  simon: { text: "text-accent", bg: "bg-accent/10" },
  nback: { text: "text-primary", bg: "bg-primary/10" },
  tmt: { text: "text-chart-3", bg: "bg-chart-3/10" },
};

export function SessionStartScreen() {
  const { startSession } = useSession();

  return (
    <div className="min-h-screen bg-background px-5 pt-12 pb-24">
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground">Évaluation Cognitive</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Passe les 3 tests pour obtenir ton profil cognitif complet
        </p>
      </motion.div>

      {/* Duration */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-muted p-3"
      >
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Durée estimée : ~20 minutes</span>
      </motion.div>

      {/* Test list */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 flex flex-col gap-3"
      >
        {SESSION_TESTS.map((test, i) => {
          const Icon = testIcons[test.id] || Brain;
          const colors = testColors[test.id];
          return (
            <div
              key={test.id}
              className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-bold text-foreground">
                {i + 1}
              </div>
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colors.bg}`}>
                <Icon className={`h-5 w-5 ${colors.text}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-foreground">{test.name}</p>
                <p className="text-xs text-muted-foreground">{test.description} · {test.duration}</p>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Info */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6 rounded-xl border border-border bg-secondary/50 p-4"
      >
        <p className="text-sm text-muted-foreground">
          Chaque test inclut une phase d'entraînement obligatoire. Tu ne peux pas revenir en arrière ni passer un test.
        </p>
      </motion.div>

      {/* Start */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8"
      >
        <Button onClick={startSession} className="h-14 w-full text-base font-semibold" size="lg">
          <Play className="mr-2 h-5 w-5" /> Démarrer la Session
        </Button>
      </motion.div>
    </div>
  );
}
