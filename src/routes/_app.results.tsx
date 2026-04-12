import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/_app/results")({
  component: ResultsPage,
});

function ResultsPage() {
  return (
    <div className="px-5 pt-12 pb-4">
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h1 className="text-2xl font-bold text-foreground">Résultats</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Historique et évolution de tes scores
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
          <BarChart3 className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Aucun résultat</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Passe ton premier test pour voir tes résultats ici
          </p>
        </div>
      </motion.div>
    </div>
  );
}
