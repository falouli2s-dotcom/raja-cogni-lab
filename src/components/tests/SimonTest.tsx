import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import {
  SimonTrial,
  SimonColor,
  SIMON_CONFIG,
  generateTrials,
  computeSimonResults,
} from "@/lib/simon-engine";

type Phase = "training" | "transition" | "real" | "done";

interface SimonTestProps {
  onComplete: (results: ReturnType<typeof computeSimonResults>, rawTrials: SimonTrial[]) => void;
}

export function SimonTest({ onComplete }: SimonTestProps) {
  const [phase, setPhase] = useState<Phase>("training");
  const [trialIndex, setTrialIndex] = useState(0);
  const [showFixation, setShowFixation] = useState(true);
  const [showStimulus, setShowStimulus] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "timeout"; text: string } | null>(null);
  const [trials, setTrials] = useState<SimonTrial[]>([]);
  const [currentTrials, setCurrentTrials] = useState(generateTrials(SIMON_CONFIG.trainingTrials));
  const [allRealTrials, setAllRealTrials] = useState<SimonTrial[]>([]);

  const stimulusStartRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const responded = useRef(false);

  const isTraining = phase === "training";
  const totalTrials = currentTrials.length;
  const currentTrial = currentTrials[trialIndex];

  const showNextTrial = useCallback(() => {
    setFeedback(null);
    setShowStimulus(false);
    setShowFixation(true);

    setTimeout(() => {
      setShowFixation(false);
      setShowStimulus(true);
      stimulusStartRef.current = performance.now();
      responded.current = false;

      // Timeout for response
      timeoutRef.current = setTimeout(() => {
        if (!responded.current) {
          responded.current = true;
          const trial: SimonTrial = {
            ...currentTrials[trialIndex],
            responseTime: null,
            correct: false,
            responded: false,
          };

          if (isTraining) {
            setFeedback({ type: "timeout", text: "Trop lent ! Réponds plus vite." });
            setTimeout(() => advanceTrial(trial), 1200);
          } else {
            advanceTrial(trial);
          }
        }
      }, SIMON_CONFIG.responseLimit);
    }, SIMON_CONFIG.fixationDuration);
  }, [trialIndex, currentTrials, isTraining]);

  const advanceTrial = useCallback((trial: SimonTrial) => {
    setShowStimulus(false);

    if (phase === "real") {
      setAllRealTrials((prev) => [...prev, trial]);
    }

    const nextIndex = trialIndex + 1;

    if (nextIndex >= totalTrials) {
      if (phase === "training") {
        setPhase("transition");
      } else if (phase === "real") {
        // Will be handled in effect
        setAllRealTrials((prev) => {
          const finalTrials = [...prev, trial].slice(-SIMON_CONFIG.realTrials);
          const results = computeSimonResults(finalTrials);
          setTimeout(() => onComplete(results, finalTrials), 100);
          return finalTrials;
        });
        setPhase("done");
      }
    } else {
      setTrialIndex(nextIndex);
    }
  }, [trialIndex, totalTrials, phase, onComplete]);

  // Handle response
  const handleResponse = useCallback((chosenSide: "left" | "right") => {
    if (!showStimulus || responded.current || !currentTrial) return;
    responded.current = true;
    clearTimeout(timeoutRef.current);

    const rt = performance.now() - stimulusStartRef.current;
    // Green = left button, Red = right button
    const correctSide: "left" | "right" = currentTrial.color === "green" ? "left" : "right";
    const isCorrect = chosenSide === correctSide;

    const trial: SimonTrial = {
      ...currentTrial,
      responseTime: Math.round(rt),
      correct: isCorrect,
      responded: true,
    };

    if (isTraining) {
      setFeedback({
        type: isCorrect ? "correct" : "wrong",
        text: isCorrect
          ? `Correct ! (${Math.round(rt)}ms)`
          : `Erreur — ${currentTrial.color === "green" ? "Vert = Gauche" : "Rouge = Droite"}`,
      });
      setTimeout(() => advanceTrial(trial), 1000);
    } else {
      advanceTrial(trial);
    }
  }, [showStimulus, currentTrial, isTraining, advanceTrial]);

  // Keyboard support
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") handleResponse("left");
      if (e.key === "ArrowRight" || e.key === "l" || e.key === "L") handleResponse("right");
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleResponse]);

  // Start first trial
  useEffect(() => {
    if ((phase === "training" || phase === "real") && trialIndex < totalTrials) {
      const t = setTimeout(() => showNextTrial(), 300);
      return () => clearTimeout(t);
    }
  }, [trialIndex, phase, totalTrials]);

  // Start real phase
  function startRealTest() {
    const realTrials = generateTrials(SIMON_CONFIG.realTrials);
    setCurrentTrials(realTrials);
    setTrialIndex(0);
    setAllRealTrials([]);
    setPhase("real");
  }

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
              30 essais — Réponds le plus vite et précisément possible.
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
      <div className="flex items-center justify-between px-4 pt-4">
        <span className="rounded-full bg-card/10 px-3 py-1 text-xs font-medium text-card">
          {isTraining ? "Entraînement" : "Test"} — {trialIndex + 1}/{totalTrials}
        </span>
        <div className="h-1 flex-1 mx-4 rounded-full bg-card/10">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${((trialIndex + 1) / totalTrials) * 100}%` }}
          />
        </div>
      </div>

      {/* Stimulus area */}
      <div className="flex flex-1 items-center justify-center relative">
        <AnimatePresence>
          {showFixation && (
            <motion.div
              key="fixation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-4xl font-bold text-card"
            >
              +
            </motion.div>
          )}

          {showStimulus && currentTrial && (
            <motion.div
              key={`stimulus-${trialIndex}`}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ duration: 0.1 }}
              className="absolute"
              style={{
                [currentTrial.position === "left" ? "left" : "right"]: "15%",
              }}
            >
              <div
                className="h-20 w-20 rounded-full shadow-lg"
                style={{
                  backgroundColor: currentTrial.color === "green" ? "oklch(0.637 0.177 152.535)" : "oklch(0.577 0.245 27.325)",
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback overlay (training only) */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="absolute bottom-8 flex items-center gap-2 rounded-xl px-4 py-3"
              style={{
                backgroundColor: feedback.type === "correct" ? "oklch(0.637 0.177 152.535 / 0.15)" :
                  feedback.type === "wrong" ? "oklch(0.577 0.245 27.325 / 0.15)" :
                  "oklch(0.637 0.213 41.5 / 0.15)",
              }}
            >
              {feedback.type === "correct" && <CheckCircle className="h-5 w-5 text-primary" />}
              {feedback.type === "wrong" && <XCircle className="h-5 w-5 text-destructive" />}
              {feedback.type === "timeout" && <AlertTriangle className="h-5 w-5 text-accent" />}
              <span className="text-sm font-medium text-card">{feedback.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Response buttons */}
      <div className="flex gap-4 px-6 pb-8">
        <button
          onPointerDown={() => handleResponse("left")}
          className="flex h-20 flex-1 items-center justify-center rounded-2xl text-lg font-bold text-primary-foreground transition-transform active:scale-95"
          style={{ backgroundColor: "oklch(0.637 0.177 152.535)" }}
        >
          VERT
        </button>
        <button
          onPointerDown={() => handleResponse("right")}
          className="flex h-20 flex-1 items-center justify-center rounded-2xl text-lg font-bold text-primary-foreground transition-transform active:scale-95"
          style={{ backgroundColor: "oklch(0.577 0.245 27.325)" }}
        >
          ROUGE
        </button>
      </div>
    </div>
  );
}
