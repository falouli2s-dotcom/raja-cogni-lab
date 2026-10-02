import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

type State = "idle" | "waiting" | "green" | "result" | "early" | "done";
const MAX_TRIALS = 5;

export function ReactionTimeTester({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>("idle");
  const [times, setTimes] = useState<number[]>([]);
  const [last, setLast] = useState<number | null>(null);
  const stateRef = useRef<State>("idle");
  const startRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const timesRef = useRef<number[]>([]);

  const set = (s: State) => {
    stateRef.current = s;
    setState(s);
  };

  const clearTimers = () => {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    timeoutRef.current = null;
    rafRef.current = null;
  };

  useEffect(() => {
    const el = document.documentElement;
    el.requestFullscreen?.().catch(() => {});
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimers();
      document.body.style.overflow = prevOverflow;
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  const startTrial = () => {
    clearTimers();
    startRef.current = null;
    set("waiting");
    const delay = 1500 + Math.random() * 2500;
    timeoutRef.current = window.setTimeout(() => {
      set("green");
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = requestAnimationFrame(() => {
          startRef.current = performance.now();
        });
      });
    }, delay);
  };

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    const now = performance.now();
    const s = stateRef.current;
    if (s === "idle" || s === "result" || s === "early") return startTrial();
    if (s === "waiting") {
      clearTimers();
      return set("early");
    }
    if (s === "green") {
      if (startRef.current === null) {
        clearTimers();
        return set("early");
      }
      const rt = Math.round(now - startRef.current);
      startRef.current = null;
      const next = [...timesRef.current, rt];
      timesRef.current = next;
      setTimes(next);
      setLast(rt);
      set(next.length >= MAX_TRIALS ? "done" : "result");
    }
  }, []);

  const restart = () => {
    clearTimers();
    timesRef.current = [];
    setTimes([]);
    setLast(null);
    set("idle");
  };

  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  const sorted = [...times].sort((a, b) => a - b);
  const median = sorted.length
    ? sorted.length % 2
      ? sorted[(sorted.length - 1) / 2]
      : Math.round((sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2)
    : 0;

  const bg =
    state === "green" ? "bg-primary text-primary-foreground" : state === "early" ? "bg-destructive/20 text-foreground" : "bg-muted text-foreground";

  return (
    <div className="fixed inset-0 z-[100] select-none" style={{ touchAction: "none", overscrollBehavior: "none" }}>
      <button
        onPointerDown={(e) => e.stopPropagation()}
        onClick={onClose}
        className="absolute end-4 top-4 z-10 flex items-center gap-1 rounded-full bg-card/80 px-3 py-1.5 text-xs font-medium text-muted-foreground"
      >
        <X className="h-4 w-4" /> Quitter
      </button>

      {state === "done" ? (
        <div className="flex h-full flex-col items-center justify-center gap-6 bg-background px-6">
          <h2 className="text-2xl font-bold text-foreground">Résultats</h2>
          <ul className="w-full max-w-xs space-y-2 text-center text-base text-foreground">
            {times.map((t, i) => (
              <li key={i}>Essai {i + 1} : {t} ms</li>
            ))}
          </ul>
          <div className="text-center text-sm text-muted-foreground">
            <p>Moyenne : <strong className="text-foreground">{avg} ms</strong></p>
            <p>Médiane : <strong className="text-foreground">{median} ms</strong></p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-3">
            <Button className="h-12" onClick={restart}>Recommencer</Button>
            <Button variant="outline" className="h-12" onClick={onClose}>Fermer</Button>
          </div>
        </div>
      ) : (
        <div
          onPointerDown={onPointerDown}
          onContextMenu={(e) => e.preventDefault()}
          className={`flex h-full flex-col items-center justify-center px-6 text-center ${bg}`}
        >
          {state === "result" && last !== null && <p className="text-6xl font-bold">{last} ms</p>}
          <p className="mt-4 text-xl font-semibold">
            {state === "idle" && "Appuie pour commencer"}
            {(state === "waiting" || state === "green") && "Appuie quand l'écran devient vert"}
            {state === "result" && "Appuie pour recommencer"}
            {state === "early" && "Trop tôt ! Appuie pour réessayer"}
          </p>
          <p className="mt-6 text-sm opacity-70">Essai {Math.min(times.length + 1, MAX_TRIALS)} / {MAX_TRIALS}</p>
        </div>
      )}
    </div>
  );
}
