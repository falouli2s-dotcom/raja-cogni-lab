import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { CheckCircle, Brain, Target, Zap, AlertTriangle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NBackResultsProps {
  results: {
    hits: number;
    misses: number;
    falseAlarms: number;
    correctRejections: number;
    accuracy: number;
    errorRate: number;
    targetErrorRate: number;
    avgRT: number;
    dPrime: number;
    totalTrials: number;
    totalTargets: number;
  };
}

function getPerformanceLabel(errorRate: number): { label: string; color: string; desc: string } {
  if (errorRate <= 15) return { label: "Excellent", color: "text-primary", desc: "Très bonne mémoire de travail" };
  if (errorRate <= 25) return { label: "Bon", color: "text-primary", desc: "Bonne mémoire de travail" };
  if (errorRate <= 30) return { label: "Moyen", color: "text-accent", desc: "Mémoire de travail à renforcer" };
  return { label: "À améliorer", color: "text-destructive", desc: "Erreurs > 30% — Entraînement recommandé" };
}

export function NBackResults({ results }: NBackResultsProps) {
  const interpretation = getPerformanceLabel(results.targetErrorRate);

  const stats = [
    { icon: Target, label: "Précision globale", value: `${results.accuracy}%`, sub: `d' = ${results.dPrime}` },
    { icon: Zap, label: "Temps moyen (hits)", value: `${results.avgRT}ms`, sub: "Sur les bonnes détections" },
    { icon: CheckCircle, label: "Hits", value: `${results.hits}/${results.totalTargets}`, sub: "Cibles détectées" },
    { icon: AlertTriangle, label: "Fausses alarmes", value: `${results.falseAlarms}`, sub: "Réponses incorrectes" },
  ];

  return (
    <div className="min-h-screen bg-background px-5 pt-12 pb-24">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center text-center"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <Brain className="h-10 w-10 text-primary" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Test terminé !</h1>
        <p className="mt-1 text-sm text-muted-foreground">N-Back 2 — Résultats</p>
      </motion.div>

      {/* Main metric */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-6 rounded-2xl bg-primary p-5 text-center"
      >
        <p className="text-sm text-primary-foreground/70">Erreurs sur cibles</p>
        <p className="text-4xl font-bold text-primary-foreground">{results.targetErrorRate}%</p>
        <p className="mt-1 text-sm font-semibold text-primary-foreground/80">
          {interpretation.label}
        </p>
      </motion.div>

      {/* Stats */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className="rounded-xl border border-border bg-card p-4"
            >
              <Icon className="mb-1 h-4 w-4 text-muted-foreground" />
              <p className="text-xl font-bold text-foreground">{stat.value}</p>
              <p className="text-xs font-medium text-foreground">{stat.label}</p>
              <p className="text-xs text-muted-foreground">{stat.sub}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Actions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-8 flex flex-col gap-3"
      >
        <Link to="/results">
          <Button className="h-12 w-full text-base font-semibold">
            Voir mes résultats <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <Link to="/tests">
          <Button variant="outline" className="h-12 w-full text-base">
            Retour aux tests
          </Button>
        </Link>
      </motion.div>
    </div>
  );
}
