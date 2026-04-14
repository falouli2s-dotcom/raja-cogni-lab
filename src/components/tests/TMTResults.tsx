import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { Clock, AlertTriangle, ArrowLeft, RotateCcw, GitBranch } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TMTCombinedResults } from "@/lib/tmt-engine";
import { interpretRatioBA } from "@/lib/tmt-engine";

interface TMTResultsProps {
  results: TMTCombinedResults;
}

export function TMTResults({ results }: TMTResultsProps) {
  const { partA, partB, ratioBA } = results;
  const interpretation = interpretRatioBA(ratioBA);

  const formatTime = (ms: number) => (ms / 1000).toFixed(1);

  return (
    <div className="min-h-screen bg-background px-5 pt-12 pb-24">
      <Link
        to="/tests"
        className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour aux tests
      </Link>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col items-center text-center"
      >
        <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-chart-3/10">
          <GitBranch className="h-10 w-10 text-chart-3" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Résultats TMT</h1>
        <p className="mt-1 text-sm text-muted-foreground">Trail Making Test — Parties A & B</p>
      </motion.div>

      {/* Ratio B/A — main metric */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-6 rounded-2xl border border-border bg-card p-6 text-center"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Ratio B/A
        </p>
        <p className={`mt-1 text-4xl font-bold ${interpretation.color}`}>
          {ratioBA.toFixed(2)}
        </p>
        <p className={`mt-1 text-sm font-medium ${interpretation.color}`}>
          {interpretation.label}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {ratioBA <= 2.5
            ? "Bonne flexibilité cognitive"
            : "La flexibilité cognitive peut être améliorée"}
        </p>
      </motion.div>

      {/* Part A & B details */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <p className="text-xs font-medium text-muted-foreground">Partie A</p>
          <div className="mt-2 flex items-end gap-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground">
              {formatTime(partA.completionTime)}
            </p>
            <span className="mb-0.5 text-xs text-muted-foreground">s</span>
          </div>
          {partA.errors > 0 && (
            <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" /> {partA.errors} erreur(s)
            </div>
          )}
        </motion.div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <p className="text-xs font-medium text-muted-foreground">Partie B</p>
          <div className="mt-2 flex items-end gap-1">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <p className="text-2xl font-bold text-foreground">
              {formatTime(partB.completionTime)}
            </p>
            <span className="mb-0.5 text-xs text-muted-foreground">s</span>
          </div>
          {partB.errors > 0 && (
            <div className="mt-1 flex items-center gap-1 text-xs text-destructive">
              <AlertTriangle className="h-3 w-3" /> {partB.errors} erreur(s)
            </div>
          )}
        </motion.div>
      </div>

      {/* Interpretation */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mt-4 rounded-xl border border-border bg-secondary/50 p-4"
      >
        <p className="text-sm font-medium text-foreground">Interprétation</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Un ratio B/A &le; 2.5 indique une bonne flexibilité cognitive.
          Un ratio &gt; 2.5 suggère des difficultés à alterner entre deux types d'informations.
          Le nombre d'erreurs reflète la capacité de contrôle inhibiteur.
        </p>
      </motion.div>

      {/* Actions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6 flex flex-col gap-3"
      >
        <Link to="/tests">
          <Button className="h-12 w-full" variant="outline">
            <RotateCcw className="mr-2 h-4 w-4" /> Refaire le test
          </Button>
        </Link>
        <Link to="/tests">
          <Button className="h-12 w-full">Retour aux tests</Button>
        </Link>
      </motion.div>
    </div>
  );
}
