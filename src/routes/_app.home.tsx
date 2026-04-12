import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Brain, TrendingUp, Zap, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="px-5 pt-12 pb-4">
      {/* Header */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6"
      >
        <p className="text-sm text-muted-foreground">Bienvenue 👋</p>
        <h1 className="text-2xl font-bold text-foreground">CogniRaja</h1>
      </motion.div>

      {/* SGS Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6 rounded-2xl bg-primary p-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-primary-foreground/70">Score Global (SGS)</p>
            <p className="text-4xl font-bold text-primary-foreground">--</p>
            <p className="mt-1 text-xs text-primary-foreground/60">Passe tes premiers tests</p>
          </div>
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/15">
            <Brain className="h-8 w-8 text-primary-foreground" />
          </div>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-6 grid grid-cols-2 gap-3"
      >
        <div className="rounded-xl border border-border bg-card p-4">
          <Zap className="mb-2 h-5 w-5 text-accent" />
          <p className="text-2xl font-bold text-foreground">0</p>
          <p className="text-xs text-muted-foreground">Tests passés</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <TrendingUp className="mb-2 h-5 w-5 text-primary" />
          <p className="text-2xl font-bold text-foreground">0</p>
          <p className="text-xs text-muted-foreground">Exercices faits</p>
        </div>
      </motion.div>

      {/* CTA */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <Link
          to="/tests"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-colors active:bg-muted"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Commencer un test</p>
              <p className="text-xs text-muted-foreground">Évalue tes capacités cognitives</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      </motion.div>
    </div>
  );
}
