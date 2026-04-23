import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarPlus, Clock, X, CheckCircle2, XCircle, History } from "lucide-react";
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
const TEST_TYPES = Object.keys(TEST_LABELS);

type Player = { id: string; full_name: string | null };

type PlannedSession = {
  id: string;
  player_id: string;
  test_type: string;
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
  const [planned, setPlanned] = useState<PlannedSession[]>([]);
  const [completedTests, setCompletedTests] = useState<TestSession[]>([]);
  const [loading, setLoading] = useState(true);

  // form
  const [playerId, setPlayerId] = useState("");
  const [testType, setTestType] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const minDateTime = useMemo(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }, []);

  async function loadAll(uid: string) {
    setLoading(true);
    // Accepted players
    const { data: rels } = await (supabase as any)
      .from("coach_players")
      .select("player_id")
      .eq("coach_id", uid)
      .eq("status", "accepted");
    const ids = (rels ?? []).map((r: any) => r.player_id) as string[];

    let nameMap = new Map<string, string | null>();
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      setPlayers(ids.map((id) => ({ id, full_name: nameMap.get(id) ?? null })));
    } else {
      setPlayers([]);
    }

    // Planned sessions
    const { data: ps } = await (supabase as any)
      .from("sessions_planifiees")
      .select("id, player_id, test_type, scheduled_at, status, note")
      .eq("coach_id", uid)
      .order("scheduled_at", { ascending: true });
    const plannedRows = ((ps ?? []) as PlannedSession[]).map((p) => ({
      ...p,
      player_name: nameMap.get(p.player_id) ?? null,
    }));
    setPlanned(plannedRows);

    // Test sessions of accepted players
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

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCoachId(user.id);
      await loadAll(user.id);
    })();
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!coachId || !playerId || !testType || !scheduledAt) return;
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
        test_type: testType,
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
    setTestType("");
    setScheduledAt("");
    setNote("");
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
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <CalendarPlus className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Planifier une session</p>
            <p className="text-xs text-muted-foreground">
              Assignez un test à l'un de vos joueurs
            </p>
          </div>
        </div>

        {players.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border bg-card/50 p-4 text-center text-xs text-muted-foreground">
            Aucun joueur accepté pour l'instant
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <Select value={playerId} onValueChange={setPlayerId}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un joueur" />
              </SelectTrigger>
              <SelectContent>
                {players.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name ?? "Joueur"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={testType} onValueChange={setTestType}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner un test" />
              </SelectTrigger>
              <SelectContent>
                {TEST_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {TEST_LABELS[t]}
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

            <Button
              type="submit"
              disabled={submitting || !playerId || !testType || !scheduledAt}
            >
              {submitting ? "Planification..." : "Planifier"}
            </Button>
          </form>
        )}
      </motion.section>

      {/* Section 2 - Upcoming */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Sessions à venir</h2>
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
              {upcoming.map((s) => (
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
                      <p className="text-xs text-muted-foreground">
                        {TEST_LABELS[s.test_type] ?? s.test_type}
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
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Section 3 - Past */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Sessions passées</h2>
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
                        <p className="text-xs text-muted-foreground">
                          {TEST_LABELS[s.test_type] ?? s.test_type}
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
