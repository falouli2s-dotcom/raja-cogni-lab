import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pause, Play, SkipForward, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import type { Exercice } from "@/routes/_app.exercises";

interface Props {
  exercice: Exercice;
  onClose: () => void;
}

type Phase = "serie" | "recovery" | "done";

export function parseDuration(s: string): number {
  if (!s) return 60;
  // "1min30" or "1m30s"
  const minSec = s.match(/(\d+)\s*m(?:in)?\s*(\d+)\s*s?/i);
  if (minSec) return parseInt(minSec[1]) * 60 + parseInt(minSec[2]);
  // "1min" or "1 min"
  const minOnly = s.match(/(\d+)\s*m(?:in)?$/i);
  if (minOnly) return parseInt(minOnly[1]) * 60;
  // "45s" or "45"
  const secOnly = s.match(/(\d+)\s*s?$/i);
  if (secOnly) return parseInt(secOnly[1]);
  return 60;
}

export function ExercisePlayer({ exercice: ex, onClose }: Props) {
  const totalSeries = ex.series;
  const serieDuration = parseDuration(ex.duree_serie);
  const recoveryDuration = ex.recuperation_secondes;

  const [currentSerie, setCurrentSerie] = useState(1);
  const [phase, setPhase] = useState<Phase>("serie");
  const [timeLeft, setTimeLeft] = useState(serieDuration);
  const [paused, setPaused] = useState(false);

  const phaseDuration = phase === "serie" ? serieDuration : recoveryDuration;
  const progress = phaseDuration > 0 ? ((phaseDuration - timeLeft) / phaseDuration) * 100 : 0;

  const circumference = 2 * Math.PI * 90;
  const strokeOffset = circumference - (progress / 100) * circumference;

  const handleComplete = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("completed_exercises" as any).insert({
          user_id: user.id,
          exercise_id: ex.id,
          series_completed: totalSeries,
          completed_at: new Date().toISOString(),
        } as any);
      }
    } catch {
      // table may not exist yet
    }
  }, [ex.id, totalSeries]);

  useEffect(() => {
    if (phase === "done" || paused) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (phase === "serie") {
            if (currentSerie < totalSeries) {
              setPhase("recovery");
              return recoveryDuration;
            } else {
              setPhase("done");
              handleComplete();
              return 0;
            }
          } else {
            // recovery done → next serie
            setCurrentSerie((s) => s + 1);
            setPhase("serie");
            return serieDuration;
          }
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, paused, currentSerie, totalSeries, recoveryDuration, serieDuration, handleComplete]);

  const skipPhase = () => {
    if (phase === "serie") {
      if (currentSerie < totalSeries) {
        setPhase("recovery");
        setTimeLeft(recoveryDuration);
      } else {
        setPhase("done");
        handleComplete();
      }
    } else if (phase === "recovery") {
      setCurrentSerie((s) => s + 1);
      setPhase("serie");
      setTimeLeft(serieDuration);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className={`fixed inset-0 z-[60] flex flex-col ${
          phase === "recovery" ? "bg-amber-500/10" : phase === "done" ? "bg-background" : "bg-primary/5"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-sm font-semibold text-foreground truncate pr-4">
            #{ex.numero} {ex.titre}
          </h2>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-muted shrink-0">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {phase === "done" ? (
          /* Completion screen */
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 15 }}
            >
              <CheckCircle2 className="h-24 w-24 text-primary" />
            </motion.div>
            <h2 className="text-2xl font-bold text-foreground">Exercice terminé !</h2>
            <p className="text-muted-foreground text-center">
              {totalSeries} série{totalSeries > 1 ? "s" : ""} complétée{totalSeries > 1 ? "s" : ""}
            </p>
            <Button onClick={onClose} className="w-full max-w-xs h-12 text-base font-semibold mt-4">
              Fermer
            </Button>
          </div>
        ) : (
          <>
            {/* Center */}
            <div className="flex-1 flex flex-col items-center justify-center gap-4 px-6">
              <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {phase === "serie"
                  ? `Série ${currentSerie} / ${totalSeries}`
                  : "Récupération"}
              </p>
              {phase === "recovery" && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Repos actif</p>
              )}

              {/* Timer circle */}
              <div className="relative w-52 h-52">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
                  <circle
                    cx="100" cy="100" r="90"
                    fill="none"
                    stroke="currentColor"
                    className="text-muted/30"
                    strokeWidth="6"
                  />
                  <circle
                    cx="100" cy="100" r="90"
                    fill="none"
                    stroke="currentColor"
                    className={phase === "recovery" ? "text-amber-500" : "text-primary"}
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeOffset}
                    style={{ transition: "stroke-dashoffset 0.5s ease" }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-6xl font-bold tabular-nums text-foreground">
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-xs">
                <Progress value={progress} className="h-2" />
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 pb-8 flex gap-3">
              <Button
                variant="outline"
                className="flex-1 h-12 text-base"
                onClick={() => setPaused((p) => !p)}
              >
                {paused ? <Play className="h-5 w-5 mr-2" /> : <Pause className="h-5 w-5 mr-2" />}
                {paused ? "Reprendre" : "Pause"}
              </Button>
              <Button
                variant="secondary"
                className="h-12 px-6"
                onClick={skipPhase}
              >
                <SkipForward className="h-5 w-5 mr-1" />
                Skip
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
