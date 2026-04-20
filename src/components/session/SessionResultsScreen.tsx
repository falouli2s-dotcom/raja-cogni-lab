import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { Brain, Clock, Zap, GitBranch, Eye, Crosshair, TrendingUp, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadarChart } from "@/components/RadarChart";
import { useSession, saveSessionToHistory } from "@/lib/session-manager";
import { getGlobalStatus, getStatusColor, type SGSResult } from "@/lib/sgs-engine";
import { supabase } from "@/integrations/supabase/client";
import type { SimonResultData, NBackResultData } from "@/lib/session-manager";
import type { TMTCombinedResults } from "@/lib/tmt-engine";

const dimensionIcons: Record<string, typeof Brain> = {
  reactionTime: Clock,
  inhibition: Zap,
  workingMemory: Brain,
  flexibility: GitBranch,
  attention: Eye,
  anticipation: Crosshair,
};

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

export function SessionResultsScreen() {
  const navigate = useNavigate();
  const { session, finishSession, resetSession } = useSession();
  const [sgs, setSgs] = useState<SGSResult | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!sgs && session) {
      const result = finishSession();
      setSgs(result);
    }
  }, []);

  // Save to DB and localStorage once
  useEffect(() => {
    if (!sgs || !session || saved) return;
    setSaved(true);

    // Save to localStorage
    saveSessionToHistory({ ...session, sgs, status: "completed", completedAt: new Date().toISOString() });

    // Save to Supabase
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        for (const result of session.results) {
          const { data: dbSession } = await supabase
            .from("sessions_test")
            .insert({
              user_id: user.id,
              test_type: result.testId,
              score_global: result.testId === "simon" ? (result.data as SimonResultData).accuracy
                : result.testId === "nback" ? (result.data as NBackResultData).accuracy
                : (result.data as TMTCombinedResults).ratioBA,
              duree_totale: 0,
              donnees_brutes: { sessionId: session.sessionId, data: result.data } as any,
            })
            .select()
            .single();

          if (dbSession) {
            const details = result.testId === "simon" ? {
              avg_rt: (result.data as SimonResultData).avgRT,
              avg_congruent: (result.data as SimonResultData).avgCongruent,
              avg_incongruent: (result.data as SimonResultData).avgIncongruent,
              accuracy: (result.data as SimonResultData).accuracy,
            } : result.testId === "nback" ? {
              hits: (result.data as NBackResultData).hits,
              misses: (result.data as NBackResultData).misses,
              false_alarms: (result.data as NBackResultData).falseAlarms,
              correct_rejections: (result.data as NBackResultData).correctRejections,
              accuracy: (result.data as NBackResultData).accuracy,
              d_prime: (result.data as NBackResultData).dPrime,
              avg_rt: (result.data as NBackResultData).avgRT,
            } : {
              time_a: (result.data as TMTCombinedResults).partA.completionTime,
              time_b: (result.data as TMTCombinedResults).partB.completionTime,
              errors_a: (result.data as TMTCombinedResults).partA.errors,
              errors_b: (result.data as TMTCombinedResults).partB.errors,
            };

            await supabase.from("resultats_test").insert({
              session_id: dbSession.id,
              user_id: user.id,
              test_type: result.testId,
              metrique: result.testId === "simon" ? "simon_effect"
                : result.testId === "nback" ? "target_error_rate"
                : "ratio_ba",
              valeur: result.testId === "simon" ? (result.data as SimonResultData).simonEffect
                : result.testId === "nback" ? (result.data as NBackResultData).targetErrorRate
                : (result.data as TMTCombinedResults).ratioBA,
              unite: result.testId === "tmt" ? "ratio" : result.testId === "simon" ? "ms" : "%",
              details: details as any,
            });
          }
        }
      } catch (e) {
        console.warn("Could not save session:", e);
      }
    })();
  }, [sgs, session, saved]);

  if (!sgs) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const globalStatus = getGlobalStatus(sgs.global);
  const recommendations = getRecommendations(sgs);

  const handleFinish = () => {
    resetSession();
    navigate({ to: "/home", replace: true });
  };

  return (
    <div className="min-h-screen bg-background px-5 pt-12 pb-24">
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground">Session terminée !</h1>
        <p className="mt-1 text-sm text-muted-foreground">Voici ton profil cognitif complet</p>
      </motion.div>

      {/* SGS Global */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-6 rounded-2xl border border-border bg-card p-6 text-center"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Score Global Synthétique</p>
        <div className="mt-3 flex items-baseline justify-center gap-1">
          <span className="text-5xl font-bold text-foreground">{sgs.global}</span>
          <span className="text-lg text-muted-foreground">/100</span>
        </div>
        <p className={`mt-1 text-sm font-semibold ${globalStatus.color}`}>{globalStatus.label}</p>
      </motion.div>

      {/* Radar */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 rounded-2xl border border-border bg-card p-4"
      >
        <p className="mb-2 text-center text-sm font-semibold text-foreground">Profil cognitif</p>
        <RadarChart dimensions={sgs.dimensions} size={280} />
      </motion.div>

      {/* Dimensions */}
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
              <div key={dim.key} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
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
          {recommendations.map((rec, i) => (
            <div key={i} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
              <TrendingUp className="h-4 w-4 shrink-0 text-accent" />
              <p className="text-sm text-foreground">{rec}</p>
            </div>
          ))}
          {recommendations.length === 0 && (
            <p className="text-sm text-muted-foreground">Tous tes scores sont bons ! Continue comme ça. 🎉</p>
          )}
        </div>
      </motion.div>

      {/* Finish button */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8"
      >
        <Button onClick={handleFinish} className="h-14 w-full text-base font-semibold" size="lg">
          <Home className="mr-2 h-5 w-5" /> Terminer
        </Button>
      </motion.div>
    </div>
  );
}
