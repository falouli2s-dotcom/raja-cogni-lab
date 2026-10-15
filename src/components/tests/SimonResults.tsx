import { motion } from "framer-motion";
import { Link } from "@tanstack/react-router";
import { CheckCircle, Clock, Target, Zap, ArrowRight } from "lucide-react";
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
  /** When provided, a single "Continuer" button replaces the navigation links. */
  onContinue?: () => void;
}

function getSimonEffectLabel(effect: number): { label: string; color: string; desc: string } {
  if (effect <= 30) return { label: "Excellent", color: "text-primary", desc: "Très bonne inhibition" };
  if (effect <= 60) return { label: "Bon", color: "text-primary", desc: "Bonne capacité d'inhibition" };
  if (effect <= 80) return { label: "Moyen", color: "text-accent", desc: "Inhibition à travailler" };
  return { label: "À améliorer", color: "text-destructive", desc: "Effet Simon > 80ms — Inhibition faible" };
}

export function SimonResults({ results, onContinue }: SimonResultsProps) {
  const interpretation = getSimonEffectLabel(results.simonEffect);
  const maxRT = Math.max(results.avgCongruent, results.avgIncongruent, 1);

  const bars = [
    {
      label: "Essais congruents",
      sub: "Couleur et côté du même côté",
      value: results.avgCongruent,
      barClass: "bg-primary",
      textClass: "text-primary",
    },
    {
      label: "Essais incongruents",
      sub: "Couleur et côté opposés",
      value: results.avgIncongruent,
      barClass: "bg-accent",
      textClass: "text-accent",
    },
  ];

  const stats = [
    { icon: Clock, label: "Temps moyen", value: `${results.avgRT}ms`, sub: "Tous essais corrects" },
    { icon: Target, label: "Précision", value: `${results.accuracy}%`, sub: `${results.correctCount}/${results.totalTrials} corrects` },
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
        <p className="text-4xl font-bold text-primary-foreground">
          {results.simonEffect >= 0 ? "+" : ""}
          {results.simonEffect}ms
        </p>
        <p className={`mt-1 text-sm font-semibold text-primary-foreground/80`}>{interpretation.label}</p>
        <p className="mt-1 text-xs text-primary-foreground/60">{interpretation.desc}</p>
      </motion.div>

      {/* Congruent vs Incongruent reaction times */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="mt-4 rounded-2xl border border-border bg-card p-5"
      >
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Temps de réaction moyen
          </p>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          {bars.map((b, i) => (
            <motion.div
              key={b.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.08 }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">{b.label}</p>
                <p className={`text-lg font-bold ${b.textClass}`}>{b.value}ms</p>
              </div>
              <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max((b.value / maxRT) * 100, 2)}%` }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                  className={`h-full rounded-full ${b.barClass}`}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{b.sub}</p>
            </motion.div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            Effet Simon = incongruent − congruent
          </p>
          <p className="text-sm font-bold text-foreground">
            {results.simonEffect >= 0 ? "+" : ""}
            {results.simonEffect}ms
          </p>
        </div>
      </motion.div>

      {/* Stats grid */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.35 + i * 0.05 }}
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
        transition={{ delay: 0.45 }}
        className="mt-8 flex flex-col gap-3"
      >
        {onContinue ? (
          <Button onClick={onContinue} className="h-12 w-full text-base font-semibold">
            Continuer <ArrowRight className="ms-2 h-4 w-4" />
          </Button>
        ) : (
          <>
            <Link to="/sessions">
              <Button className="h-12 w-full text-base font-semibold">
                Voir mes résultats <ArrowRight className="ms-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/tests">
              <Button variant="outline" className="h-12 w-full text-base">
                Retour aux tests
              </Button>
            </Link>
          </>
        )}
      </motion.div>
    </div>
  );
}
