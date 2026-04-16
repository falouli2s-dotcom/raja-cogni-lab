import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pause, Play, SkipForward, Timer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { Exercice } from "@/routes/_app.exercises";

interface Props {
  exercice: Exercice;
  onClose: () => void;
}

type Phase = "serie" | "recovery" | "done";

export function parseDuration(s: string): number {
  if (!s) return 60;
  const minSec = s.match(/(\d+)\s*m(?:in)?\s*(\d+)\s*s?/i);
  if (minSec) return parseInt(minSec[1]) * 60 + parseInt(minSec[2]);
  const minOnly = s.match(/(\d+)\s*m(?:in)?$/i);
  if (minOnly) return parseInt(minOnly[1]) * 60;
  const secOnly = s.match(/(\d+)\s*s?$/i);
  if (secOnly) return parseInt(secOnly[1]);
  return 60;
}

const COLORS = [
  { hex: "#EF4444", name: "ROUGE" },
  { hex: "#22C55E", name: "VERT" },
  { hex: "#3B82F6", name: "BLEU" },
  { hex: "#EAB308", name: "JAUNE" },
  { hex: "#F97316", name: "ORANGE" },
];
const ARROWS = ["↑", "↓", "←", "→"];
const SHAPES = ["circle", "square", "triangle", "star"] as const;
type Shape = typeof SHAPES[number];

type Stimulus =
  | { kind: "couleur"; color: { hex: string; name: string } }
  | { kind: "fleche"; arrow: string }
  | { kind: "nombre"; n: number }
  | { kind: "flash"; white: boolean }
  | { kind: "forme"; shape: Shape }
  | { kind: "default"; n: number };

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateStimulus(type: string, prevFlashWhite = false): Stimulus {
  const t = (type || "").toLowerCase();
  if (t.includes("couleur")) return { kind: "couleur", color: pick(COLORS) };
  if (t.includes("fleche") || t.includes("flèche") || t.includes("direction"))
    return { kind: "fleche", arrow: pick(ARROWS) };
  if (t.includes("nombre") || t.includes("chiffre") || t.includes("numerique") || t.includes("numérique"))
    return { kind: "nombre", n: 1 + Math.floor(Math.random() * 9) };
  if (t.includes("flash")) return { kind: "flash", white: !prevFlashWhite };
  if (t.includes("forme") || t.includes("shape")) return { kind: "forme", shape: pick(SHAPES) };
  return { kind: "default", n: 1 + Math.floor(Math.random() * 9) };
}

function ShapeSvg({ shape }: { shape: Shape }) {
  const size = 220;
  if (shape === "circle")
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="45" fill="white" />
      </svg>
    );
  if (shape === "square")
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <rect x="8" y="8" width="84" height="84" fill="white" rx="4" />
      </svg>
    );
  if (shape === "triangle")
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        <polygon points="50,8 92,88 8,88" fill="white" />
      </svg>
    );
  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <polygon
        points="50,5 61,38 96,38 68,59 78,93 50,72 22,93 32,59 4,38 39,38"
        fill="white"
      />
    </svg>
  );
}

