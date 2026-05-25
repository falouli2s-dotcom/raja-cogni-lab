import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ExerciseCard } from "./ExerciseCard";
import { ExerciseModal } from "./ExerciseModal";
import { RecommendedExercises } from "./RecommendedExercises";
import { BLOCS, NIVEAUX, STIMULUS_TYPES, BLOC_COLORS } from "./exercise-constants";
import { useT } from "@/locales/translations";
import type { Exercice } from "@/routes/_app.exercises";

interface Props {
  exercices: Exercice[];
  loading: boolean;
}

export function ExerciseCatalog({ exercices, loading }: Props) {
  const t = useT();
  const niveauLabel = (n: string) =>
    n === "Faible" ? t.exercises.levelLow : n === "Moyen" ? t.exercises.levelMedium : n === "Élevé" ? t.exercises.levelHigh : n;
  const [search, setSearch] = useState("");
  const [selectedBlocs, setSelectedBlocs] = useState<string[]>([]);
  const [selectedNiveaux, setSelectedNiveaux] = useState<string[]>([]);
  const [selectedStimulus, setSelectedStimulus] = useState<string[]>([]);
  const [modalExercice, setModalExercice] = useState<Exercice | null>(null);

  const indicateurs = useMemo(
    () => [...new Set(exercices.map((e) => e.indicateur_cognitif))],
    [exercices]
  );
  const [selectedIndicateurs, setSelectedIndicateurs] = useState<string[]>([]);

  const filtered = useMemo(() => {
    return exercices.filter((e) => {
      if (selectedBlocs.length && !selectedBlocs.includes(e.bloc)) return false;
      if (selectedNiveaux.length && !selectedNiveaux.some((n) => e.niveau.includes(n)))
        return false;
      if (selectedStimulus.length && !selectedStimulus.some((s) => e.stimulus_type.includes(s)))
        return false;
      if (selectedIndicateurs.length && !selectedIndicateurs.includes(e.indicateur_cognitif))
        return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          e.titre.toLowerCase().includes(q) ||
          e.objectif_cognitif.toLowerCase().includes(q) ||
          e.indicateur_cognitif.toLowerCase().includes(q) ||
          e.bloc.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [exercices, selectedBlocs, selectedNiveaux, selectedStimulus, selectedIndicateurs, search]);

  const toggleChip = (
    value: string,
    selected: string[],
    setter: (v: string[]) => void
  ) => {
    setter(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  const hasFilters =
    selectedBlocs.length > 0 ||
    selectedNiveaux.length > 0 ||
    selectedStimulus.length > 0 ||
    selectedIndicateurs.length > 0 ||
    search.length > 0;

  return (
    <div className="px-4 pt-10 pb-28">
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground">{t.exercises.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.exercises.shownOf(filtered.length, exercices.length)}
        </p>
      </motion.div>

      <RecommendedExercises onSelect={setModalExercice} />


      {/* Search */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mt-4 relative"
      >
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t.exercises.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ps-9 pe-8 bg-card border-border"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute end-3 top-1/2 -translate-y-1/2"
          >
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        )}
      </motion.div>

      {/* Filters */}
      <div className="mt-4 space-y-2">
        <FilterRow
          label={t.exercises.bloc}
          items={BLOCS}
          selected={selectedBlocs}
          onToggle={(v) => toggleChip(v, selectedBlocs, setSelectedBlocs)}
          colorFn={(v) => BLOC_COLORS[v] || "bg-muted text-muted-foreground"}
        />
        <FilterRow
          label={t.exercises.niveau}
          items={NIVEAUX}
          selected={selectedNiveaux}
          onToggle={(v) => toggleChip(v, selectedNiveaux, setSelectedNiveaux)}
          renderItem={niveauLabel}
        />
        <FilterRow
          label={t.exercises.stimulus}
          items={STIMULUS_TYPES}
          selected={selectedStimulus}
          onToggle={(v) => toggleChip(v, selectedStimulus, setSelectedStimulus)}
        />
        {indicateurs.length > 0 && (
          <FilterRow
            label={t.exercises.indicateur}
            items={indicateurs}
            selected={selectedIndicateurs}
            onToggle={(v) => toggleChip(v, selectedIndicateurs, setSelectedIndicateurs)}
          />
        )}
        {hasFilters && (
          <button
            onClick={() => {
              setSelectedBlocs([]);
              setSelectedNiveaux([]);
              setSelectedStimulus([]);
              setSelectedIndicateurs([]);
              setSearch("");
            }}
            className="text-xs text-primary underline"
          >
            {t.exercises.resetFilters}
          </button>
        )}
      </div>

      {/* List */}
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
          {t.exercises.noResult}
        </motion.div>
      ) : (
        <div className="mt-4 flex flex-col gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((ex, i) => (
              <ExerciseCard
                key={ex.id}
                exercice={ex}
                index={i}
                onClick={() => setModalExercice(ex)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modal */}
      <ExerciseModal
        exercice={modalExercice}
        onClose={() => setModalExercice(null)}
      />
    </div>
  );
}

function FilterRow({
  label,
  items,
  selected,
  onToggle,
  colorFn,
  renderItem,
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
  colorFn?: (v: string) => string;
  renderItem?: (v: string) => string;
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none items-center">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase shrink-0 w-16">
        {label}
      </span>
      {items.map((item) => {
        const active = selected.includes(item);
        const base = colorFn?.(item);
        return (
          <button
            key={item}
            onClick={() => onToggle(item)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition-all border ${
              active
                ? base
                  ? `${base} border-current ring-1 ring-current/30`
                  : "bg-primary text-primary-foreground border-primary"
                : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted"
            }`}
          >
            {renderItem ? renderItem(item) : item}
          </button>
        );
      })}
    </div>
  );
}
