import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Pencil,
  Dumbbell,
  Target,
  Brain,
  Timer,
  Sparkles,
  Play,
  CheckCircle2,
  ArrowRight,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { ExercisePlayer } from "@/components/exercises/ExercisePlayer";
import {
  type ExerciceOverride,
  normalizeStimuli,
  normalizeDistances,
  type DistancesOverride,
} from "@/lib/exercise-overrides";

/**
 * Map a coach's free-text / chip stimulus override to a stimulus_type key
 * supported by the ExercisePlayer engine.
 */
function resolveStimulusType(
  overrideStimuli: string[] | undefined,
  catalogType: string,
): string {
  if (!overrideStimuli || overrideStimuli.length === 0) return catalogType;
  const lower = overrideStimuli.join(" ").toLowerCase();
  if (
    lower.includes("couleur") ||
    lower.includes("maillot") ||
    lower.includes("cône") ||
    lower.includes("cone") ||
    lower.includes("balle color")
  )
    return "couleur";
  if (
    lower.includes("flèche") ||
    lower.includes("fleche") ||
    lower.includes("direction") ||
    lower.includes("panneau")
  )
    return "fleche";
  if (lower.includes("nombre") || lower.includes("chiffre")) return "nombre";
  if (
    lower.includes("flash") ||
    lower.includes("lumière") ||
    lower.includes("lumineux") ||
    lower.includes("sifflet") ||
    lower.includes("sonore")
  )
    return "flash";
  if (lower.includes("forme")) return "forme";
  return catalogType;
}

type PlanningRow = {
  id: string;
  player_id: string;
  coach_id: string;
  scheduled_at: string;
  completed_at: string | null;
  status: string;
  session_category: string;
  exercice_ids: string[] | null;
  exercice_overrides: Record<string, ExerciceOverride> | null;
  note: string | null;
};

type ExerciceRow = {
  id: string;
  numero: number;
  titre: string;
  niveau: string;
  indicateur_cognitif: string;
  objectif_cognitif: string;
  tache_motrice: string;
  duree_serie: string;
  series: number;
  recuperation_secondes: number;
  materiel: string | null;
  stimulus_type: string;
  stimulus_detail: any;
};

