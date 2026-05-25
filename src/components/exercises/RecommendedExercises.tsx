import { motion } from "framer-motion";
import { Loader2, Sparkles, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSessionRecommendations } from "@/hooks/useSessionRecommendations";
import { DIMENSION_BADGE_CLASS } from "@/lib/recommendations";
import { BLOC_COLORS, NIVEAU_COLORS, getTestIcon } from "./exercise-constants";
import type { Exercice } from "@/routes/_app.exercises";

interface Props {
  onSelect: (ex: Exercice) => void;
}

export function RecommendedExercises({ onSelect }: Props) {
  const { data, isLoading } = useSessionRecommendations();

  return (
    <motion.section
      initial={{ y: 8, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="mt-5"
    >
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          Recommandé pour toi
        </h2>
      </div>

      {isLoading ? (
        <div className="mt-3 flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !data?.hasSession ? (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
          Passe une session d'évaluation pour recevoir tes recommandations
        </div>
      ) : data.recommendations.length === 0 ? (
        <div className="mt-3 rounded-2xl border border-dashed border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
          Aucune recommandation pour le moment — tes scores sont solides 💪
        </div>
      ) : (
        <div className="mt-3 -mx-4 px-4 flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
          {data.recommendations.map((rec, i) => {
            const ex = rec.exercice;
            const blocColor = BLOC_COLORS[ex.bloc] || "bg-muted text-muted-foreground";
            const niveauColor =
              NIVEAU_COLORS[ex.niveau] || "bg-muted text-muted-foreground border-border";
            return (
              <motion.button
                key={ex.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => onSelect(ex)}
                className="snap-start shrink-0 w-[240px] text-left rounded-2xl border border-border bg-card p-3 hover:shadow-lg active:scale-[0.98] transition"
              >
                {ex.image_url && (
                  <img
                    src={ex.image_url}
                    alt={ex.titre}
                    loading="lazy"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                    className="w-full aspect-video rounded-xl object-cover bg-muted mb-2"
                  />
                )}
                <Badge
                  variant="outline"
                  className={`text-[10px] border ${DIMENSION_BADGE_CLASS[rec.dimensionKey]}`}
                >
                  {rec.dimensionLabel}
                </Badge>
                <h3 className="mt-2 font-semibold text-foreground text-sm leading-tight line-clamp-2">
                  <span className="text-muted-foreground font-normal">#{ex.numero}</span>{" "}
                  {ex.titre}
                </h3>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <Badge variant="outline" className={`text-[9px] border ${blocColor}`}>
                    {ex.bloc}
                  </Badge>
                  <Badge variant="outline" className={`text-[9px] border ${niveauColor}`}>
                    {ex.niveau}
                  </Badge>
                  <span className="text-xs">{getTestIcon(ex.alignement_test_digital)}</span>
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {ex.series}×{ex.duree_serie}
                </div>
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}
