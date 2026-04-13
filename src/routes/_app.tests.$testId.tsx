import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Zap, GitBranch, Clock, Target, ArrowLeft, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SimonTest } from "@/components/tests/SimonTest";
import { SimonResults } from "@/components/tests/SimonResults";
import { NBackTest } from "@/components/tests/NBackTest";
import { NBackResults } from "@/components/tests/NBackResults";
import { TMTTest } from "@/components/tests/TMTTest";
import { TMTResults } from "@/components/tests/TMTResults";
import { supabase } from "@/integrations/supabase/client";
import type { SimonTrial } from "@/lib/simon-engine";
import { computeSimonResults } from "@/lib/simon-engine";
import { computeNBackResults } from "@/lib/nback-engine";
import type { NBackTrial } from "@/lib/nback-engine";
import type { TMTCombinedResults } from "@/lib/tmt-engine";

export const Route = createFileRoute("/_app/tests/$testId")({
  component: TestPreviewPage,
});

const testData: Record<string, {
  name: string;
  description: string;
  icon: typeof Brain;
  color: string;
  bgColor: string;
  duration: string;
  instructions: string[];
  training: string;
}> = {
  simon: {
    name: "Tâche de Simon",
    description: "Mesure ton inhibition et ton temps de réaction",
    icon: Zap,
    color: "text-accent",
    bgColor: "bg-accent/10",
    duration: "~5 minutes",
    instructions: [
      "Un cercle coloré apparaît à gauche ou à droite de l'écran",
      "Appuie sur le bouton correspondant à la COULEUR, pas à la position",
      "Vert → bouton gauche / Rouge → bouton droit",
      "Réponds le plus vite possible en évitant les erreurs",
    ],
    training: "10 essais d'entraînement avant le test réel",
  },
  nback: {
    name: "N-Back 2",
    description: "Évalue ta mémoire de travail",
    icon: Brain,
    color: "text-primary",
    bgColor: "bg-primary/10",
    duration: "~8 minutes",
    instructions: [
      "Des lettres apparaissent une par une au centre de l'écran",
      "Appuie sur 'OUI' si la lettre est la même qu'il y a 2 positions",
      "Appuie sur 'NON' sinon",
      "Reste concentré, les lettres défilent rapidement",
    ],
    training: "10 essais d'entraînement avec feedback",
  },
  tmt: {
    name: "Trail Making Test",
    description: "Évalue ta flexibilité cognitive",
    icon: GitBranch,
    color: "text-chart-3",
    bgColor: "bg-chart-3/10",
    duration: "~6 minutes",
    instructions: [
      "Partie A : Relie les nombres dans l'ordre (1→2→3→...→25)",
      "Partie B : Alterne nombres et lettres (1→A→2→B→...→13)",
      "Touche les cercles dans le bon ordre le plus vite possible",
      "Les erreurs sont signalées — corrige-les avant de continuer",
    ],
    training: "Phase d'entraînement obligatoire",
  },
};

type TestState = "preview" | "running" | "results";

