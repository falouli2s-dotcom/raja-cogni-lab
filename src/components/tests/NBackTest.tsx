import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Maximize2 } from "lucide-react";
import {
  NBackTrial,
  NBACK_CONFIG,
  generateNBackTrials,
  computeNBackResults,
} from "@/lib/nback-engine";
import { useFullscreen } from "@/hooks/use-fullscreen";

type Phase = "training" | "transition" | "real" | "done";

interface NBackTestProps {
  onComplete: (results: ReturnType<typeof computeNBackResults>, rawTrials: NBackTrial[]) => void;
}

export function NBackTest({ onComplete }: NBackTestProps) {
  const { supported: fsSupported, request: requestFullscreen } = useFullscreen();
  const [phase, setPhase] = useState<Phase>("training");
  const [trialIndex, setTrialIndex] = useState(0);
  const [showLetter, setShowLetter] = useState(false);
  const [showBlank, setShowBlank] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "timeout"; text: string } | null>(null);
  const [completedTrials, setCompletedTrials] = useState<NBackTrial[]>([]);
  const [currentTrials, setCurrentTrials] = useState(() =>
    generateNBackTrials(NBACK_CONFIG.trainingTrials, NBACK_CONFIG.nLevel, NBACK_CONFIG.targetPercentage)
  );

  const stimulusStartRef = useRef<number>(0);
  const respondedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  const isTraining = phase === "training";
  const totalTrials = currentTrials.length;
  const currentTrial = currentTrials[trialIndex];

  const processTrial = useCallback((response: "yes" | "no" | null, rt: number | null) => {
    if (!currentTrial) return;

    const isCorrect = response === null
      ? false
      : currentTrial.isTarget ? response === "yes" : response === "no";

    const trial: NBackTrial = {
      ...currentTrial,
      response,
      correct: isCorrect,
      responseTime: rt,
      responded: response !== null,
    };

    if (isTraining) {
      if (response === null) {
        setFeedback({ type: "timeout", text: "Temps écoulé ! Réponds plus vite." });
      } else {
        setFeedback({
          type: isCorrect ? "correct" : "wrong",
          text: isCorrect
            ? `Correct ! ${rt ? `(${Math.round(rt)}ms)` : ""}`
            : currentTrial.isTarget
              ? "C'était la même lettre qu'il y a 2 positions"
              : "Ce n'était PAS la même lettre qu'il y a 2 positions",
        });
      }
    }

    return trial;
  }, [currentTrial, isTraining]);

  const advanceTrial = useCallback((trial: NBackTrial) => {
    const isReal = phaseRef.current === "real";

    if (isReal) {
      setCompletedTrials((prev) => [...prev, trial]);
    }

    const nextIndex = trialIndex + 1;
    if (nextIndex >= totalTrials) {
      if (phaseRef.current === "training") {
        setPhase("transition");
      } else {
        setPhase("done");
        setCompletedTrials((prev) => {
          const finalTrials = [...prev, trial];
          const results = computeNBackResults(finalTrials);
          setTimeout(() => onComplete(results, finalTrials), 100);
          return finalTrials;
        });
      }
    } else {
      setTrialIndex(nextIndex);
    }
  }, [trialIndex, totalTrials, onComplete]);

  const showNextStimulus = useCallback(() => {
    setFeedback(null);
    setShowBlank(false);
    setShowLetter(true);
    stimulusStartRef.current = performance.now();
    respondedRef.current = false;

    // After stimulus duration, go to blank / ISI
    timerRef.current = setTimeout(() => {
      setShowLetter(false);

      if (!respondedRef.current) {
        // Give ISI time to respond
        setShowBlank(true);
        timerRef.current = setTimeout(() => {
          if (!respondedRef.current) {
            respondedRef.current = true;
            const trial = processTrial(null, null);
            if (trial) {
              if (phaseRef.current === "training") {
                setTimeout(() => advanceTrial(trial), 1000);
              } else {
                advanceTrial(trial);
              }
            }
          }
        }, NBACK_CONFIG.isiDuration);
      }
    }, NBACK_CONFIG.stimulusDuration);
  }, [processTrial, advanceTrial]);

  const handleResponse = useCallback((answer: "yes" | "no") => {
    if (respondedRef.current || (!showLetter && !showBlank)) return;
    respondedRef.current = true;
    clearTimeout(timerRef.current);

    const rt = performance.now() - stimulusStartRef.current;
    const trial = processTrial(answer, rt);

    if (trial) {
      setShowLetter(false);
      setShowBlank(false);

      if (isTraining) {
        setTimeout(() => advanceTrial(trial), 1200);
      } else {
        // Brief pause then next
        setTimeout(() => advanceTrial(trial), NBACK_CONFIG.isiDuration);
      }
    }
  }, [showLetter, showBlank, processTrial, isTraining, advanceTrial]);

  // Keyboard
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") handleResponse("yes");
      if (e.key === "ArrowRight" || e.key === "l" || e.key === "L") handleResponse("no");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleResponse]);

  // Trigger next stimulus
  useEffect(() => {
    if ((phase === "training" || phase === "real") && trialIndex < totalTrials) {
      const t = setTimeout(() => showNextStimulus(), 400);
      return () => clearTimeout(t);
    }
  }, [trialIndex, phase, totalTrials]);

  function startRealTest() {
    const realTrials = generateNBackTrials(NBACK_CONFIG.realTrials, NBACK_CONFIG.nLevel, NBACK_CONFIG.targetPercentage);
    setCurrentTrials(realTrials);
    setTrialIndex(0);
    setCompletedTrials([]);
    setPhase("real");
  }

  // Transition screen
  if (phase === "transition") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-6"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
            <CheckCircle className="h-10 w-10 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Entraînement terminé !</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tu es prêt pour le test réel.<br />
              Cette fois, il n'y aura plus de feedback.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              40 stimuli — Appuie sur OUI si la lettre est identique à celle d'il y a 2 positions.
            </p>
          </div>
          <button
            onClick={startRealTest}
            className="mt-4 h-14 w-full rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground transition-colors active:bg-primary/90"
          >
            Commencer le test réel
          </button>
        </motion.div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-foreground select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4">
        <span className="rounded-full bg-card/10 px-3 py-1 text-xs font-medium text-card whitespace-nowrap">
          {isTraining ? "Entraînement" : "Test"} — {trialIndex + 1}/{totalTrials}
        </span>
        <div className="h-1 flex-1 rounded-full bg-card/10">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((trialIndex + 1) / totalTrials) * 100}%` }}
          />
        </div>
        {fsSupported && (
          <button
            onClick={requestFullscreen}
            aria-label="Plein écran"
            className="text-card/70 hover:text-card"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* N-back indicator */}
      <div className="mt-4 text-center">
        <span className="rounded-full bg-primary/20 px-3 py-1 text-xs font-semibold text-primary-foreground">
          2-Back : même lettre qu'il y a 2 ?
        </span>
      </div>

      {/* Stimulus area */}
      <div className="flex flex-1 items-center justify-center relative">
        <AnimatePresence mode="wait">
          {showLetter && currentTrial && (
            <motion.div
              key={`letter-${trialIndex}`}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="flex h-28 w-28 items-center justify-center rounded-3xl bg-card/10"
            >
              <span className="text-6xl font-bold text-card">{currentTrial.letter}</span>
            </motion.div>
          )}

          {showBlank && !showLetter && (
            <motion.div
              key="blank"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
              className="text-4xl font-bold text-card"
            >
              ·
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback (training only) */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="absolute bottom-8 mx-4 flex items-center gap-2 rounded-xl px-4 py-3"
              style={{
                backgroundColor: feedback.type === "correct" ? "oklch(0.637 0.177 152.535 / 0.15)" :
                  feedback.type === "wrong" ? "oklch(0.577 0.245 27.325 / 0.15)" :
                  "oklch(0.637 0.213 41.5 / 0.15)",
              }}
            >
              {feedback.type === "correct" && <CheckCircle className="h-5 w-5 shrink-0 text-primary" />}
              {feedback.type === "wrong" && <XCircle className="h-5 w-5 shrink-0 text-destructive" />}
              {feedback.type === "timeout" && <AlertTriangle className="h-5 w-5 shrink-0 text-accent" />}
              <span className="text-sm font-medium text-card">{feedback.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Response buttons */}
      <div className="flex gap-4 px-6 pb-8">
        <button
          onPointerDown={() => handleResponse("yes")}
          className="flex h-20 flex-1 flex-col items-center justify-center rounded-2xl text-lg font-bold transition-transform active:scale-95"
          style={{ backgroundColor: "oklch(0.637 0.177 152.535)", color: "white" }}
        >
          OUI
          <span className="text-xs font-normal opacity-70">Même lettre</span>
        </button>
        <button
          onPointerDown={() => handleResponse("no")}
          className="flex h-20 flex-1 flex-col items-center justify-center rounded-2xl text-lg font-bold transition-transform active:scale-95"
          style={{ backgroundColor: "oklch(0.577 0.245 27.325)", color: "white" }}
        >
          NON
          <span className="text-xs font-normal opacity-70">Différente</span>
        </button>
      </div>
    </div>
  );
}
