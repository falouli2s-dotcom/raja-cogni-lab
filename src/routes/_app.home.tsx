import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  ChevronRight,
  BarChart3,
  ClipboardList,
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Dumbbell,
  Target,
  Flame,
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type DimensionScore = {
  key: string;
  label: string;
  score: number;
};

type SGSData = {
  global: number;
  dimensions: DimensionScore[];
};

type SessionData = {
  sessionId: string;
  startedAt: string;
  sgs: SGSData | null;
  score_global: number | null;
};
import { NotificationBell } from "@/components/NotificationBell";

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
});

const PROFILE_BANNER_DISMISS_KEY = "cogni_profile_banner_dismissed";

const DIM_LABELS: Record<string, string> = {
  reactionTime: "Réaction",
  flexibility: "Flexibilité",
  workingMemory: "Mémoire",
  inhibition: "Inhibition",
  attention: "Attention",
  anticipation: "Anticipation",
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Bon matin";
  if (h < 18) return "Bon après-midi";
  return "Bonsoir";
}

function scoreLabel(score: number): string {
  if (score >= 70) return "Élevé";
  if (score >= 40) return "Moyen";
  return "À travailler";
}

function barColor(score: number): string {
  if (score >= 70) return "bg-emerald-400";
  if (score >= 40) return "bg-amber-400";
  return "bg-rose-400";
}

function scoreTextColor(score: number): string {
  if (score >= 70) return "text-emerald-300";
  if (score >= 40) return "text-amber-300";
  return "text-rose-300";
}

function buildSGS(session: any): SGSData | null {
  if (!session) return null;
  const global = session.score_global;
  if (global === null || global === undefined) return null;
  const brutes = session.donnees_brutes;
  const dimensions: DimensionScore[] =
    brutes?.dimensions ?? brutes?.sgs?.dimensions ?? [];
  const dims =
    dimensions.length > 0
      ? dimensions
      : Object.keys(DIM_LABELS).map((key) => ({
          key,
          label: DIM_LABELS[key],
          score: 0,
        }));
  return {
    global: Math.round(Number(global)),
    dimensions: dims,
  };
}

