import { motion } from "framer-motion";
import { ChevronRight, Clock, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { BLOC_COLORS, NIVEAU_COLORS, getTestIcon } from "./exercise-constants";
import type { Exercice } from "@/routes/_app.exercises";

interface Props {
  exercice: Exercice;
  index: number;
  onClick: () => void;
}

export function ExerciseCard({ exercice: ex, index, onClick }: Props) {
  const blocColor = BLOC_COLORS[ex.bloc] || "bg-muted text-muted-foreground";
  const niveauColor = NIVEAU_COLORS[ex.niveau] || "bg-muted text-muted-foreground border-border";
  const testIcon = getTestIcon(ex.alignement_test_digital);

  return (
    <motion.div
      layout
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -10, opacity: 0 }}
      transition={{ delay: index * 0.02 }}
      onClick={onClick}
      className="cursor-pointer rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-lg active:scale-[0.98]"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge variant="outline" className={`text-[10px] border ${blocColor}`}>
              {ex.bloc}
            </Badge>
            <Badge variant="outline" className={`text-[10px] border ${niveauColor}`}>
              {ex.niveau}
            </Badge>
            <span className="text-sm" title={ex.alignement_test_digital}>
              {testIcon}
            </span>
          </div>
          <h3 className="mt-2 font-semibold text-foreground leading-tight text-sm">
            <span className="text-muted-foreground font-normal">#{ex.numero}</span>{" "}
            {ex.titre}
          </h3>
          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
            {ex.objectif_cognitif}
          </p>
        </div>
        <Badge variant="outline" className="text-[10px] text-primary border-primary shrink-0 mt-1">
          ▶ Démarrer
        </Badge>
      </div>

      {/* Footer meta */}
      <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {ex.series}×{ex.duree_serie}
        </span>
        <span className="flex items-center gap-1">
          <RotateCcw className="h-3 w-3" />
          {ex.recuperation_secondes}s récup
        </span>
        <Badge variant="outline" className="text-[9px] ml-auto border-border">
          {ex.indicateur_cognitif}
        </Badge>
      </div>
    </motion.div>
  );
}