export const Route = createFileRoute("/_app/training/$planningId")({
  component: TrainingDetailPage,
});

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtShort(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ---------- Read-only display helpers ---------- */

function StimuliDisplay({
  override,
  fallback,
}: {
  override: string[] | null;
  fallback: string;
}) {
  if (override && override.length > 0) {
    return (
      <div className="flex flex-wrap gap-1">
        {override.map((s) => (
          <span
            key={s}
            className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary"
          >
            {s}
          </span>
        ))}
      </div>
    );
  }
  return <p className="text-xs text-foreground">{fallback}</p>;
}

function DistanceDisplay({
  override,
  fallback,
}: {
  override: DistancesOverride | null;
  fallback: string;
}) {
  if (override && (override.distance || override.grid)) {
    return (
      <div className="space-y-0.5">
        {override.distance && (
          <p className="text-sm font-semibold text-foreground">
            {override.distance}
          </p>
        )}
        {override.grid && (
          <p className="text-[11px] text-muted-foreground">
            Grille : {override.grid}
          </p>
        )}
      </div>
    );
  }
  return <p className="text-xs text-foreground">{fallback}</p>;
}

function TrainingDetailPage() {
  const { planningId } = Route.useParams();
  const navigate = useNavigate();
  const [planning, setPlanning] = useState<PlanningRow | null>(null);
  const [exercices, setExercices] = useState<ExerciceRow[]>([]);
  const [coachName, setCoachName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/login", replace: true });
        return;
      }

      const { data: p } = await (supabase as any)
        .from("sessions_planifiees")
        .select(
          "id, player_id, coach_id, scheduled_at, completed_at, status, session_category, exercice_ids, exercice_overrides, note"
        )
        .eq("id", planningId)
        .maybeSingle();

      if (!p || p.player_id !== user.id) {
        setLoading(false);
        return;
      }
      setPlanning(p as PlanningRow);

      const ids = (p.exercice_ids ?? []) as string[];
      if (ids.length > 0) {
        const { data: ex } = await supabase
          .from("exercices")
          .select(
            "id, numero, titre, niveau, indicateur_cognitif, objectif_cognitif, tache_motrice, duree_serie, series, recuperation_secondes, materiel, stimulus_type, stimulus_detail"
          )
          .in("id", ids);
        const map = new Map<string, ExerciceRow>(
          (ex ?? []).map((e: any) => [e.id, e as ExerciceRow])
        );
        setExercices(ids.map((i) => map.get(i)).filter(Boolean) as ExerciceRow[]);
      }

      const { data: coachProfile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", p.coach_id)
        .maybeSingle();
      setCoachName((coachProfile as any)?.full_name ?? null);

      setLoading(false);
    })();
  }, [planningId, navigate]);

  async function handleFinish() {
    if (!planning || completing) return;
    setCompleting(true);
    const { error } = await (supabase as any)
      .from("sessions_planifiees")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", planning.id);
    setCompleting(false);
    if (error) {
      toast.error("Impossible de marquer la séance comme terminée");
      return;
    }
    toast.success("Séance terminée ! Bon travail 💪");
    navigate({ to: "/exercises" });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!planning) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-muted-foreground">Séance introuvable</p>
        <Link to="/exercises" className="text-sm text-primary underline">
          Aller aux exercices
        </Link>
      </div>
    );
  }

  const overrides = planning.exercice_overrides ?? {};
  const isCompleted = planning.status === "completed";

  return (
    <div className="px-5 pt-12 pb-32">
      <Link
        to="/exercises"
        className="mb-3 inline-flex items-center gap-2 text-sm text-muted-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </Link>

      <motion.header
        initial={{ y: -8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Séance d'entraînement
        </p>
        <h1 className="mt-1 text-2xl font-bold text-foreground">
          {exercices.length} exercice{exercices.length > 1 ? "s" : ""} terrain
        </h1>
        <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{fmtDate(planning.scheduled_at)}</span>
        </div>
        {coachName && (
          <p className="mt-1 text-xs text-muted-foreground">
            Assigné par <span className="text-foreground">{coachName}</span>
          </p>
        )}
        {planning.note && (
          <p className="mt-3 rounded-xl border border-border bg-card p-3 text-sm italic text-muted-foreground">
            « {planning.note} »
          </p>
        )}
      </motion.header>

      <div className="mt-6 flex flex-col gap-3">
        {exercices.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center text-sm text-muted-foreground">
            Aucun exercice attaché à cette séance.
          </p>
        )}
        {exercices.map((ex, i) => {
          const ov = overrides[ex.id] ?? {};
          const stimuliOv = normalizeStimuli(ov.stimuli);
          const stimuliFallback =
            ex.stimulus_type ||
            (ex.stimulus_detail
              ? typeof ex.stimulus_detail === "string"
                ? ex.stimulus_detail
                : JSON.stringify(ex.stimulus_detail)
              : "—");
          const distancesOv = normalizeDistances(ov.distances);
          const materielValue = ov.materiel ?? ex.materiel ?? "—";

          return (
            <motion.article
              key={ex.id}
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.04 * i }}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-xs font-bold text-primary">
                  #{String(ex.numero).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground">
                    {ex.titre}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                      {ex.indicateur_cognitif}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                      {ex.niveau}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                <SpecRow
                  icon={<Target className="h-3.5 w-3.5 text-primary" />}
                  label="Objectif cognitif"
                >
                  <p className="text-xs text-foreground">{ex.objectif_cognitif}</p>
                </SpecRow>
                <SpecRow
                  icon={<Dumbbell className="h-3.5 w-3.5 text-primary" />}
                  label="Tâche motrice"
                >
                  <p className="text-xs text-foreground">{ex.tache_motrice}</p>
                </SpecRow>
                <SpecRow
                  icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
                  label="Stimuli"
                  customized={stimuliOv.length > 0}
                >
                  <StimuliDisplay
                    override={stimuliOv.length > 0 ? stimuliOv : null}
                    fallback={stimuliFallback}
                  />
                </SpecRow>
                <SpecRow
                  icon={<Brain className="h-3.5 w-3.5 text-primary" />}
                  label="Matériel"
                  customized={!!ov.materiel}
                >
                  <p className="text-xs text-foreground">{materielValue}</p>
                </SpecRow>
                {distancesOv && (
                  <SpecRow
                    icon={<Pencil className="h-3.5 w-3.5 text-primary" />}
                    label="Distances / dimensions"
                    customized
                  >
                    <DistanceDisplay override={distancesOv} fallback="—" />
                  </SpecRow>
                )}
                <SpecRow
                  icon={<Timer className="h-3.5 w-3.5 text-primary" />}
                  label="Format"
                >
                  <p className="text-xs text-foreground">
                    {ex.duree_serie} — {ex.series} série
                    {ex.series > 1 ? "s" : ""} · récup.{" "}
                    {ex.recuperation_secondes}s
                  </p>
                </SpecRow>
              </div>
            </motion.article>
          );
        })}
      </div>

      {/* In-flow CTA (not fixed — pb on container clears BottomNav) */}
      {exercices.length > 0 && (
        isCompleted ? (
          <div className="mt-6 mb-2 text-center">
            <p className="text-sm font-medium text-muted-foreground">
              ✓ Séance terminée
            </p>
            {planning.completed_at && (
              <p className="mt-1 text-xs text-muted-foreground">
                {fmtShort(planning.completed_at)}
              </p>
            )}
          </div>
        ) : (
          <button
            onClick={() => {
              setCurrentIdx(0);
              setRunning(true);
            }}
            className="mt-6 mb-2 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 text-base font-semibold text-primary-foreground transition-transform active:scale-95"
          >
            <Play className="h-5 w-5" />
            Commencer les exercices
          </button>
        )
      )}

      {/* Full-screen exercise runner */}
      <AnimatePresence>
        {running && exercices[currentIdx] && (
          <ExerciseRunner
            exercice={exercices[currentIdx]}
            override={overrides[exercices[currentIdx].id] ?? {}}
            index={currentIdx}
            total={exercices.length}
            onClose={() => setRunning(false)}
            onNext={() => setCurrentIdx((i) => i + 1)}
            onFinish={handleFinish}
            finishing={completing}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function SpecRow({
  icon,
  label,
  customized,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  customized?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2.5 rounded-xl border border-border bg-background/40 p-2.5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          {customized && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold text-accent">
              <Pencil className="h-2 w-2" />
              Adapté par le coach
            </span>
          )}
        </div>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  );
}

/* ---------- Full-screen runner ---------- */

function ExerciseRunner({
  exercice,
  override,
  index,
  total,
  onClose,
  onNext,
  onFinish,
  finishing,
}: {
  exercice: ExerciceRow;
  override: ExerciceOverride;
  index: number;
  total: number;
  onClose: () => void;
  onNext: () => void;
  onFinish: () => void;
  finishing: boolean;
}) {
  const isLast = index === total - 1;
  const stimuliOv = normalizeStimuli(override.stimuli);
  const stimuliFallback =
    exercice.stimulus_type ||
    (exercice.stimulus_detail
      ? typeof exercice.stimulus_detail === "string"
        ? exercice.stimulus_detail
        : JSON.stringify(exercice.stimulus_detail)
      : "—");
  const distancesOv = normalizeDistances(override.distances);
  const materielValue = override.materiel ?? exercice.materiel ?? "—";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col bg-background"
    >
      {/* Top bar */}
      <div className="flex items-center gap-3 border-b border-border px-5 pt-12 pb-3">
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-muted-foreground"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Exercice {index + 1} / {total}
          </p>
          <Progress
            value={((index + 1) / total) * 100}
            className="mt-1 h-1.5"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <motion.div
          key={exercice.id}
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="space-y-4"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-sm font-bold text-primary">
              #{String(exercice.numero).padStart(2, "0")}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-foreground">
                {exercice.titre}
              </h2>
              <div className="mt-1 flex flex-wrap gap-1">
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                  {exercice.indicateur_cognitif}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  {exercice.niveau}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <SpecRow
              icon={<Target className="h-3.5 w-3.5 text-primary" />}
              label="Objectif cognitif"
            >
              <p className="text-xs text-foreground">
                {exercice.objectif_cognitif}
              </p>
            </SpecRow>
            <SpecRow
              icon={<Dumbbell className="h-3.5 w-3.5 text-primary" />}
              label="Tâche motrice"
            >
              <p className="text-xs text-foreground">{exercice.tache_motrice}</p>
            </SpecRow>
            <SpecRow
              icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
              label="Stimuli"
              customized={stimuliOv.length > 0}
            >
              <StimuliDisplay
                override={stimuliOv.length > 0 ? stimuliOv : null}
                fallback={stimuliFallback}
              />
            </SpecRow>
            <SpecRow
              icon={<Brain className="h-3.5 w-3.5 text-primary" />}
              label="Matériel"
              customized={!!override.materiel}
            >
              <p className="text-xs text-foreground">{materielValue}</p>
            </SpecRow>
            {distancesOv && (
              <SpecRow
                icon={<Pencil className="h-3.5 w-3.5 text-primary" />}
                label="Distances / dimensions"
                customized
              >
                <DistanceDisplay override={distancesOv} fallback="—" />
              </SpecRow>
            )}
            <SpecRow
              icon={<Timer className="h-3.5 w-3.5 text-primary" />}
              label="Format"
            >
              <p className="text-xs text-foreground">
                {exercice.duree_serie} — {exercice.series} série
                {exercice.series > 1 ? "s" : ""} · récup.{" "}
                {exercice.recuperation_secondes}s
              </p>
            </SpecRow>
          </div>
        </motion.div>
      </div>

      {/* Footer CTA */}
      <div className="border-t border-border bg-background px-5 py-3 pb-6">
        {isLast ? (
          <Button
            className="w-full"
            size="lg"
            disabled={finishing}
            onClick={onFinish}
          >
            <CheckCircle2 className="h-4 w-4" />
            {finishing ? "Validation…" : "Terminer la séance"}
          </Button>
        ) : (
          <Button className="w-full" size="lg" onClick={onNext}>
            Exercice suivant <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </motion.div>
  );
}
