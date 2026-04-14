import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, Clock, ChevronRight, ArrowLeft } from "lucide-react";
import { getSessionHistory, type SessionData } from "@/lib/session-manager";
import { getGlobalStatus } from "@/lib/sgs-engine";

export const Route = createFileRoute("/_app/sessions/")({
  component: SessionHistoryPage,
});

function SessionHistoryPage() {
  const [sessions, setSessions] = useState<SessionData[]>([]);

  useEffect(() => {
    setSessions(getSessionHistory());
  }, []);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div className="px-5 pt-12 pb-24">
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <Link to="/profile" className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour au profil
        </Link>
        <h1 className="text-2xl font-bold text-foreground">Historique des Sessions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {sessions.length} session{sessions.length !== 1 ? "s" : ""} enregistrée{sessions.length !== 1 ? "s" : ""}
        </p>
      </motion.div>

      {sessions.length === 0 ? (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-border bg-card p-8 text-center"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <BarChart3 className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="font-semibold text-foreground">Aucune session</p>
          <p className="text-sm text-muted-foreground">Passe ta première session d'évaluation</p>
          <Link to="/tests" className="mt-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground">
            Commencer
          </Link>
        </motion.div>
      ) : (
        <div className="mt-6 flex flex-col gap-3">
          {sessions.map((s, i) => {
            const sgsScore = s.sgs?.global ?? 0;
            const status = getGlobalStatus(sgsScore);
            const isComplete = s.status === "completed";
            return (
              <motion.div
                key={s.sessionId}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.05 * i }}
              >
                <Link
                  to="/sessions/$sessionId"
                  params={{ sessionId: s.sessionId }}
                  className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4 transition-colors active:bg-muted"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                    sgsScore >= 70 ? "bg-primary/10" : sgsScore >= 40 ? "bg-accent/10" : "bg-destructive/10"
                  }`}>
                    <span className={`text-lg font-bold ${status.color}`}>{sgsScore}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-foreground">{formatDate(s.startedAt)}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        isComplete ? "bg-primary/10 text-primary" : "bg-accent/10 text-accent"
                      }`}>
                        {isComplete ? "Complétée" : "Incomplète"}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(s.startedAt)}</span>
                      <span>· {s.results.length}/3 tests</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
