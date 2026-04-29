import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { X, Clock, RotateCcw, BookOpen, Dumbbell, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { BLOC_COLORS, NIVEAU_COLORS, getTestIcon } from "./exercise-constants";
import { ExercisePlayer } from "./ExercisePlayer";
import type { Exercice } from "@/routes/_app.exercises";

interface Props {
  exercice: Exercice | null;
  onClose: () => void;
}

export function ExerciseModal({ exercice: ex, onClose }: Props) {
  const [playerOpen, setPlayerOpen] = useState(false);

  // Reset player state when modal closes
  const handleClose = () => {
    setPlayerOpen(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {ex && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          {/* Modal */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-card border-t border-border pb-[calc(env(safe-area-inset-bottom)+5rem)]"
          >
            {/* Handle */}
            <div className="sticky top-0 z-10 bg-card pt-3 pb-2 px-5 flex items-center justify-between">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
              <div />
              <button onClick={handleClose} className="p-1.5 rounded-full hover:bg-muted">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            <div className="px-5 pb-10">
              {/* Title */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <Badge variant="outline" className={`text-[10px] border ${BLOC_COLORS[ex.bloc] || ""}`}>
                  {ex.bloc}
                </Badge>
                <Badge variant="outline" className={`text-[10px] border ${NIVEAU_COLORS[ex.niveau] || ""}`}>
                  {ex.niveau}
                </Badge>
                <span className="text-lg">{getTestIcon(ex.alignement_test_digital)}</span>
              </div>
              <h2 className="text-xl font-bold text-foreground">
                <span className="text-muted-foreground font-normal">#{ex.numero}</span>{" "}
                {ex.titre}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {ex.alignement_test_digital}
              </p>

              {/* Objectif */}
              <Section icon={<Zap className="h-4 w-4" />} title="Objectif cognitif">
                <p className="text-sm text-foreground/90">{ex.objectif_cognitif}</p>
              </Section>

              {/* Matériel */}
              {ex.materiel && (
                <Section icon={<Dumbbell className="h-4 w-4" />} title="Matériel nécessaire">
                  <p className="text-sm text-foreground/90">{ex.materiel}</p>
                </Section>
              )}

              {/* Tâche motrice */}
              <Section icon={<Dumbbell className="h-4 w-4" />} title="Tâche motrice">
                <p className="text-sm text-foreground/90">{ex.tache_motrice}</p>
              </Section>

              {/* Stimulus & Règle */}
              <Section icon={<Zap className="h-4 w-4" />} title={`Stimulus : ${ex.stimulus_type}`}>
                {ex.regle_reponse && (
                  <p className="text-sm font-medium text-foreground mb-2">
                    {ex.regle_reponse}
                  </p>
                )}
                {ex.stimulus_detail && (
                  <StimulusDetail detail={ex.stimulus_detail as Record<string, unknown>} />
                )}
              </Section>

              {/* Durée */}
              <Section icon={<Clock className="h-4 w-4" />} title="Organisation">
                <div className="flex gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Séries :</span>{" "}
                    <span className="font-semibold text-foreground">{ex.series}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Durée :</span>{" "}
                    <span className="font-semibold text-foreground">{ex.duree_serie}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <RotateCcw className="h-3 w-3 text-muted-foreground" />
                    <span className="font-semibold text-foreground">{ex.recuperation_secondes}s</span>
                  </div>
                </div>
                {(ex as any).stimulus_interval_min != null && (
                  <div className="mt-2 text-sm">
                    <span className="text-muted-foreground">Intervalle stimulus :</span>{" "}
                    <span className="font-semibold text-foreground">
                      {(ex as any).stimulus_interval_min}–{(ex as any).stimulus_interval_max} s
                    </span>
                  </div>
                )}
              </Section>

              {/* Source */}
              {ex.source_scientifique && (
                <Section icon={<BookOpen className="h-4 w-4" />} title="Source scientifique">
                  <p className="text-xs text-muted-foreground italic">{ex.source_scientifique}</p>
                </Section>
              )}

              {/* Start button */}
              <Button
                className="w-full h-12 text-base font-semibold mt-6"
                onClick={() => setPlayerOpen(true)}
              >
                ▶ Commencer l'exercice
              </Button>
            </div>
          </motion.div>

          {/* Player overlay */}
          {playerOpen && (
            <ExercisePlayer exercice={ex} onClose={() => setPlayerOpen(false)} />
          )}
        </>
      )}
    </AnimatePresence>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-primary">{icon}</span>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
      </div>
      <div className="rounded-xl bg-muted/40 p-3">{children}</div>
    </div>
  );
}

function StimulusDetail({ detail }: { detail: Record<string, unknown> }) {
  return (
    <div className="space-y-1.5">
      {Object.entries(detail).map(([key, value]) => {
        const label = key.replace(/_/g, " ");
        if (value === null || value === undefined) return null;
        if (typeof value === "object" && !Array.isArray(value)) {
          return (
            <div key={key}>
              <span className="text-xs font-medium text-muted-foreground capitalize">{label} :</span>
              <div className="ml-3 mt-0.5">
                {Object.entries(value as Record<string, unknown>).map(([k, v]) => (
                  <p key={k} className="text-xs text-foreground/80">
                    <span className="text-muted-foreground">{k.replace(/_/g, " ")} :</span>{" "}
                    {String(v)}
                  </p>
                ))}
              </div>
            </div>
          );
        }
        if (Array.isArray(value)) {
          return (
            <p key={key} className="text-xs text-foreground/80">
              <span className="text-muted-foreground capitalize">{label} :</span>{" "}
              {value.join(", ")}
            </p>
          );
        }
        return (
          <p key={key} className="text-xs text-foreground/80">
            <span className="text-muted-foreground capitalize">{label} :</span>{" "}
            {String(value)}
          </p>
        );
      })}
    </div>
  );
}