function TestPreviewPage() {
  const { testId } = Route.useParams();
  const [state, setState] = useState<TestState>("preview");
  const [simonResults, setSimonResults] = useState<ReturnType<typeof computeSimonResults> | null>(null);
  const [nbackResults, setNbackResults] = useState<ReturnType<typeof computeNBackResults> | null>(null);
  const test = testData[testId];

  if (!test) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <p className="text-muted-foreground">Test introuvable</p>
      </div>
    );
  }

  // Simon test running
  if (testId === "simon" && state === "running") {
    return (
      <SimonTest
        onComplete={async (results, rawTrials) => {
          setSimonResults(results);
          setState("results");

          // Try to save to DB (will work once tables exist)
          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: session } = await (supabase as any)
                .from("sessions_test")
                .insert({
                  user_id: user.id,
                  test_type: "simon",
                  score_global: results.accuracy,
                  duree_totale: rawTrials.reduce((s, t) => s + (t.responseTime || 0), 0),
                  donnees_brutes: { trials: rawTrials },
                })
                .select()
                .single();

              if (session) {
                await (supabase as any).from("resultats_test").insert({
                  session_id: (session as any).id,
                  user_id: user.id,
                  test_type: "simon",
                  metrique: "simon_effect",
                  valeur: results.simonEffect,
                  unite: "ms",
                  details: {
                    avg_rt: results.avgRT,
                    avg_congruent: results.avgCongruent,
                    avg_incongruent: results.avgIncongruent,
                    accuracy: results.accuracy,
                    error_rate: results.errorRate,
                    missed: results.missedCount,
                  },
                } as any);
              }
            }
          } catch (e) {
            console.warn("Could not save results:", e);
          }
        }}
      />
    );
  }

  // Simon results
  if (testId === "simon" && state === "results" && simonResults) {
    return <SimonResults results={simonResults} />;
  }

  // N-Back test running
  if (testId === "nback" && state === "running") {
    return (
      <NBackTest
        onComplete={async (results, rawTrials) => {
          setNbackResults(results);
          setState("results");

          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              const { data: session } = await (supabase as any)
                .from("sessions_test")
                .insert({
                  user_id: user.id,
                  test_type: "nback",
                  score_global: results.accuracy,
                  duree_totale: rawTrials.reduce((s, t) => s + (t.responseTime || 0), 0),
                  donnees_brutes: { trials: rawTrials },
                })
                .select()
                .single();

              if (session) {
                await (supabase as any).from("resultats_test").insert({
                  session_id: (session as any).id,
                  user_id: user.id,
                  test_type: "nback",
                  metrique: "target_error_rate",
                  valeur: results.targetErrorRate,
                  unite: "%",
                  details: {
                    hits: results.hits,
                    misses: results.misses,
                    false_alarms: results.falseAlarms,
                    correct_rejections: results.correctRejections,
                    accuracy: results.accuracy,
                    d_prime: results.dPrime,
                    avg_rt: results.avgRT,
                  },
                });
              }
            }
          } catch (e) {
            console.warn("Could not save N-Back results:", e);
          }
        }}
      />
    );
  }

  // N-Back results
  if (testId === "nback" && state === "results" && nbackResults) {
    return <NBackResults results={nbackResults} />;
  }

  const Icon = test.icon;

  return (
    <div className="min-h-screen bg-background px-5 pt-12 pb-24">
      <Link
        to="/tests"
        className="mb-6 flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour aux tests
      </Link>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col items-center text-center"
      >
        <div className={`mb-4 flex h-20 w-20 items-center justify-center rounded-3xl ${test.bgColor}`}>
          <Icon className={`h-10 w-10 ${test.color}`} />
        </div>
        <h1 className="text-2xl font-bold text-foreground">{test.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{test.description}</p>

        <div className="mt-4 flex items-center gap-2 rounded-full bg-muted px-4 py-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{test.duration}</span>
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-8"
      >
        <h2 className="mb-3 text-lg font-semibold text-foreground">Instructions</h2>
        <div className="flex flex-col gap-3">
          {test.instructions.map((instruction, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl bg-card p-3 border border-border">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {i + 1}
              </div>
              <p className="text-sm text-foreground">{instruction}</p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 rounded-xl border border-border bg-secondary/50 p-4"
      >
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-primary" />
          <p className="text-sm font-medium text-foreground">Phase d'entraînement</p>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {test.training} — obligatoire et non skippable, avec feedback visuel et textuel.
        </p>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-8"
      >
        <Button
          onClick={() => setState("running")}
          className="h-14 w-full text-base font-semibold"
          size="lg"
        >
          <Play className="mr-2 h-5 w-5" /> Commencer l'entraînement
        </Button>
      </motion.div>
    </div>
  );
}
