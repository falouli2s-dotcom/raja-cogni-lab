import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Maximize2 } from "lucide-react";
import {
  SimonTrial,
  SIMON_CONFIG,
  generateTrials,
  computeSimonResults,
} from "@/lib/simon-engine";
import { useFullscreen } from "@/hooks/use-fullscreen";

type Phase = "training" | "transition" | "real" | "done";

interface SimonTestProps {
  onComplete: (results: ReturnType<typeof computeSimonResults>, rawTrials: SimonTrial[]) => void;
}

export function SimonTest({ onComplete }: SimonTestProps) {
  const { supported: fsSupported, request: requestFullscreen } = useFullscreen();
  const [phase, setPhase] = useState<Phase>("training");
  const [trialIndex, setTrialIndex] = useState(0);
  const [showFixation, setShowFixation] = useState(true);
  const [showStimulus, setShowStimulus] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong" | "timeout"; text: string } | null>(null);
  const [currentTrials, setCurrentTrials] = useState(generateTrials(SIMON_CONFIG.trainingTrials));
  const [allRealTrials, setAllRealTrials] = useState<SimonTrial[]>([]);

  const stimulusStartRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const responded = useRef(false);

  const isTraining = phase === "training";
  const totalTrials = currentTrials.length;
  const currentTrial = currentTrials[trialIndex];

  const advanceTrial = useCallback((trial: SimonTrial) => {
    setShowStimulus(false);

    const nextIndex = trialIndex + 1;

    if (nextIndex >= totalTrials) {
      if (phase === "training") {
        setPhase("transition");
      } else if (phase === "real") {
        setAllRealTrials((prev) => {
          const finalTrials = [...prev, trial].slice(-SIMON_CONFIG.realTrials);
          const results = computeSimonResults(finalTrials);
          setTimeout(() => onComplete(results, finalTrials), 100);
          return finalTrials;
        });
        setPhase("done");
      }
    } else {
      if (phase === "real") {
        setAllRealTrials((prev) => [...prev, trial]);
      }
      setTrialIndex(nextIndex);
    }
  }, [trialIndex, totalTrials, phase, onComplete]);

  const showNextTrial = useCallback(() => {
    setFeedback(null);
    setShowStimulus(false);
    setShowFixation(true);

    setTimeout(() => {
      setShowFixation(false);
      setShowStimulus(true);
      stimulusStartRef.current = performance.now();
      responded.current = false;

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
  }, [trialIndex, currentTrials, isTraining, advanceTrial]);

  // Handle response (click on a circle of a given color)
  const handleResponse = useCallback((chosenColor: "green" | "red") => {
    if (!showStimulus || responded.current || !currentTrial) return;
    responded.current = true;
    clearTimeout(timeoutRef.current);

    const rt = performance.now() - stimulusStartRef.current;
    // Correct response = click the same color as the stimulus
    const isCorrect = chosenColor === currentTrial.color;

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
          : `Erreur — clique sur la couleur affichée`,
      });
      setTimeout(() => advanceTrial(trial), 1000);
    } else {
      advanceTrial(trial);
    }
  }, [showStimulus, currentTrial, isTraining, advanceTrial]);

  // Start trial loop
  useEffect(() => {
    if ((phase === "training" || phase === "real") && trialIndex < totalTrials) {
      const t = setTimeout(() => showNextTrial(), 300);
      return () => clearTimeout(t);
    }
  }, [trialIndex, phase, totalTrials]);

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
              40 essais — Clique sur le cercle de la même couleur que le stimulus.
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

  const GREEN = "oklch(0.637 0.177 152.535)";
  const RED = "oklch(0.577 0.245 27.325)";

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
                  backgroundColor: currentTrial.color === "green" ? GREEN : RED,
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

      {/* Response circles — tap directly on the color */}
      <div className="flex items-center justify-around gap-6 px-6 pb-10 pt-4">
        <button
          onPointerDown={() => handleResponse("green")}
          aria-label="Vert"
          className="h-24 w-24 rounded-full shadow-lg transition-transform active:scale-90"
          style={{ backgroundColor: GREEN }}
        />
        <button
          onPointerDown={() => handleResponse("red")}
          aria-label="Rouge"
          className="h-24 w-24 rounded-full shadow-lg transition-transform active:scale-90"
          style={{ backgroundColor: RED }}
        />
      </div>
    </div>
  );
}
