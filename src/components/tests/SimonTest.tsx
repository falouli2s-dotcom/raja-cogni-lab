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

const GREEN = "oklch(0.637 0.177 152.535)";
const RED = "oklch(0.577 0.245 27.325)";
const GREY = "oklch(0.5 0 0)";

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

  // Handle response: tap LEFT zone = "red", tap RIGHT zone = "green"
  const handleResponse = useCallback((chosenColor: "green" | "red") => {
    if (!showStimulus || responded.current || !currentTrial) return;
    responded.current = true;
    clearTimeout(timeoutRef.current);

    const rt = performance.now() - stimulusStartRef.current;
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
          : `Erreur — réponds selon la COULEUR, pas le côté`,
      });
      setTimeout(() => advanceTrial(trial), 1000);
    } else {
      advanceTrial(trial);
    }
  }, [showStimulus, currentTrial, isTraining, advanceTrial]);

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
              40 essais — Tape le côté correspondant à la COULEUR (gauche=Rouge, droite=Vert).
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

  // Determine which side lights up: stimulus appears at currentTrial.position (left/right)
  // with currentTrial.color (red/green). Both zones stay tappable.
  const leftLit = showStimulus && currentTrial?.position === "left";
  const rightLit = showStimulus && currentTrial?.position === "right";
  const leftColor = leftLit ? (currentTrial!.color === "green" ? GREEN : RED) : GREY;
  const rightColor = rightLit ? (currentTrial!.color === "green" ? GREEN : RED) : GREY;

  return (
    <div className="fixed inset-0 flex flex-col bg-foreground select-none overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 z-20">
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

      {/* Two-zone playfield */}
      <div className="relative flex flex-1 min-h-0">
        {/* LEFT zone = ROUGE */}
        <button
          onPointerDown={() => handleResponse("red")}
          aria-label="Zone Rouge"
          className="flex flex-1 flex-col items-center justify-center gap-4 active:bg-card/5 transition-colors"
        >
          <motion.div
            animate={{
              opacity: leftLit ? 1 : 0.35,
              scale: leftLit ? 1.05 : 1,
            }}
            transition={{ duration: 0.1 }}
            className="rounded-full shadow-lg"
            style={{
              width: 130,
              height: 130,
              backgroundColor: leftColor,
            }}
          />
          <span className="text-sm font-semibold tracking-widest text-card/70">ROUGE</span>
        </button>

        {/* Vertical separator */}
        <div className="w-px bg-card/15" />

        {/* RIGHT zone = VERT */}
        <button
          onPointerDown={() => handleResponse("green")}
          aria-label="Zone Vert"
          className="flex flex-1 flex-col items-center justify-center gap-4 active:bg-card/5 transition-colors"
        >
          <motion.div
            animate={{
              opacity: rightLit ? 1 : 0.35,
              scale: rightLit ? 1.05 : 1,
            }}
            transition={{ duration: 0.1 }}
            className="rounded-full shadow-lg"
            style={{
              width: 130,
              height: 130,
              backgroundColor: rightColor,
            }}
          />
          <span className="text-sm font-semibold tracking-widest text-card/70">VERT</span>
        </button>

        {/* Fixation cross overlay */}
        <AnimatePresence>
          {showFixation && (
            <motion.div
              key="fixation"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="pointer-events-none absolute inset-0 flex items-center justify-center text-4xl font-bold text-card"
            >
              +
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
              className="pointer-events-none absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-xl px-4 py-3"
              style={{
                backgroundColor: feedback.type === "correct" ? "oklch(0.637 0.177 152.535 / 0.2)" :
                  feedback.type === "wrong" ? "oklch(0.577 0.245 27.325 / 0.2)" :
                  "oklch(0.637 0.213 41.5 / 0.2)",
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
    </div>
  );
}
