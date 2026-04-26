import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Calendar,
  Pencil,
  Dumbbell,
  Target,
  Brain,
  Timer,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type ExerciceOverride = {
  stimuli?: string;
  materiel?: string;
  distances?: string;
};

type PlanningRow = {
  id: string;
  player_id: string;
  coach_id: string;
  scheduled_at: string;
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

function TrainingDetailPage() {
  const { planningId } = Route.useParams();
  const navigate = useNavigate();
  const [planning, setPlanning] = useState<PlanningRow | null>(null);
  const [exercices, setExercices] = useState<ExerciceRow[]>([]);
  const [coachName, setCoachName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
          "id, player_id, coach_id, scheduled_at, status, session_category, exercice_ids, exercice_overrides, note"
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
        // Preserve coach-defined order
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

  return (
    <div className="px-5 pt-12 pb-24">
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
          const baseStimuli =
            ex.stimulus_type ||
            (ex.stimulus_detail
              ? typeof ex.stimulus_detail === "string"
                ? ex.stimulus_detail
                : JSON.stringify(ex.stimulus_detail)
              : "—");
          const stimuliValue = ov.stimuli ?? baseStimuli;
          const materielValue = ov.materiel ?? ex.materiel ?? "—";
          const distancesValue = ov.distances ?? null;

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
                  value={ex.objectif_cognitif}
                />
                <SpecRow
                  icon={<Dumbbell className="h-3.5 w-3.5 text-primary" />}
                  label="Tâche motrice"
                  value={ex.tache_motrice}
                />
                <SpecRow
                  icon={<Sparkles className="h-3.5 w-3.5 text-primary" />}
                  label="Stimuli"
                  value={stimuliValue}
                  customized={!!ov.stimuli}
                />
                <SpecRow
                  icon={<Brain className="h-3.5 w-3.5 text-primary" />}
                  label="Matériel"
                  value={materielValue}
                  customized={!!ov.materiel}
                />
                {distancesValue !== null && (
                  <SpecRow
                    icon={<Pencil className="h-3.5 w-3.5 text-primary" />}
                    label="Distances / dimensions"
                    value={distancesValue}
                    customized={true}
                  />
                )}
                <SpecRow
                  icon={<Timer className="h-3.5 w-3.5 text-primary" />}
                  label="Format"
                  value={`${ex.duree_serie} — ${ex.series} série${ex.series > 1 ? "s" : ""} · récup. ${ex.recuperation_secondes}s`}
                />
              </div>
            </motion.article>
          );
        })}
      </div>
    </div>
  );
}

function SpecRow({
  icon,
  label,
  value,
  customized,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  customized?: boolean;
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
        <p className="mt-0.5 text-xs text-foreground">{value}</p>
      </div>
    </div>
  );
}
