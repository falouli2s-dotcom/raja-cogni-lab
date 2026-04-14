import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { CheckCircle, Clock, Target, Zap, TrendingUp, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SimonResultsProps {
  results: {
    avgRT: number;
    avgCongruent: number;
    avgIncongruent: number;
    simonEffect: number;
    accuracy: number;
    errorRate: number;
    totalTrials: number;
    correctCount: number;
    missedCount: number;
  };
}

function getSimonEffectLabel(effect: number): { label: string; color: string; desc: string } {
  if (effect <= 30) return { label: "Excellent", color: "text-primary", desc: "Très bonne inhibition" };
  if (effect <= 60) return { label: "Bon", color: "text-primary", desc: "Bonne capacité d'inhibition" };
  if (effect <= 80) return { label: "Moyen", color: "text-accent", desc: "Inhibition à travailler" };
  return { label: "À améliorer", color: "text-destructive", desc: "Effet Simon > 80ms — Inhibition faible" };
}

export function SimonResults({ results }: SimonResultsProps) {
  const interpretation = getSimonEffectLabel(results.simonEffect);

  const stats = [
    { icon: Clock, label: "Temps moyen", value: `${results.avgRT}ms`, sub: "Tous essais corrects" },
    { icon: Zap, label: "Effet Simon", value: `${results.simonEffect}ms`, sub: interpretation.desc },
    { icon: Target, label: "Précision", value: `${results.accuracy}%`, sub: `${results.correctCount}/${results.totalTrials} corrects` },
    { icon: TrendingUp, label: "Congruent", value: `${results.avgCongruent}ms`, sub: "Moyenne essais congruents" },
    { icon: TrendingUp, label: "Incongruent", value: `${results.avgIncongruent}ms`, sub: "Moyenne essais incongruents" },
  ];

  return (
    <div className="min-h-screen bg-background px-5 pt-12 pb-24">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="flex flex-col items-center text-center"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
          <CheckCircle className="h-10 w-10 text-primary" />
        </div>
        <h1 className="mt-4 text-2xl font-bold text-foreground">Test terminé !</h1>
        <p className="mt-1 text-sm text-muted-foreground">Tâche de Simon — Résultats</p>
      </motion.div>

      {/* Interpretation card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-6 rounded-2xl bg-primary p-5 text-center"
      >
        <p className="text-sm text-primary-foreground/70">Effet Simon</p>
        <p className="text-4xl font-bold text-primary-foreground">{results.simonEffect}ms</p>
        <p className={`mt-1 text-sm font-semibold ${interpretation.color === "text-primary" ? "text-primary-foreground" : "text-primary-foreground/80"}`}>
          {interpretation.label}
        </p>
      </motion.div>

      {/* Stats grid */}
      <div className="mt-6 grid grid-cols-2 gap-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 + i * 0.05 }}
              className={`rounded-xl border border-border bg-card p-4 ${i === stats.length - 1 ? "col-span-2" : ""}`}
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
        <Link to="/sessions">
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