export function ExercisePlayer({ exercice: ex, onClose }: Props) {
  const totalSeries = ex.series;
  const serieDuration = parseDuration(ex.duree_serie);
  const recoveryDuration = ex.recuperation_secondes;

  const [currentSerie, setCurrentSerie] = useState(1);
  const [phase, setPhase] = useState<Phase>("serie");
  const [timeLeft, setTimeLeft] = useState(serieDuration);
  const [paused, setPaused] = useState(false);
  const [stimulus, setStimulus] = useState<Stimulus>(() =>
    generateStimulus(ex.stimulus_type),
  );
  const [stimKey, setStimKey] = useState(0);

  const phaseDuration = phase === "serie" ? serieDuration : recoveryDuration;
  const recoveryProgress =
    phaseDuration > 0 ? ((phaseDuration - timeLeft) / phaseDuration) * 100 : 0;

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

  // Phase timer
  useEffect(() => {
    if (phase === "done" || paused) return;
    const id = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          if (phase === "serie") {
            if (currentSerie < totalSeries) {
              setPhase("recovery");
              return recoveryDuration;
            }
            setPhase("done");
            handleComplete();
            return 0;
          }
          setCurrentSerie((s) => s + 1);
          setPhase("serie");
          return serieDuration;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [phase, paused, currentSerie, totalSeries, recoveryDuration, serieDuration, handleComplete]);

  // Stimulus generator — only during serie
  useEffect(() => {
    if (phase !== "serie" || paused) return;
    const id = setInterval(() => {
      setStimulus((prev) =>
        generateStimulus(ex.stimulus_type, prev.kind === "flash" ? prev.white : false),
      );
      setStimKey((k) => k + 1);
    }, 1500);
    return () => clearInterval(id);
  }, [phase, paused, ex.stimulus_type]);

  // Reset stimulus when entering serie phase
  useEffect(() => {
    if (phase === "serie") {
      setStimulus(generateStimulus(ex.stimulus_type));
      setStimKey((k) => k + 1);
    }
  }, [phase, ex.stimulus_type]);

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

  const handleQuit = () => {
    if (phase === "done" || confirm("Quitter l'exercice ?")) onClose();
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${String(sec).padStart(2, "0")}` : `${sec}s`;
  };

  const flashWhite = stimulus.kind === "flash" && stimulus.white;

  const bgClass = useMemo(() => {
    if (phase === "done") return "bg-background";
    if (phase === "recovery") return "bg-amber-950";
    if (flashWhite) return "bg-white";
    if (phase === "serie" && stimulus.kind === "couleur") return "";
    return "bg-black";
  }, [phase, flashWhite, stimulus]);

  const fullscreenColor = phase === "serie" && stimulus.kind === "couleur";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className={`fixed inset-0 z-[60] flex flex-col ${bgClass}`}
      >
        {phase === "serie" && (
          <>
            {/* Discreet header */}
            <div className="absolute top-0 left-0 w-full px-4 pt-10 flex items-start justify-between z-10">
              <div className="flex flex-col">
                <span className={`text-xs ${flashWhite ? "text-black/50" : "text-white/50"} truncate max-w-[200px]`}>
                  {ex.titre}
                </span>
                <span className={`text-xs font-bold ${flashWhite ? "text-black/70" : "text-white/70"}`}>
                  SÉRIE {currentSerie}/{totalSeries}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1 ${flashWhite ? "bg-black/10 text-black" : "bg-white/10 text-white"} text-xs rounded-full px-2 py-1`}>
                  <Timer className="h-3 w-3" />
                  {formatTime(timeLeft)}
                </div>
                <button
                  onClick={handleQuit}
                  className={`p-1.5 rounded-full ${flashWhite ? "bg-black/10 text-black" : "bg-white/10 text-white"}`}
                  aria-label="Quitter"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Stimulus zone */}
            <div className="flex-1 flex items-center justify-center px-2 relative">
              {fullscreenColor && (
                <div
                  className="absolute inset-0"
                  style={{ backgroundColor: stimulus.color.hex }}
                />
              )}
              <AnimatePresence mode="wait">
                <motion.div
                  key={stimKey}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.1 }}
                  className="relative flex flex-col items-center justify-center gap-4 w-full h-full"
                >
                  {stimulus.kind === "couleur" && (
                    <span className="text-5xl font-black text-white tracking-widest drop-shadow-lg">
                      {stimulus.color.name}
                    </span>
                  )}
                  {stimulus.kind === "fleche" && (
                    <span className="text-[80vw] sm:text-[60vh] leading-none text-white font-black select-none">
                      {stimulus.arrow}
                    </span>
                  )}
                  {stimulus.kind === "nombre" && (
                    <span className="text-[80vw] sm:text-[70vh] font-black text-white leading-none select-none">
                      {stimulus.n}
                    </span>
                  )}
                  {stimulus.kind === "flash" && (
                    <span
                      className={`text-8xl font-black ${stimulus.white ? "text-black" : "text-white"}`}
                    >
                      +
                    </span>
                  )}
                  {stimulus.kind === "forme" && (
                    <div className="w-[80vw] h-[80vw] sm:w-[70vh] sm:h-[70vh] flex items-center justify-center">
                      <ShapeSvgFull shape={stimulus.shape} />
                    </div>
                  )}
                  {stimulus.kind === "default" && (
                    <span className="text-[80vw] sm:text-[70vh] font-black text-white leading-none select-none">
                      {stimulus.n}
                    </span>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Discreet footer */}
            <div className="absolute bottom-0 left-0 w-full pb-10 flex justify-center gap-4 z-10">
              <button
                onClick={() => setPaused((p) => !p)}
                className={`${flashWhite ? "bg-black/10 text-black" : "bg-white/10 text-white"} rounded-full w-12 h-12 flex items-center justify-center`}
                aria-label={paused ? "Reprendre" : "Pause"}
              >
                {paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
              <button
                onClick={skipPhase}
                className={`${flashWhite ? "bg-black/15 text-black" : "bg-white/15 text-white"} text-xs rounded-full px-4 h-10 flex items-center gap-1 font-semibold`}
              >
                <SkipForward className="h-4 w-4" />
                Série suivante
              </button>
            </div>
          </>
        )}

        {phase === "recovery" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6 relative">
            <button
              onClick={handleQuit}
              className="absolute top-10 left-4 p-2 rounded-full bg-white/10 text-white"
              aria-label="Quitter"
            >
              <X className="h-5 w-5" />
            </button>
            <p className="text-4xl font-black text-amber-300 tracking-widest">REPOS</p>
            <p className="text-8xl font-black text-white tabular-nums">{timeLeft}</p>
            <p className="text-sm text-amber-300/70">Prépare la série suivante</p>
            <div className="w-full max-w-xs h-2 rounded-full bg-amber-500/30 overflow-hidden">
              <div
                className="h-full bg-amber-400 transition-all duration-500"
                style={{ width: `${recoveryProgress}%` }}
              />
            </div>
            <p className="text-xs text-amber-300/60 mt-2">
              Série suivante : {currentSerie + 1}/{totalSeries}
            </p>
            <button
              onClick={skipPhase}
              className="mt-4 bg-white/15 text-white text-xs rounded-full px-4 h-10 flex items-center gap-1 font-semibold"
            >
              <SkipForward className="h-4 w-4" />
              Passer
            </button>
          </div>
        )}

        {phase === "done" && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 15 }}
              className="text-6xl"
            >
              ✅
            </motion.span>
            <h2 className="text-2xl font-bold text-foreground">Exercice terminé !</h2>
            <p className="text-muted-foreground text-center">
              {totalSeries} série{totalSeries > 1 ? "s" : ""} complétée{totalSeries > 1 ? "s" : ""}
            </p>
            <Button onClick={onClose} className="w-full max-w-xs h-12 text-base font-semibold mt-4">
              Fermer
            </Button>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
