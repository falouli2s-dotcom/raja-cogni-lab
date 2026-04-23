import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarPlus,
  Clock,
  X,
  CheckCircle2,
  XCircle,
  History,
  Brain,
  Activity,
  Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/coach/sessions")({
  component: CoachSessions,
});

const TEST_LABELS: Record<string, string> = {
  simon_task: "Simon Task",
  n_back: "N-Back 2",
  tmt: "Trail Making Test",
  crt: "Choice Reaction Time",
  anticipation: "Test d'Anticipation",
};

type PlayerInfo = {
  full_name: string | null;
  category: string | null;
  position: string | null;
};
type Player = { id: string; full_name: string | null };

type PlannedSession = {
  id: string;
  player_id: string;
  test_type: string | null;
  session_category: "session" | "exercices" | null;
  exercice_ids: string[] | null;
  scheduled_at: string;
  status: "pending" | "completed" | "cancelled";
  note: string | null;
  player_name?: string | null;
};

type TestSession = {
  id: string;
  user_id: string;
  test_type: string;
  created_at: string;
  score_global: number | null;
  player_name?: string | null;
};

type Exercice = {
  id: string;
  numero: number;
  titre: string;
  niveau: string;
  indicateur_cognitif: string;
};

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function CoachSessions() {
  const [coachId, setCoachId] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [profilesMap, setProfilesMap] = useState<Map<string, PlayerInfo>>(new Map());
  const [planned, setPlanned] = useState<PlannedSession[]>([]);
  const [completedTests, setCompletedTests] = useState<TestSession[]>([]);
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  // form
  const [category, setCategory] = useState<"session" | "exercices">("session");
  const [playerId, setPlayerId] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [note, setNote] = useState("");
  const [selectedExercices, setSelectedExercices] = useState<string[]>([]);
  const [exSearch, setExSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const minDateTime = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }, []);

  async function loadAll(uid: string) {
    setLoading(true);
    const { data: rels } = await (supabase as any)
      .from("coach_players")
      .select("player_id")
      .eq("coach_id", uid)
      .eq("status", "accepted");
    const ids = (rels ?? []).map((r: any) => r.player_id) as string[];

    let nameMap = new Map<string, string | null>();
    let profMap = new Map<string, PlayerInfo>();
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name, category, position")
        .in("id", ids);
      nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      profMap = new Map(
        (profs ?? []).map((p: any) => [
          p.id,
          { full_name: p.full_name, category: p.category, position: p.position } as PlayerInfo,
        ])
      );
      setPlayers(ids.map((id) => ({ id, full_name: nameMap.get(id) ?? null })));
    } else {
      setPlayers([]);
    }
    setProfilesMap(profMap);

    const { data: ps } = await (supabase as any)
      .from("sessions_planifiees")
      .select(
        "id, player_id, test_type, session_category, exercice_ids, scheduled_at, status, note"
      )
      .eq("coach_id", uid)
      .order("scheduled_at", { ascending: true });
    const plannedRows = ((ps ?? []) as PlannedSession[]).map((p) => ({
      ...p,
      player_name: nameMap.get(p.player_id) ?? null,
    }));
    setPlanned(plannedRows);

    if (ids.length > 0) {
      const { data: ts } = await (supabase as any)
        .from("sessions_test")
        .select("id, user_id, test_type, created_at, score_global")
        .in("user_id", ids)
        .order("created_at", { ascending: false })
        .limit(50);
      setCompletedTests(
        ((ts ?? []) as TestSession[]).map((t) => ({
          ...t,
          player_name: nameMap.get(t.user_id) ?? null,
        }))
      );
    } else {
      setCompletedTests([]);
    }
    setLoading(false);
  }

  async function loadExercices() {
    const { data } = await supabase
      .from("exercices")
      .select("id, numero, titre, niveau, indicateur_cognitif")
      .order("numero", { ascending: true });
    setExercices((data ?? []) as Exercice[]);
  }

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setCoachId(user.id);
      await Promise.all([loadAll(user.id), loadExercices()]);
    })();
  }, []);

  const filteredExercices = useMemo(() => {
    const q = exSearch.trim().toLowerCase();
    if (!q) return exercices;
    return exercices.filter(
      (e) =>
        e.titre.toLowerCase().includes(q) ||
        e.indicateur_cognitif.toLowerCase().includes(q)
    );
  }, [exercices, exSearch]);

  function toggleExercice(id: string) {
    setSelectedExercices((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const canSubmit =
    !!playerId &&
    !!scheduledAt &&
    (category === "session" || selectedExercices.length >= 1);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!coachId || !canSubmit) return;
    const when = new Date(scheduledAt);
    if (when.getTime() <= Date.now()) {
      toast.error("La date doit être dans le futur");
      return;
    }
    setSubmitting(true);
    const { error } = await (supabase as any)
      .from("sessions_planifiees")
      .insert({
        coach_id: coachId,
        player_id: playerId,
        session_category: category,
        test_type: null,
        exercice_ids: category === "exercices" ? selectedExercices : null,
        scheduled_at: when.toISOString(),
        note: note.trim() || null,
      });
    setSubmitting(false);
    if (error) {
      toast.error(error.message ?? "Erreur lors de la planification");
      return;
    }
    toast.success("Session planifiée ✓");
    setPlayerId("");
    setScheduledAt("");
    setNote("");
    setSelectedExercices([]);
    setExSearch("");
    setCategory("session");
    await loadAll(coachId);
  }

  async function cancelSession(id: string) {
    const { error } = await (supabase as any)
      .from("sessions_planifiees")
      .update({ status: "cancelled" })
      .eq("id", id);
    if (error) {
      toast.error("Annulation impossible");
      return;
    }
    toast.success("Session annulée");
    if (coachId) await loadAll(coachId);
  }

  const now = Date.now();
  const upcoming = planned.filter(
    (p) => p.status === "pending" && new Date(p.scheduled_at).getTime() > now
  );
  const pastPlanned = planned.filter(
    (p) => p.status === "completed" || p.status === "cancelled"
  );

  type PastItem =
    | { kind: "planned"; data: PlannedSession; date: number }
    | { kind: "test"; data: TestSession; date: number };

  const pastItems: PastItem[] = useMemo(() => {
    const a: PastItem[] = pastPlanned.map((p) => ({
      kind: "planned",
      data: p,
      date: new Date(p.scheduled_at).getTime(),
    }));
    const b: PastItem[] = completedTests.map((t) => ({
      kind: "test",
      data: t,
      date: new Date(t.created_at).getTime(),
    }));
    return [...a, ...b].sort((x, y) => y.date - x.date);
  }, [pastPlanned, completedTests]);

  function displayName(pid: string, fallback?: string | null): string {
    const info = profilesMap.get(pid);
    return (
      info?.full_name ?? fallback ?? info?.category ?? "Joueur sans nom"
    );
  }

  function initialsOf(name: string): string {
    return name
      .trim()
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }

  type GroupedPlayer = {
    player: { id: string; full_name: string; info: PlayerInfo | null };
    items: PastItem[];
  };

  const byPlayer: GroupedPlayer[] = useMemo(() => {
    const map = new Map<string, GroupedPlayer>();
    for (const item of pastItems) {
      const pid =
        item.kind === "planned" ? item.data.player_id : item.data.user_id;
      const name = displayName(
        pid,
        item.kind === "planned"
          ? item.data.player_name
          : item.data.player_name
      );
      if (!map.has(pid)) {
        map.set(pid, {
          player: {
            id: pid,
            full_name: name,
            info: profilesMap.get(pid) ?? null,
          },
          items: [],
        });
      }
      map.get(pid)!.items.push(item);
    }
    return Array.from(map.values());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pastItems, profilesMap]);

  function renderPlannedTitle(s: PlannedSession) {
    if (s.session_category === "exercices") {
      const n = s.exercice_ids?.length ?? 0;
      return {
        title: "🏃 Exercices terrain",
        subtitle: `${n} exercice${n > 1 ? "s" : ""} assigné${n > 1 ? "s" : ""}`,
      };
    }
    if (s.session_category === "session" || s.session_category == null) {
      if (s.test_type) {
        return {
          title: TEST_LABELS[s.test_type] ?? s.test_type,
          subtitle: "Test cognitif",
        };
      }
      return {
        title: "📋 Session cognitive complète",
        subtitle: "Simon Task · N-Back 2 · TMT",
      };
    }
    return { title: "Session", subtitle: "" };
  }

  return (
    <div className="px-5 pt-12 pb-8">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Espace Coach
        </p>
        <h1 className="text-2xl font-bold text-foreground">Sessions</h1>
      </header>

      {/* Section 1 - Plan */}
      <motion.section
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 rounded-2xl border border-border bg-card p-4"
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <CalendarPlus className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              Planifier une session
            </p>
            <p className="text-xs text-muted-foreground">
              Assignez du contenu à l'un de vos joueurs
            </p>
          </div>
        </div>

        {players.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
            Aucun joueur accepté pour l'instant
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            {/* Category toggle */}
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setCategory("session")}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                  category === "session"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Brain className="h-4 w-4" />
                Session cognitive
              </button>
              <button
                type="button"
                onClick={() => setCategory("exercices")}
                className={`flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all ${
                  category === "exercices"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Activity className="h-4 w-4" />
                Exercices terrain
              </button>
            </div>

            {/* Conditional content */}
            {category === "session" ? (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">
                    Session cognitive complète
                  </p>
                </div>
                <p className="mb-3 text-xs text-muted-foreground">
                  Cette session inclut automatiquement les 3 tests suivants :
                </p>
                <ul className="space-y-1.5 text-xs text-foreground/90">
                  <li className="flex justify-between">
                    <span>① Simon Task</span>
                    <span className="text-muted-foreground">~8 min</span>
                  </li>
                  <li className="flex justify-between">
                    <span>② N-Back 2</span>
                    <span className="text-muted-foreground">~6 min</span>
                  </li>
                  <li className="flex justify-between">
                    <span>③ Trail Making Test</span>
                    <span className="text-muted-foreground">~6 min</span>
                  </li>
                </ul>
                <div className="mt-3 border-t border-primary/20 pt-2 text-xs font-semibold text-foreground">
                  ⏱ Durée totale estimée : ~20 min
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-background/40 p-3">
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={exSearch}
                    onChange={(e) => setExSearch(e.target.value)}
                    placeholder="Rechercher un exercice..."
                    className="h-9 pl-9 text-xs"
                  />
                </div>
                <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                  {filteredExercices.length === 0 ? (
                    <p className="py-6 text-center text-xs text-muted-foreground">
                      Aucun exercice trouvé
                    </p>
                  ) : (
                    filteredExercices.map((ex) => {
                      const checked = selectedExercices.includes(ex.id);
                      return (
                        <button
                          type="button"
                          key={ex.id}
                          onClick={() => toggleExercice(ex.id)}
                          className={`flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all ${
                            checked
                              ? "border-primary bg-primary/10"
                              : "border-border bg-card hover:border-border/80"
                          }`}
                        >
                          <span
                            className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                              checked
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-border bg-background"
                            }`}
                          >
                            {checked && (
                              <CheckCircle2 className="h-3 w-3" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-semibold text-foreground">
                              #{String(ex.numero).padStart(2, "0")} ·{" "}
                              {ex.titre}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                                {ex.niveau}
                              </span>
                              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                {ex.indicateur_cognitif}
                              </span>
                            </div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
                <p className="mt-2 border-t border-border pt-2 text-center text-[11px] font-semibold text-muted-foreground">
                  {selectedExercices.length} exercice
                  {selectedExercices.length > 1 ? "s" : ""} sélectionné
                  {selectedExercices.length > 1 ? "s" : ""}
                </p>
              </div>
            )}

            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un joueur" />
              </SelectTrigger>
              <SelectContent>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ??
                      profilesMap.get(p.id)?.category ??
                      "Joueur sans nom"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="datetime-local"
              value={scheduledAt}
              min={minDateTime}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />

            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optionnel)"
              rows={2}
            />

            <Button type="submit" disabled={submitting || !canSubmit}>
              {submitting ? "Planification..." : "Planifier"}
            </Button>
          </form>
        )}
      </motion.section>

      {/* Section 2 - Upcoming */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Sessions à venir
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {upcoming.length}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center text-sm text-muted-foreground">
            Aucune session à venir
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence>
              {upcoming.map((s) => {
                const meta = renderPlannedTitle(s);
                return (
                  <motion.div
                    key={s.id}
                    layout
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="rounded-2xl border border-border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {s.player_name ?? "Joueur"}
                        </p>
                        <p className="text-xs font-medium text-foreground/90">
                          {meta.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {meta.subtitle}
                        </p>
                        <p className="mt-1 text-xs text-foreground/80">
                          📅 {fmtDate(s.scheduled_at)}
                        </p>
                        {s.note && (
                          <p className="mt-1 text-xs italic text-muted-foreground">
                            « {s.note} »
                          </p>
                        )}
                      </div>
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-400">
                        <Clock className="h-3 w-3" /> À venir
                      </span>
                    </div>
                    <div className="mt-3 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelSession(s.id)}
                        className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                      >
                        <X className="mr-1 h-3.5 w-3.5" /> Annuler
                      </Button>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Section 3 - Past */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">
            Sessions passées
          </h2>
        </div>

        {loading ? null : pastItems.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-5 text-center text-sm text-muted-foreground">
            Aucune session passée
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {pastItems.map((it) => {
              if (it.kind === "planned") {
                const s = it.data;
                const isCompleted = s.status === "completed";
                const meta = renderPlannedTitle(s);
                return (
                  <div
                    key={`p-${s.id}`}
                    className="rounded-2xl border border-border bg-card p-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {s.player_name ?? "Joueur"}
                        </p>
                        <p className="text-xs font-medium text-foreground/90">
                          {meta.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {meta.subtitle}
                        </p>
                        <p className="mt-1 text-xs text-foreground/80">
                          📅 {fmtDate(s.scheduled_at)}
                        </p>
                      </div>
                      {isCompleted ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> Complétée
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rose-500/10 px-2 py-1 text-[10px] font-semibold text-rose-400">
                          <XCircle className="h-3 w-3" /> Annulée
                        </span>
                      )}
                    </div>
                  </div>
                );
              }
              const t = it.data;
              return (
                <div
                  key={`t-${t.id}`}
                  className="rounded-2xl border border-border bg-card p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {t.player_name ?? "Joueur"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {TEST_LABELS[t.test_type] ?? t.test_type}
                      </p>
                      <p className="mt-1 text-xs text-foreground/80">
                        📅 {fmtDate(t.created_at)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                        Test passé
                      </span>
                      {t.score_global !== null && (
                        <span className="text-xs font-bold text-foreground tabular-nums">
                          {Math.round(Number(t.score_global))}/100
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
