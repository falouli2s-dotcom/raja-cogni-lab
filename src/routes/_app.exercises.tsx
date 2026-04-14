import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import {
  Dumbbell,
  Brain,
  Zap,
  Shield,
  Eye,
  Target,
  Clock,
  Star,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_app/exercises")({
  component: ExercisesPage,
});

type Categorie =
  | "attention"
  | "memoire"
  | "flexibilite"
  | "inhibition"
  | "vitesse"
  | "anticipation";

interface Exercice {
  id: string;
  titre: string;
  description: string;
  categorie: Categorie;
  difficulte: number;
  duree_minutes: number;
  instructions: string | null;
}

const CATEGORIES: { value: Categorie | "all"; label: string; icon: React.ReactNode }[] = [
  { value: "all", label: "Tous", icon: <Dumbbell className="h-4 w-4" /> },
  { value: "attention", label: "Attention", icon: <Eye className="h-4 w-4" /> },
  { value: "memoire", label: "Mémoire", icon: <Brain className="h-4 w-4" /> },
  { value: "flexibilite", label: "Flexibilité", icon: <Zap className="h-4 w-4" /> },
  { value: "inhibition", label: "Inhibition", icon: <Shield className="h-4 w-4" /> },
  { value: "vitesse", label: "Vitesse", icon: <Target className="h-4 w-4" /> },
  { value: "anticipation", label: "Anticipation", icon: <Clock className="h-4 w-4" /> },
];

const CATEGORY_COLORS: Record<Categorie, string> = {
  attention: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  memoire: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  flexibilite: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  inhibition: "bg-red-500/15 text-red-400 border-red-500/30",
  vitesse: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  anticipation: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

function DifficultyStars({ level }: { level: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3].map((i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i <= level ? "fill-accent text-accent" : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

function ExercisesPage() {
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Categorie | "all">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("exercices")
        .select("id, titre, description, categorie, difficulte, duree_minutes, instructions")
        .order("categorie")
        .order("difficulte");
      if (data) setExercices(data as Exercice[]);
      setLoading(false);
    }
    load();
  }, []);

  const filtered =
    filter === "all"
      ? exercices
      : exercices.filter((e) => e.categorie === filter);

  return (
    <div className="px-5 pt-12 pb-28">
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground">Exercices</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {exercices.length} exercices cognitifs disponibles
        </p>
      </motion.div>

      {/* Category filter chips */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mt-5 flex gap-2 overflow-x-auto pb-2 scrollbar-none"
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilter(cat.value)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium transition-all ${
              filter === cat.value
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat.icon}
            {cat.label}
          </button>
        ))}
      </motion.div>

      {/* Exercise list */}
      {loading ? (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-12 text-center text-sm text-muted-foreground"
        >
          Aucun exercice dans cette catégorie
        </motion.div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((ex, i) => {
              const isExpanded = expandedId === ex.id;
              return (
                <motion.div
                  key={ex.id}
                  layout
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -10, opacity: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setExpandedId(isExpanded ? null : ex.id)}
                  className="cursor-pointer rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${CATEGORY_COLORS[ex.categorie]}`}
                        >
                          {CATEGORIES.find((c) => c.value === ex.categorie)?.label}
                        </Badge>
                        <DifficultyStars level={ex.difficulte} />
                      </div>
                      <h3 className="mt-2 font-semibold text-foreground leading-tight">
                        {ex.titre}
                      </h3>
                      <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                        {ex.description}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">
                        {ex.duree_minutes} min
                      </span>
                      <ChevronRight
                        className={`h-4 w-4 text-muted-foreground transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && ex.instructions && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-3 rounded-xl bg-muted/50 p-3">
                          <p className="text-xs font-medium text-foreground mb-1">
                            Instructions
                          </p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            {ex.instructions}
                          </p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
