import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Brain, Clock, Zap, GitBranch, Eye, Layers, TrendingUp, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { RadarChart } from "@/components/RadarChart";
import { getSessionHistory, type SessionData } from "@/lib/session-manager";
import { getGlobalStatus, getStatusColor, type SGSResult } from "@/lib/sgs-engine";

export const Route = createFileRoute("/_app/sessions/$sessionId")({
  component: SessionDetailPage,
});

const dimensionIcons: Record<string, typeof Brain> = {
  reactionTime: Clock,
  inhibition: Zap,
  workingMemory: Brain,
  flexibility: GitBranch,
  perception: Eye,
  dualTask: Layers,
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

function SessionDetailPage() {
  const { sessionId } = Route.useParams();
  const [session, setSession] = useState<SessionData | null>(null);
  const [prevSession, setPrevSession] = useState<SessionData | null>(null);

  useEffect(() => {
    const history = getSessionHistory();
    const idx = history.findIndex(s => s.sessionId === sessionId);
    if (idx !== -1) {
      setSession(history[idx]);
      // Previous completed session for comparison
      if (idx + 1 < history.length) {
        setPrevSession(history[idx + 1]);
      }
    }
  }, [sessionId]);

  if (!session?.sgs) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Session introuvable</p>
      </div>
    );
  }

  const sgs = session.sgs;
  const globalStatus = getGlobalStatus(sgs.global);
  const recommendations = getRecommendations(sgs);
  const formatDate = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="px-5 pt-12 pb-24">
      <Link to="/sessions" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
        <ArrowLeft className="h-4 w-4" /> Retour à l'historique
      </Link>

      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground">Session du {formatDate(session.startedAt)}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{session.results.length}/3 tests complétés</p>
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
        {prevSession?.sgs && (
          <div className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            {sgs.global > prevSession.sgs.global ? (
              <>
                <ArrowUpRight className="h-3.5 w-3.5 text-primary" />
                <span className="text-primary">+{sgs.global - prevSession.sgs.global} vs session précédente</span>
              </>
            ) : sgs.global < prevSession.sgs.global ? (
              <>
                <ArrowDownRight className="h-3.5 w-3.5 text-destructive" />
                <span className="text-destructive">{sgs.global - prevSession.sgs.global} vs session précédente</span>
              </>
            ) : (
              <>
                <Minus className="h-3.5 w-3.5" />
                <span>Stable vs session précédente</span>
              </>
            )}
          </div>
        )}
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

      {/* Dimensions with comparison */}
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
            const prevDim = prevSession?.sgs?.dimensions.find(d => d.key === dim.key);
            const diff = prevDim ? dim.score - prevDim.score : null;
            return (
              <div key={dim.key} className="flex items-center gap-3 rounded-xl border border-border bg-card p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-foreground">{dim.label}</p>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-bold ${statusColor}`}>{dim.score}/100</p>
                      {diff !== null && diff !== 0 && (
                        <span className={`flex items-center text-xs font-medium ${diff > 0 ? "text-primary" : "text-destructive"}`}>
                          {diff > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {Math.abs(diff)}
                        </span>
                      )}
                    </div>
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
    </div>
  );
}
