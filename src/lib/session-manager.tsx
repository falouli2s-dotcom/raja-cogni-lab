import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { computeSimonResults, type SimonTrial } from "@/lib/simon-engine";
import { computeNBackResults, type NBackTrial } from "@/lib/nback-engine";
import type { TMTCombinedResults } from "@/lib/tmt-engine";
import { computeSGS, type SGSResult, type TestScores } from "@/lib/sgs-engine";

export type TestId = "simon" | "nback" | "tmt";

export interface TestDefinition {
  id: TestId;
  name: string;
  description: string;
  duration: string;
}

export const SESSION_TESTS: TestDefinition[] = [
  { id: "simon", name: "Tâche de Simon", description: "Inhibition & Temps de réaction", duration: "~5 min" },
  { id: "nback", name: "N-Back 2", description: "Mémoire de travail", duration: "~8 min" },
  { id: "tmt", name: "Trail Making Test", description: "Flexibilité cognitive", duration: "~6 min" },
];

export type SessionStatus = "idle" | "in-progress" | "completed";
export type SessionStep = "start" | "instructions" | "running-test" | "transition" | "final-results";

export interface SimonResultData {
  avgRT: number;
  avgCongruent: number;
  avgIncongruent: number;
  simonEffect: number;
  accuracy: number;
  errorRate: number;
  totalTrials: number;
  correctCount: number;
  missedCount: number;
}

export interface NBackResultData {
  hits: number;
  misses: number;
  falseAlarms: number;
  correctRejections: number;
  accuracy: number;
  errorRate: number;
  targetErrorRate: number;
  avgRT: number;
  dPrime: number;
  totalTrials: number;
  totalTargets: number;
}

export interface TestResult {
  testId: TestId;
  data: SimonResultData | NBackResultData | TMTCombinedResults;
  rawTrials?: SimonTrial[] | NBackTrial[];
  completedAt: string;
}

export interface SessionData {
  sessionId: string;
  startedAt: string;
  completedAt?: string;
  status: SessionStatus;
  results: TestResult[];
  sgs?: SGSResult;
}

interface SessionContextValue {
  session: SessionData | null;
  step: SessionStep;
  currentTestIndex: number;
  startSession: () => void;
  completeTest: (result: TestResult) => void;
  proceedToNextTest: () => void;
  startCurrentTest: () => void;
  finishSession: () => SGSResult;
  resetSession: () => void;
  getCurrentTest: () => TestDefinition | null;
  getNextTest: () => TestDefinition | null;
  getTestResult: (testId: TestId) => TestResult | undefined;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionData | null>(null);
  const [step, setStep] = useState<SessionStep>("start");
  const [currentTestIndex, setCurrentTestIndex] = useState(0);

  const startSession = useCallback(() => {
    const newSession: SessionData = {
      sessionId: `session_${Date.now()}`,
      startedAt: new Date().toISOString(),
      status: "in-progress",
      results: [],
    };
    setSession(newSession);
    setCurrentTestIndex(0);
    setStep("instructions");
  }, []);

  const startCurrentTest = useCallback(() => {
    setStep("running-test");
  }, []);

  const completeTest = useCallback((result: TestResult) => {
    setSession(prev => {
      if (!prev) return prev;
      return { ...prev, results: [...prev.results, result] };
    });
    if (currentTestIndex < SESSION_TESTS.length - 1) {
      setStep("transition");
    } else {
      setStep("final-results");
    }
  }, [currentTestIndex]);

  const proceedToNextTest = useCallback(() => {
    setCurrentTestIndex(prev => prev + 1);
    setStep("instructions");
  }, []);

  const finishSession = useCallback((): SGSResult => {
    const scores: TestScores = {};
    
    if (session) {
      const simonResult = session.results.find(r => r.testId === "simon");
      if (simonResult) {
        const d = simonResult.data as SimonResultData;
        scores.simon = {
          avgRT: d.avgRT,
          simonEffect: d.simonEffect,
          accuracy: d.accuracy,
        };
      }

      const nbackResult = session.results.find(r => r.testId === "nback");
      if (nbackResult) {
        const d = nbackResult.data as NBackResultData;
        scores.nback = {
          accuracy: d.accuracy,
          targetErrorRate: d.targetErrorRate,
          dPrime: d.dPrime,
        };
      }

      const tmtResult = session.results.find(r => r.testId === "tmt");
      if (tmtResult) {
        const d = tmtResult.data as TMTCombinedResults;
        scores.tmt = {
          ratioBA: d.ratioBA,
          timeA: d.partA.completionTime,
          timeB: d.partB.completionTime,
        };
      }
    }

    const sgs = computeSGS(scores);
    setSession(prev => {
      if (!prev) return prev;
      return { ...prev, status: "completed", completedAt: new Date().toISOString(), sgs };
    });
    return sgs;
  }, [session]);

  const resetSession = useCallback(() => {
    setSession(null);
    setStep("start");
    setCurrentTestIndex(0);
  }, []);

  const getCurrentTest = useCallback(() => {
    return SESSION_TESTS[currentTestIndex] ?? null;
  }, [currentTestIndex]);

  const getNextTest = useCallback(() => {
    return SESSION_TESTS[currentTestIndex + 1] ?? null;
  }, [currentTestIndex]);

  const getTestResult = useCallback((testId: TestId) => {
    return session?.results.find(r => r.testId === testId);
  }, [session]);

  return (
    <SessionContext.Provider value={{
      session,
      step,
      currentTestIndex,
      startSession,
      completeTest,
      proceedToNextTest,
      startCurrentTest,
      finishSession,
      resetSession,
      getCurrentTest,
      getNextTest,
      getTestResult,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used within SessionProvider");
  return ctx;
}

const SESSIONS_STORAGE_KEY = "cogniraja_sessions";

export function saveSessionToHistory(session: SessionData): void {
  const history = getSessionHistory();
  history.unshift(session);
  if (history.length > 50) history.pop();
  localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(history));
}

export function getSessionHistory(): SessionData[] {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SessionData[];
  } catch {
    return [];
  }
}

export function getLastSession(): SessionData | null {
  const history = getSessionHistory();
  return history.find(s => s.status === "completed") ?? null;
}
