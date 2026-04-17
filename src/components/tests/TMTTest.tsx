import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle, XCircle, AlertTriangle, Maximize2 } from "lucide-react";
import {
  TMTNode,
  TMT_CONFIG,
  TMTResult,
  TMTCombinedResults,
  generateNodes,
  computeTMTResults,
} from "@/lib/tmt-engine";
import { useFullscreen } from "@/hooks/use-fullscreen";

type Phase = "training-A" | "transition-A" | "real-A" | "transition-B" | "training-B" | "transition-B2" | "real-B" | "done";

interface TMTTestProps {
  onComplete: (results: TMTCombinedResults) => void;
}

export function TMTTest({ onComplete }: TMTTestProps) {
  const { supported: fsSupported, request: requestFullscreen } = useFullscreen();
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("training-A");
  const [nodes, setNodes] = useState<TMTNode[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedIndices, setCompletedIndices] = useState<number[]>([]);
  const [errorNode, setErrorNode] = useState<string | null>(null);
  const [errors, setErrors] = useState(0);
  const [startTime, setStartTime] = useState(0);
  const [feedback, setFeedback] = useState<{ type: "correct" | "wrong"; text: string } | null>(null);
  const [partAResult, setPartAResult] = useState<TMTResult | null>(null);
  const [dimensions, setDimensions] = useState({ width: 350, height: 450 });

  const isTraining = phase === "training-A" || phase === "training-B";
  const currentPart: "A" | "B" = phase.includes("B") ? "B" : "A";

  // Measure container and generate initial nodes
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const w = Math.max(300, rect.width - 20);
    const h = Math.max(350, rect.height - 20);
    setDimensions({ width: w, height: h });
  }, []);

  // Generate nodes when phase changes
  useEffect(() => {
    let count: number;
    let part: "A" | "B";

    switch (phase) {
      case "training-A":
        count = TMT_CONFIG.trainingNodesA;
        part = "A";
        break;
      case "real-A":
        count = TMT_CONFIG.realNodesA;
        part = "A";
        break;
      case "training-B":
        count = TMT_CONFIG.trainingNodesB;
        part = "B";
        break;
      case "real-B":
        count = TMT_CONFIG.realNodesB;
        part = "B";
        break;
      default:
        return;
    }

    const newNodes = generateNodes(part, count, dimensions.width, dimensions.height);
    setNodes(newNodes);
    setCurrentIndex(0);
    setCompletedIndices([]);
    setErrors(0);
    setStartTime(performance.now());
    setFeedback(null);
    setErrorNode(null);
  }, [phase, dimensions]);

  const handleNodeTap = useCallback((node: TMTNode) => {
    if (errorNode) return; // wait for error feedback to clear

    if (node.order === currentIndex) {
      // Correct
      setCompletedIndices((prev) => [...prev, node.order]);
      const nextIndex = currentIndex + 1;

      if (isTraining) {
        setFeedback({ type: "correct", text: "Correct !" });
        setTimeout(() => setFeedback(null), 600);
      }

      if (nextIndex >= nodes.length) {
        // Phase complete
        const elapsed = performance.now() - startTime;
        const result: TMTResult = {
          part: currentPart,
          completionTime: Math.round(elapsed),
          errors,
          nodesCompleted: nodes.length,
          totalNodes: nodes.length,
        };

        switch (phase) {
          case "training-A":
            setPhase("transition-A");
            break;
          case "real-A":
            setPartAResult(result);
            setPhase("transition-B");
            break;
          case "training-B":
            setPhase("transition-B2");
            break;
          case "real-B":
            if (partAResult) {
              const combined = computeTMTResults(partAResult, result);
              setTimeout(() => onComplete(combined), 100);
            }
            setPhase("done");
            break;
        }
      } else {
        setCurrentIndex(nextIndex);
      }
    } else {
      // Error
      setErrors((e) => e + 1);
      setErrorNode(node.id);

      if (isTraining) {
        const expected = nodes.find((n) => n.order === currentIndex);
        setFeedback({
          type: "wrong",
          text: `Erreur ! Cherche "${expected?.label}"`,
        });
      } else {
        setFeedback({ type: "wrong", text: "Erreur !" });
      }

      setTimeout(() => {
        setErrorNode(null);
        setFeedback(null);
      }, 800);
    }
  }, [currentIndex, nodes, errors, phase, isTraining, startTime, currentPart, partAResult, onComplete, errorNode]);

  // Transition screens
  if (phase === "transition-A") {
    return (
      <TransitionScreen
        title="Entraînement A terminé !"
        subtitle="Partie A : Relie les nombres de 1 à 25 dans l'ordre, le plus vite possible."
        buttonText="Commencer la Partie A"
        onStart={() => setPhase("real-A")}
      />
    );
  }

  if (phase === "transition-B") {
    return (
      <TransitionScreen
        title="Partie A terminée !"
        subtitle={`Temps : ${partAResult ? (partAResult.completionTime / 1000).toFixed(1) : "?"}s — ${partAResult?.errors ?? 0} erreur(s). Place à la Partie B avec entraînement.`}
        buttonText="Entraînement Partie B"
        onStart={() => setPhase("training-B")}
      />
    );
  }

  if (phase === "transition-B2") {
    return (
      <TransitionScreen
        title="Entraînement B terminé !"
        subtitle="Partie B : Alterne nombres et lettres (1→A→2→B→3→C...). Réponds le plus vite possible."
        buttonText="Commencer la Partie B"
        onStart={() => setPhase("real-B")}
      />
    );
  }

  if (phase === "done") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const expectedNode = nodes.find((n) => n.order === currentIndex);

  return (
    <div className="flex min-h-screen flex-col bg-background select-none">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-2">
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-foreground">
          {isTraining ? "Entraînement" : "Test"} — Partie {currentPart}
        </span>
        <span className="text-xs text-muted-foreground">
          {completedIndices.length}/{nodes.length}
        </span>
        {fsSupported && (
          <button
            onClick={requestFullscreen}
            aria-label="Plein écran"
            className="text-muted-foreground hover:text-foreground"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="mx-4 h-1 rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${(completedIndices.length / nodes.length) * 100}%` }}
        />
      </div>

      {/* Next target hint */}
      <div className="mt-2 text-center">
        <span className="text-xs text-muted-foreground">
          Prochain : <strong className="text-foreground">{expectedNode?.label}</strong>
        </span>
      </div>

      {/* Node area */}
      <div ref={containerRef} className="relative mx-2 mt-2 flex-1">
        {/* Draw lines between completed nodes */}
        <svg className="absolute inset-0 pointer-events-none" width={dimensions.width} height={dimensions.height}>
          {completedIndices.length > 1 &&
            completedIndices.slice(1).map((order, i) => {
              const from = nodes.find((n) => n.order === completedIndices[i]);
              const to = nodes.find((n) => n.order === order);
              if (!from || !to) return null;
              return (
                <line
                  key={`line-${i}`}
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  strokeOpacity={0.5}
                />
              );
            })}
        </svg>

        {/* Nodes */}
        {nodes.map((node) => {
          const isCompleted = completedIndices.includes(node.order);
          const isNext = node.order === currentIndex;
          const isError = errorNode === node.id;

          return (
            <motion.button
              key={node.id}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: node.order * 0.02, type: "spring", stiffness: 300 }}
              className={`absolute flex items-center justify-center rounded-full border-2 text-sm font-bold transition-colors
                ${isCompleted
                  ? "border-primary bg-primary text-primary-foreground"
                  : isError
                    ? "border-destructive bg-destructive/20 text-destructive animate-shake"
                    : isNext
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-card text-foreground"
                }`}
              style={{
                left: node.x - TMT_CONFIG.nodeRadius,
                top: node.y - TMT_CONFIG.nodeRadius,
                width: TMT_CONFIG.nodeRadius * 2,
                height: TMT_CONFIG.nodeRadius * 2,
              }}
              onClick={() => handleNodeTap(node)}
              disabled={isCompleted}
            >
              {node.label}
            </motion.button>
          );
        })}
      </div>

      {/* Feedback */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            className={`mx-6 mb-6 flex items-center justify-center gap-2 rounded-xl px-4 py-3 ${
              feedback.type === "correct" ? "bg-primary/10" : "bg-destructive/10"
            }`}
          >
            {feedback.type === "correct" ? (
              <CheckCircle className="h-5 w-5 text-primary" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive" />
            )}
            <span className={`text-sm font-medium ${
              feedback.type === "correct" ? "text-primary" : "text-destructive"
            }`}>
              {feedback.text}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error counter */}
      {errors > 0 && (
        <div className="mb-4 flex items-center justify-center gap-1 text-xs text-muted-foreground">
          <AlertTriangle className="h-3 w-3" /> {errors} erreur(s)
        </div>
      )}
    </div>
  );
}

function TransitionScreen({
  title,
  subtitle,
  buttonText,
  onStart,
}: {
  title: string;
  subtitle: string;
  buttonText: string;
  onStart: () => void;
}) {
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
          <h2 className="text-xl font-bold text-foreground">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
        </div>
        <button
          onClick={onStart}
          className="mt-4 h-14 w-full rounded-xl bg-primary px-8 text-base font-semibold text-primary-foreground transition-colors active:bg-primary/90"
        >
          {buttonText}
        </button>
      </motion.div>
    </div>
  );
}
