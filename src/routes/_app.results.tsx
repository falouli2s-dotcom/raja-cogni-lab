import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Brain, Zap, GitBranch, Eye, Layers, Clock, ChevronRight, TrendingUp } from "lucide-react";
import { RadarChart } from "@/components/RadarChart";
import { computeSGS, getGlobalStatus, getStatusColor, type TestScores, type SGSResult } from "@/lib/sgs-engine";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/results")({
  component: ResultsPage,
});

const dimensionIcons: Record<string, typeof Brain> = {
  reactionTime: Clock,
  inhibition: Zap,
  workingMemory: Brain,
  flexibility: GitBranch,
  perception: Eye,
  dualTask: Layers,
};

function ResultsPage() {
  const [sgs, setSgs] = useState<SGSResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadResults();
  }, []);

  async function loadResults() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Try to fetch latest results from DB
      const scores: TestScores = {};

      try {
        // Get latest Simon result
        const { data: simonData } = await (supabase as any)
          .from("resultats_test")
          .select("details")
          .eq("user_id", user.id)
          .eq("test_type", "simon")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (simonData?.details) {
          scores.simon = {
            avgRT: simonData.details.avg_rt,
            simonEffect: simonData.details.avg_incongruent - simonData.details.avg_congruent,
            accuracy: simonData.details.accuracy,
          };
        }
      } catch {}

      try {
        // Get latest N-Back result
        const { data: nbackData } = await (supabase as any)
          .from("resultats_test")
          .select("details")
          .eq("user_id", user.id)
          .eq("test_type", "nback")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (nbackData?.details) {
          scores.nback = {
            accuracy: nbackData.details.accuracy,
            targetErrorRate: nbackData.details.misses / (nbackData.details.hits + nbackData.details.misses) * 100,
            dPrime: nbackData.details.d_prime,
          };
        }
      } catch {}

      try {
        // Get latest TMT result
        const { data: tmtData } = await (supabase as any)
          .from("resultats_test")
          .select("details, valeur")
          .eq("user_id", user.id)
          .eq("test_type", "tmt")
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (tmtData?.details) {
          scores.tmt = {
            ratioBA: tmtData.valeur,
            timeA: tmtData.details.time_a,
            timeB: tmtData.details.time_b,
          };
        }
      } catch {}

      const hasAnyScore = scores.simon || scores.nback || scores.tmt;
      if (hasAnyScore) {
        setSgs(computeSGS(scores));
      }
    } catch (e) {
      console.warn("Could not load results:", e);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!sgs) {
    return (
      <div className="px-5 pt-12 pb-24">
        <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
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
          <Link
            to="/tests"
            className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            Passer un test
          </Link>
        </motion.div>
      </div>
    );
  }

  const globalStatus = getGlobalStatus(sgs.global);

  return (
    <div className="px-5 pt-12 pb-24">
      {/* Header */}
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground">Résultats</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ton profil cognitif synthétique
        </p>
      </motion.div>

      {/* SGS Global Score */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-6 rounded-2xl border border-border bg-card p-6 text-center"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Score Global Synthétique
        </p>
        <div className="mt-3 flex items-baseline justify-center gap-1">
          <span className="text-5xl font-bold text-foreground">{sgs.global}</span>
          <span className="text-lg text-muted-foreground">/100</span>
        </div>
        <p className={`mt-1 text-sm font-semibold ${globalStatus.color}`}>
          {globalStatus.label}
        </p>
      </motion.div>

      {/* Radar Chart */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 rounded-2xl border border-border bg-card p-4"
      >
        <p className="mb-2 text-center text-sm font-semibold text-foreground">
          Profil cognitif
        </p>
        <RadarChart dimensions={sgs.dimensions} size={280} />
      </motion.div>

      {/* Dimension Details */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6"
      >
        <h2 className="mb-3 text-lg font-semibold text-foreground">Détail par dimension</h2>
        <div className="flex flex-col gap-3">
          {sgs.dimensions.map((dim) => {
            const Icon = dimensionIcons[dim.key] || Brain;
            const statusColor = getStatusColor(dim.status);
            return (
              <div
                key={dim.key}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{dim.label}</p>
                    <p className={`text-sm font-bold ${statusColor}`}>{dim.score}/100</p>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${dim.score}%` }}
                      transition={{ duration: 0.8, delay: 0.4 }}
                    />
                  </div>
                  {dim.raw !== undefined && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Valeur brute : {typeof dim.raw === "number" ? dim.raw.toFixed(1) : dim.raw} {dim.unit}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Recommendations */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="mt-6"
      >
        <h2 className="mb-3 text-lg font-semibold text-foreground">Recommandations</h2>
        <div className="flex flex-col gap-2">
          {getRecommendations(sgs).map((rec, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
            >
              <TrendingUp className="h-4 w-4 shrink-0 text-accent" />
              <p className="text-sm text-foreground">{rec}</p>
            </div>
          ))}
          {getRecommendations(sgs).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Tous tes scores sont bons ! Continue comme ça. 🎉
            </p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function getRecommendations(sgs: SGSResult): string[] {
  const recs: string[] = [];
  for (const dim of sgs.dimensions) {
    if (dim.key === "reactionTime" && dim.raw && dim.raw > 450) {
      recs.push("Travaille ta vitesse de réaction avec des exercices de rapidité");
    }
    if (dim.key === "inhibition" && dim.raw && dim.raw > 80) {
      recs.push("Renforce ton inhibition avec des exercices de contrôle attentionnel");
    }
    if (dim.key === "workingMemory" && dim.score < 70) {
      recs.push("Entraîne ta mémoire de travail avec des exercices N-Back progressifs");
    }
    if (dim.key === "flexibility" && dim.raw && dim.raw > 2.5) {
      recs.push("Améliore ta flexibilité cognitive avec des exercices d'alternance");
    }
  }
  return recs;
}
