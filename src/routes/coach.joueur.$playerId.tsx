import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle2, Clock } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import {
  BLOC_COLORS,
  NIVEAU_COLORS,
  getTestIcon,
} from "@/components/exercises/exercise-constants";
import { ExportModal } from "@/components/coach/ExportModal";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/coach/joueur/$playerId")({
  component: CoachJoueurDetail,
});

function initials(name?: string | null) {
  if (!name) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function CoachJoueurDetail() {
  const navigate = useNavigate();
  const { playerId } = Route.useParams();

  const [profile, setProfile] = useState<any>(null);
  const [plannings, setPlannings] = useState<any[]>([]);
  const [exerciceMap, setExerciceMap] = useState<Record<string, any>>({});
  const [completedSet, setCompletedSet] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"pending" | "history">("pending");
  const [coachId, setCoachId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const coachUid = user?.id;
      if (!coachUid) return;
      setCoachId(coachUid);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, category, position")
        .eq("id", playerId)
        .single();
      setProfile(profileData);

      const { data: planningsData } = await (supabase as any)
        .from("sessions_planifiees")
        .select("*")
        .eq("coach_id", coachUid)
        .eq("player_id", playerId)
        .eq("session_category", "exercices")
        .order("scheduled_at", { ascending: false });

      const planningsArr = planningsData ?? [];
      setPlannings(planningsArr);

      const allIds = [
        ...new Set(
          planningsArr.flatMap((p: any) => p.exercice_ids ?? [])
        ),
      ] as string[];

      const { data: exercicesData } =
        allIds.length > 0
          ? await supabase
              .from("exercices")
              .select(
                "id, titre, numero, bloc, niveau, indicateur_cognitif, stimulus_type, series, duree_serie, alignement_test_digital"
              )
              .in("id", allIds)
          : { data: [] };

      setExerciceMap(
        Object.fromEntries(
          (exercicesData ?? []).map((e: any) => [e.id, e])
        )
      );

      const planningIds = planningsArr.map((p: any) => p.id);
      const { data: completedData } =
        planningIds.length > 0
          ? await (supabase as any)
              .from("completed_exercises")
              .select("exercise_id, planning_id, completed_at, series_completed")
              .eq("user_id", playerId)
              .in("planning_id", planningIds)
          : { data: [] };

      setCompletedSet(
        new Set(
          (completedData ?? []).map(
            (c: any) => `${c.exercise_id}|${c.planning_id}`
          )
        )
      );

      setLoading(false);
    })();
  }, [playerId]);

  // Real-time subscription: keep planning statuses up-to-date without a full
  // page refetch when the player completes exercises.
  useEffect(() => {
    const channel = supabase
      .channel(`planning-updates-${playerId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "sessions_planifiees",
          filter: `player_id=eq.${playerId}`,
        },
        (payload) => {
          setPlannings((prev) =>
            prev.map((p) =>
              p.id === payload.new.id ? { ...p, ...payload.new } : p
            )
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId]);

  const pendingPlannings = plannings
    .filter((p) => p.status === "pending")
    .slice()
    .sort(
      (a, b) =>
        new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime()
    );

  const historyPlannings = plannings
    .filter((p) => p.status !== "pending")
    .slice()
    .sort(
      (a, b) =>
        new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()
    );

  const pendingCount = pendingPlannings
    .flatMap((p: any) => (p.exercice_ids ?? []).map((id: string) => ({ id, planning: p })))
    .filter(({ id, planning }) => !completedSet.has(`${id}|${planning.id}`))
    .length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-12 pb-6">
      {/* Header */}
      <header className="mb-6">
        <button
          onClick={() => navigate({ to: "/coach/joueurs" })}
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </button>
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-base font-bold text-primary">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.full_name ?? ""}
                className="h-full w-full object-cover"
              />
            ) : (
              initials(profile?.full_name)
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-bold text-foreground">
              {profile?.full_name ?? "Joueur"}
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {profile?.category && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {profile.category}
                </span>
              )}
              {profile?.position && (
                <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[11px] font-medium text-accent">
                  {profile.position}
                </span>
              )}
            </div>
          </div>

        </div>
      </header>

      {/* Stats row */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-3 text-center"
        >
          <p className="text-2xl font-bold text-primary">{plannings.length}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Sessions</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="rounded-2xl border border-border bg-amber-500/10 p-3 text-center"
        >
          <p className="text-2xl font-bold text-amber-400">{pendingCount}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">En attente</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-border bg-emerald-500/10 p-3 text-center"
        >
          <p className="text-2xl font-bold text-emerald-400">
            {completedSet.size}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Complétés</p>
        </motion.div>
      </div>

      {/* Tab switcher */}
      <div className="mb-5 flex gap-2 rounded-2xl bg-muted p-1">
        {(["pending", "history"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors ${
              activeTab === tab
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab === "pending" ? "En attente" : "Historique"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        {activeTab === "pending" && (
          <motion.div
            key="pending"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-col gap-4"
          >
            {pendingPlannings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucune session en attente
                </p>
              </div>
            ) : (
              pendingPlannings.map((planning) => (
                <PlanningCard
                  key={planning.id}
                  planning={planning}
                  exerciceMap={exerciceMap}
                  completedSet={completedSet}
                  badgeLabel="EN ATTENTE"
                  badgeClass="bg-amber-500/10 text-amber-400"
                />
              ))
            )}
          </motion.div>
        )}

        {activeTab === "history" && (
          <motion.div
            key="history"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-col gap-4"
          >
            {historyPlannings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Aucun historique disponible
                </p>
              </div>
            ) : (
              historyPlannings.map((planning) => (
                <PlanningCard
                  key={planning.id}
                  planning={planning}
                  exerciceMap={exerciceMap}
                  completedSet={completedSet}
                  badgeLabel="TERMINÉ"
                  badgeClass="bg-emerald-500/10 text-emerald-400"
                />
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PlanningCard({
  planning,
  exerciceMap,
  completedSet,
  badgeLabel,
  badgeClass,
}: {
  planning: any;
  exerciceMap: Record<string, any>;
  completedSet: Set<string>;
  badgeLabel: string;
  badgeClass: string;
}) {
  const exerciceIds: string[] = planning.exercice_ids ?? [];

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {/* Card header */}
      <div className="mb-3 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          📅{" "}
          {planning.scheduled_at
            ? format(new Date(planning.scheduled_at), "dd MMM yyyy", {
                locale: fr,
              })
            : "—"}
        </span>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold tracking-wide ${badgeClass}`}
        >
          {badgeLabel}
        </span>
      </div>

      {/* Note */}
      {planning.note && (
        <p className="mb-3 text-sm italic text-muted-foreground">
          {planning.note}
        </p>
      )}

      {/* Divider */}
      <div className="mb-3 h-px bg-border" />

      {/* Exercise rows */}
      <div className="flex flex-col gap-2">
        {exerciceIds.map((id) => {
          const ex = exerciceMap[id];
          const isDone = completedSet.has(`${id}|${planning.id}`);

          if (!ex) return null;

          return (
            <div key={id} className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-base leading-none">
                    {getTestIcon(ex.alignement_test_digital ?? "")}
                  </span>
                  <span className="truncate text-sm font-medium text-foreground">
                    {ex.titre}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1">
                  {ex.bloc && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        BLOC_COLORS[ex.bloc as keyof typeof BLOC_COLORS] ??
                        "bg-muted text-muted-foreground"
                      }`}
                    >
                      {ex.bloc}
                    </span>
                  )}
                  {ex.niveau && (
                    <span
                      className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                        NIVEAU_COLORS[
                          ex.niveau as keyof typeof NIVEAU_COLORS
                        ] ?? "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {ex.niveau}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {ex.series} séries • {ex.duree_serie}
                </p>
              </div>
              <div className="shrink-0">
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-400/60" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
