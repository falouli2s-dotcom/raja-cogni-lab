import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { Brain, Clock, Zap, GitBranch, Eye, TrendingUp, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadarChart } from "@/components/RadarChart";
import { useSession, saveSessionToHistory } from "@/lib/session-manager";
import { getGlobalStatus, getStatusColor, type SGSResult } from "@/lib/sgs-engine";
import { supabase } from "@/integrations/supabase/client";
import type { SimonResultData, NBackResultData } from "@/lib/session-manager";
import type { TMTCombinedResults } from "@/lib/tmt-engine";
import { useT } from "@/locales/translations";

const dimensionIcons: Record<string, typeof Brain> = {
  reactionTime: Clock,
  inhibition: Zap,
  workingMemory: Brain,
  flexibility: GitBranch,
  vitesse_visuo_perceptuelle: Eye,
};

function getRecommendations(sgs: SGSResult, t: ReturnType<typeof useT>): string[] {
  const recs: string[] = [];
  for (const dim of sgs.dimensions) {
    if (dim.key === "reactionTime" && dim.raw && dim.raw > 450) {
      recs.push(t.session.rec1);
    }
    if (dim.key === "inhibition" && dim.raw && dim.raw > 80) {
      recs.push(t.session.rec2);
    }
    if (dim.key === "workingMemory" && dim.score < 70) {
      recs.push(t.session.rec3);
    }
    if (dim.key === "flexibility" && dim.raw && dim.raw > 2.5) {
      recs.push(t.session.rec4);
    }
  }
  return recs;
}

export function SessionResultsScreen() {
  const navigate = useNavigate();
  const t = useT();
  const dimLabelMap: Record<string, string> = {
    reactionTime: t.dimensions.reactionTime,
    inhibition: t.dimensions.inhibition,
    workingMemory: t.dimensions.workingMemory,
    flexibility: t.dimensions.flexibility,
    vitesse_visuo_perceptuelle: t.dimensions.vitesseVisuoPerceptuelle,
  };
  const { session, finishSession, resetSession } = useSession();
  const [sgs, setSgs] = useState<SGSResult | null>(null);
  const savedRef = useRef(false);

  useEffect(() => {
    if (!sgs && session) {
      const result = finishSession();
      setSgs(result);
    }
  }, []);

  // Save to DB and localStorage once
  useEffect(() => {
    if (!sgs || !session || savedRef.current) return;
    savedRef.current = true;

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
              // Store the unified SGS global (0-100) on every row of the same
              // session so coach-side averages match the player-side SGS.
              score_global: sgs.global,
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
              raw_trials: (result.rawTrials ?? []).map((t: any) => ({
                trialNumber: t.trialNumber,
                type: t.isCongruent ? "Congruent" : "Incongruent",
                stimulus: t.color === "green" ? "Vert" : "Rouge",
                side: t.position === "left" ? "Gauche" : "Droite",
                response: t.responded
                  ? (t.correct ? (t.color === "green" ? "Vert" : "Rouge") : (t.color === "green" ? "Rouge" : "Vert"))
                  : "—",
                rt: t.responseTime,
                correct: !!t.correct,
              })),
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

            // Build per-metric rows. The DB trigger `recompute_sgs_after_insert`
            // reads these rows by exact `metrique` strings to compute SGS.
            // The first row of each test also carries the legacy summary
            // `details` payload consumed by other screens.
            type MetricRow = { metrique: string; valeur: number; unite: string };
            let metricRows: MetricRow[] = [];

            if (result.testId === "simon") {
              const d = result.data as SimonResultData;
              metricRows = [
                { metrique: "avgRT", valeur: d.avgRT, unite: "ms" },
                { metrique: "simonEffect", valeur: d.simonEffect, unite: "ms" },
                { metrique: "incongruentErrorRate", valeur: d.incongruentErrorRate, unite: "ratio" },
              ];
            } else if (result.testId === "nback") {
              const d = result.data as NBackResultData;
              metricRows = [
                { metrique: "dPrime", valeur: d.dPrime, unite: "z" },
                { metrique: "falseAlarms", valeur: d.falseAlarms, unite: "count" },
                { metrique: "totalTrials", valeur: d.totalTrials, unite: "count" },
                { metrique: "totalTargets", valeur: d.totalTargets, unite: "count" },
                { metrique: "target_error_rate", valeur: d.targetErrorRate, unite: "%" }, // legacy summary
              ];
            } else {
              const d = result.data as TMTCombinedResults;
              metricRows = [
                { metrique: "ratioBA", valeur: d.ratioBA, unite: "ratio" },
                { metrique: "timeA", valeur: d.partA.completionTime, unite: "ms" },
                { metrique: "partAErrors", valeur: d.partA.errors, unite: "count" },
              ];
            }

            const rowsToInsert = metricRows.map((m, i) => ({
              session_id: dbSession.id,
              user_id: user.id,
              test_type: result.testId,
              metrique: m.metrique,
              valeur: m.valeur,
              unite: m.unite,
              // Attach the rich `details` payload only on the first row to
              // avoid duplicating it across every metric row.
              details: i === 0 ? (details as any) : null,
            }));

            await supabase.from("resultats_test").insert(rowsToInsert);
          }
        }

        // Mark the oldest pending planned "session" (full cognitive battery,
        // test_type IS NULL) as completed. The DB trigger only handles
        // single-test planned sessions, so we cover the full-session case
        // explicitly here.
        const { data: pendingSession } = await supabase
          .from("sessions_planifiees")
          .select("id")
          .eq("player_id", user.id)
          .eq("status", "pending")
          .eq("session_category", "session")
          .is("test_type", null)
          .order("scheduled_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (pendingSession) {
          await supabase
            .from("sessions_planifiees")
            .update({ status: "completed" })
            .eq("id", pendingSession.id);
        }
      } catch (e) {
        console.warn("Could not save session:", e);
      }
    })();
  }, [sgs, session]);

  if (!sgs) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const globalStatus = getGlobalStatus(sgs.global);
  const recommendations = getRecommendations(sgs, t);

  const handleFinish = () => {
    resetSession();
    navigate({ to: "/home", replace: true });
  };

  return (
    <div className="min-h-screen bg-background px-5 pt-12 pb-24">
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground">{t.session.sessionFinished}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t.session.hereIsYourProfile}</p>
      </motion.div>

      {/* SGS Global */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-6 rounded-2xl border border-border bg-card p-6 text-center"
      >
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t.session.sgsTitle}</p>
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
        <p className="mb-2 text-center text-sm font-semibold text-foreground">{t.session.cognitiveProfile}</p>
        <RadarChart dimensions={sgs.dimensions} size={280} />
      </motion.div>

      {/* Dimensions */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6"
      >
        <h2 className="mb-3 text-lg font-semibold text-foreground">{t.session.detailByDimension}</h2>
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
                    <p className="text-sm font-semibold text-foreground">{dimLabelMap[dim.key] ?? dim.label}</p>
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
                      {t.session.rawValue} {typeof dim.raw === "number" ? dim.raw.toFixed(1) : dim.raw} {dim.unit}
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
          <Home className="me-2 h-5 w-5" /> {t.session.finish}
        </Button>
      </motion.div>
    </div>
  );
}
