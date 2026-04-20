import { createFileRoute, Link } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, TrendingUp, Zap, ChevronRight, BarChart3, ClipboardList, X } from "lucide-react";
import { useState, useEffect } from "react";
import { getLastSession, type SessionData } from "@/lib/session-manager";
import { getGlobalStatus } from "@/lib/sgs-engine";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
});

const PROFILE_BANNER_DISMISS_KEY = "cogni_profile_banner_dismissed";

function HomePage() {
  const [lastSession, setLastSession] = useState<SessionData | null>(null);
  const [showProfileBanner, setShowProfileBanner] = useState(false);

  useEffect(() => {
    setLastSession(getLastSession());

    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("position")
        .eq("id", user.id)
        .maybeSingle();
      if (!prof?.position) {
        setShowProfileBanner(true);
      } else {
        localStorage.removeItem(PROFILE_BANNER_DISMISS_KEY);
      }
    })();
  }, []);

  function dismissBanner() {
    setShowProfileBanner(false);
    localStorage.setItem(PROFILE_BANNER_DISMISS_KEY, "1");
  }

  const sgs = lastSession?.sgs;
  const weakDimensions = sgs?.dimensions
    .filter(d => d.score < 50)
    .sort((a, b) => a.score - b.score)
    .slice(0, 2) ?? [];

  return (
    <div className="px-5 pt-12 pb-4">
      {/* Header */}
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6"
      >
        <p className="text-sm text-muted-foreground">Bienvenue 👋</p>
        <h1 className="text-2xl font-bold text-foreground">CogniRaja</h1>
      </motion.div>

      {/* Last session SGS Card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-6 rounded-2xl bg-primary p-5"
      >
        {sgs ? (
          <div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-primary-foreground/70">Score Global (SGS)</p>
                <p className="text-4xl font-bold text-primary-foreground">{sgs.global}</p>
                <p className="mt-1 text-xs text-primary-foreground/60">
                  {new Date(lastSession!.startedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
                </p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/15">
                <Brain className="h-8 w-8 text-primary-foreground" />
              </div>
            </div>
            {weakDimensions.length > 0 && (
              <div className="mt-3 border-t border-primary-foreground/20 pt-3">
                <p className="text-xs font-medium text-primary-foreground/70">Points à améliorer</p>
                <div className="mt-1 flex flex-col gap-1">
                  {weakDimensions.map(d => (
                    <div key={d.key} className="flex items-center justify-between">
                      <span className="text-xs text-primary-foreground/80">{d.label}</span>
                      <span className="text-xs font-bold text-primary-foreground">{d.score}/100</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <Link
              to="/sessions/$sessionId"
              params={{ sessionId: lastSession!.sessionId }}
              className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary-foreground"
            >
              Voir les détails <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-primary-foreground/70">Score Global (SGS)</p>
              <p className="text-4xl font-bold text-primary-foreground">--</p>
              <p className="mt-1 text-xs text-primary-foreground/60">Passe ta première session</p>
            </div>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-foreground/15">
              <Brain className="h-8 w-8 text-primary-foreground" />
            </div>
          </div>
        )}
      </motion.div>

      {/* Quick Stats */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mb-6 grid grid-cols-2 gap-3"
      >
        <div className="rounded-xl border border-border bg-card p-4">
          <Zap className="mb-2 h-5 w-5 text-accent" />
          <p className="text-2xl font-bold text-foreground">{sgs ? "1+" : "0"}</p>
          <p className="text-xs text-muted-foreground">Sessions passées</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <TrendingUp className="mb-2 h-5 w-5 text-primary" />
          <p className="text-2xl font-bold text-foreground">0</p>
          <p className="text-xs text-muted-foreground">Exercices faits</p>
        </div>
      </motion.div>

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
              <p className="font-semibold text-foreground">Nouvelle session</p>
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
                <p className="text-xs text-muted-foreground">Voir toutes tes sessions</p>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        )}
      </motion.div>
    </div>
  );
}