function HomePage() {
  const [lastSession, setLastSession] = useState<SessionData | null>(null);
  const [prevSession, setPrevSession] = useState<SessionData | null>(null);
  const [showProfileBanner, setShowProfileBanner] = useState(false);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [position, setPosition] = useState<string | null>(null);
  const [totalSessions, setTotalSessions] = useState<number>(0);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: prof } = await supabase
        .from("profiles")
        .select("position, full_name")
        .eq("id", user.id)
        .maybeSingle();

      if (prof?.full_name) {
        setPlayerName(prof.full_name.trim().split(/\s+/)[0]);
      }
      if (prof?.position) {
        setPosition(prof.position);
        localStorage.removeItem(PROFILE_BANNER_DISMISS_KEY);
      } else {
        const dismissed = localStorage.getItem(PROFILE_BANNER_DISMISS_KEY) === "1";
        if (!dismissed) setShowProfileBanner(true);
      }

      const { data: sessions } = await supabase
        .from("sessions_test")
        .select("id, created_at, score_global, donnees_brutes")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      const completed = sessions ?? [];
      setTotalSessions(completed.length);

      if (completed.length === 0) return;

      const last = completed[0];
      setLastSession({
        sessionId: last.id,
        startedAt: last.created_at,
        sgs: buildSGS(last),
        score_global: last.score_global,
      });

      if (completed.length >= 2) {
        const prev = completed[1];
        setPrevSession({
          sessionId: prev.id,
          startedAt: prev.created_at,
          sgs: buildSGS(prev),
          score_global: prev.score_global,
        });
      }
    })();
  }, []);

  function dismissBanner() {
    setShowProfileBanner(false);
    localStorage.setItem(PROFILE_BANNER_DISMISS_KEY, "1");
  }

  const sgs = lastSession?.sgs;
  const prevSgs = prevSession?.sgs;
  const hasDelta =
    !!sgs &&
    !!prevSgs &&
    typeof sgs.global === "number" &&
    typeof prevSgs.global === "number";
  const delta = hasDelta ? sgs!.global - prevSgs!.global : null;

  const weakDimensions = sgs
    ? [...sgs.dimensions].sort((a, b) => a.score - b.score).slice(0, 3)
    : [];
  const showRecommendations = sgs && weakDimensions.some(d => d.score < 50);

  const greeting = getGreeting();

  return (
    <div className="px-5 pt-12 pb-4">
      {/* Header */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 flex items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">
            {greeting}{playerName ? `, ${playerName}` : ""} 👋
          </p>
          <h1 className="text-2xl font-bold text-foreground">CogniRaja</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {position && (
            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              {position}
            </span>
          )}
          <NotificationBell />
        </div>
      </motion.div>

      {/* First-time profile completion banner */}
      <AnimatePresence>
        {showProfileBanner && (
          <motion.div
            initial={{ y: -10, opacity: 0, height: 0 }}
            animate={{ y: 0, opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0, marginBottom: 0 }}
            className="mb-4 overflow-hidden rounded-2xl border border-accent/30 bg-accent/10 p-4"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent/20">
                <ClipboardList className="h-4 w-4 text-accent" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">
                  Complète ton profil joueur pour des recommandations personnalisées selon ton poste !
                </p>
                <Link
                  to="/profile"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent"
                >
                  → Compléter le profil
                </Link>
              </div>
              <button
                onClick={dismissBanner}
                aria-label="Fermer"
                className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors active:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SGS Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6 rounded-2xl bg-primary p-5"
      >
        {sgs ? (
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-primary-foreground/70">Score Global (SGS)</p>
                <div className="mt-1 flex items-baseline gap-1">
                  <p className="text-5xl font-bold leading-none text-primary-foreground tabular-nums">
                    {sgs.global}
                  </p>
                  <span className="text-sm text-primary-foreground/60">/100</span>
                </div>
                <p className="mt-2 text-xs text-primary-foreground/60">
                  {new Date(lastSession!.startedAt).toLocaleDateString("fr-FR", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                  })}
                </p>
                <div className="mt-2 flex items-center gap-1">
                  {delta === null ? (
                    <>
                      <Minus className="h-3.5 w-3.5 text-primary-foreground/40" />
                      <span className="text-xs font-semibold text-primary-foreground/50">
                        — pas de session précédente
                      </span>
                    </>
                  ) : delta > 0 ? (
                    <>
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
                      <span className="text-xs font-semibold text-emerald-300">
                        +{delta} vs session précédente
                      </span>
                    </>
                  ) : delta < 0 ? (
                    <>
                      <TrendingDown className="h-3.5 w-3.5 text-rose-300" />
                      <span className="text-xs font-semibold text-rose-300">
                        {delta} vs session précédente
                      </span>
                    </>
                  ) : (
                    <>
                      <Minus className="h-3.5 w-3.5 text-primary-foreground/50" />
                      <span className="text-xs font-semibold text-primary-foreground/50">
                        0 vs session précédente
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15">
                <Brain className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>

            {/* Mini-bars per dimension */}
            <div className="mt-4 border-t border-primary-foreground/20 pt-4">
              <div className="flex flex-col gap-2">
                {sgs.dimensions.map((d, i) => (
                  <div key={d.key} className="flex items-center gap-2">
                    <span className="w-20 shrink-0 text-xs text-primary-foreground/60">
                      {DIM_LABELS[d.key] ?? d.label}
                    </span>
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary-foreground/10">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${d.score}%` }}
                        transition={{ duration: 0.7, delay: 0.3 + i * 0.05 }}
                        className={`h-full rounded-full ${barColor(d.score)}`}
                      />
                    </div>
                    <span className={`w-8 text-right text-xs font-bold tabular-nums ${scoreTextColor(d.score)}`}>
                      {d.score}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <Link
              to="/sessions"
              className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-primary-foreground"
            >
              Rapport complet <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm text-primary-foreground/70">Score Global (SGS)</p>
              <p className="mt-1 text-4xl font-bold text-primary-foreground">--</p>
              <p className="mt-2 max-w-[180px] text-xs text-primary-foreground/60">
                Lance ta première session pour découvrir ton profil cognitif
              </p>
              <Link
                to="/tests"
                className="mt-3 inline-flex items-center gap-1 rounded-xl bg-primary-foreground/15 px-3 py-1.5 text-xs font-semibold text-primary-foreground"
              >
                Commencer <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15">
              <Brain className="h-7 w-7 text-primary-foreground" />
            </div>
          </div>
        )}
      </motion.div>

      {/* Quick Stats — 3 columns */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-6 grid grid-cols-3 gap-3"
      >
        <div className="rounded-xl border border-border bg-card p-4">
          <Flame className="mb-2 h-5 w-5 text-orange-400" />
          <p className="text-2xl font-bold text-foreground tabular-nums">
            {totalSessions > 0 ? totalSessions : sgs ? "1+" : "0"}
          </p>
          <p className="text-xs text-muted-foreground">Sessions</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Dumbbell className="mb-2 h-5 w-5 text-primary" />
          <p className="text-2xl font-bold text-foreground tabular-nums">0</p>
          <p className="text-xs text-muted-foreground">Exercices</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <Target className="mb-2 h-5 w-5 text-accent" />
          <p className="text-2xl font-bold text-foreground">
            {sgs ? scoreLabel(sgs.global) : "--"}
          </p>
          <p className="text-xs text-muted-foreground">Niveau</p>
        </div>
      </motion.div>

      {/* Recommended exercises */}
      {showRecommendations && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="mb-4 rounded-2xl border border-border bg-card p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Exercices recommandés</p>
            <Link to="/exercises" className="text-xs font-semibold text-accent">
              Voir tout
            </Link>
          </div>
          {weakDimensions.map((d, i) => (
            <motion.div
              key={d.key}
              initial={{ x: -10, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 0.3 + i * 0.07 }}
              className="mb-2 flex items-center gap-3 rounded-xl bg-muted/40 p-3 last:mb-0"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-500/10">
                <Dumbbell className="h-4 w-4 text-rose-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground">
                  {DIM_LABELS[d.key] ?? d.label}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Score {d.score}/100 · {scoreLabel(d.score)}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* CTA */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex flex-col gap-3"
      >
        <Link
          to="/tests"
          className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-colors active:bg-muted"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                {sgs ? "Nouvelle session" : "Démarrer l'évaluation"}
              </p>
              <p className="text-xs text-muted-foreground">3 tests · ~20 minutes</p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>

        {lastSession && (
          <Link
            to="/sessions"
            className="flex items-center justify-between rounded-2xl border border-border bg-card p-5 transition-colors active:bg-muted"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/10">
                <BarChart3 className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Historique</p>
                <p className="text-xs text-muted-foreground">Voir ta progression dans le temps</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        )}
      </motion.div>
    </div>
  );
}
