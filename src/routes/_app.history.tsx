import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Brain,
  Zap,
  GitBranch,
  Eye,
  Crosshair,
  BarChart3,
  Sparkles,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Dot,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { computeSGS, getGlobalStatus, type SGSResult, type TestScores } from "@/lib/sgs-engine";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/history")({
  component: HistoryPage,
});

// ───────── Dimension metadata ─────────
const DIMENSIONS = [
  { key: "reactionTime", label: "Temps de Réaction", icon: Clock },
  { key: "inhibition", label: "Contrôle Inhibiteur", icon: Zap },
  { key: "workingMemory", label: "Mémoire de Travail", icon: Brain },
  { key: "flexibility", label: "Flexibilité Cognitive", icon: GitBranch },
  { key: "attention", label: "Attention Sélective", icon: Eye },
  { key: "anticipation", label: "Anticipation Perceptuelle", icon: Crosshair },
] as const;

// ───────── Types ─────────
interface DbSession {
  id: string;
  created_at: string;
  test_type: string;
  donnees_brutes: any;
}

interface DbResult {
  id: string;
  session_id: string;
  test_type: string;
  metrique: string;
  valeur: number | null;
  details: any;
}

interface SessionGroup {
  groupId: string; // sessionId from donnees_brutes
  date: string;
  testTypes: string[];
  scores: TestScores;
  sgs: SGSResult;
}

// ───────── Aggregation ─────────
function groupSessions(sessions: DbSession[], results: DbResult[]): SessionGroup[] {
  // Group by donnees_brutes.sessionId so the 3 tests of one battery share an entry
  const groups = new Map<string, { sessions: DbSession[]; results: DbResult[]; date: string }>();

  for (const s of sessions) {
    const key = s.donnees_brutes?.sessionId ?? s.id;
    const existing = groups.get(key);
    if (existing) {
      existing.sessions.push(s);
      // Keep the most recent date
      if (new Date(s.created_at) > new Date(existing.date)) existing.date = s.created_at;
    } else {
      groups.set(key, { sessions: [s], results: [], date: s.created_at });
    }
  }

  for (const r of results) {
    for (const [, group] of groups) {
      if (group.sessions.some((s) => s.id === r.session_id)) {
        group.results.push(r);
        break;
      }
    }
  }

  const out: SessionGroup[] = [];
  for (const [groupId, group] of groups) {
    const scores: TestScores = {};

    for (const r of group.results) {
      if (r.test_type === "simon" && r.details) {
        scores.simon = {
          avgRT: Number(r.details.avg_rt ?? 0),
          simonEffect: Number(r.valeur ?? 0),
          accuracy: Number(r.details.accuracy ?? 0),
        };
      } else if (r.test_type === "nback" && r.details) {
        scores.nback = {
          accuracy: Number(r.details.accuracy ?? 0),
          targetErrorRate: Number(r.valeur ?? 0),
          dPrime: Number(r.details.d_prime ?? 0),
        };
      } else if (r.test_type === "tmt" && r.details) {
        scores.tmt = {
          ratioBA: Number(r.valeur ?? 0),
          timeA: Number(r.details.time_a ?? 0),
          timeB: Number(r.details.time_b ?? 0),
        };
      }
    }

    out.push({
      groupId,
      date: group.date,
      testTypes: [...new Set(group.sessions.map((s) => s.test_type))],
      scores,
      sgs: computeSGS(scores),
    });
  }

  // Most recent first
  return out.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// ───────── Page ─────────
function HistoryPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<SessionGroup[]>([]);
  const [selected, setSelected] = useState<SessionGroup | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setError("Vous devez être connecté pour voir votre historique.");
            setLoading(false);
          }
          return;
        }

        const { data: sessions, error: sErr } = await supabase
          .from("sessions_test")
          .select("id, created_at, test_type, donnees_brutes")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (sErr) throw sErr;

        const sessionIds = (sessions ?? []).map((s) => s.id);
        let results: DbResult[] = [];
        if (sessionIds.length > 0) {
          const { data: r, error: rErr } = await supabase
            .from("resultats_test")
            .select("id, session_id, test_type, metrique, valeur, details")
            .in("session_id", sessionIds);
          if (rErr) throw rErr;
          results = (r ?? []) as DbResult[];
        }

        if (!cancelled) {
          setGroups(groupSessions((sessions ?? []) as DbSession[], results));
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? "Erreur lors du chargement de l'historique.");
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Loading
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5 pt-12 pb-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  // Error
  if (error) {
    return (
      <div className="px-5 pt-12 pb-24">
        <h1 className="text-2xl font-bold text-foreground">Historique</h1>
        <div className="mt-6 rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    );
  }

  // Empty
  if (groups.length === 0) {
    return (
      <div className="px-5 pt-12 pb-24">
        <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <h1 className="text-2xl font-bold text-foreground">Historique</h1>
          <p className="mt-1 text-sm text-muted-foreground">Suis ton évolution cognitive</p>
        </motion.div>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mt-12 flex flex-col items-center gap-5 rounded-2xl border border-border bg-card p-8 text-center"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-primary/10">
            <Sparkles className="h-10 w-10 text-primary" />
          </div>
          <p className="font-semibold text-foreground">
            Aucune session pour le moment.<br />Lance ta première batterie de tests !
          </p>
          <Button
            onClick={() => navigate({ to: "/tests/session" })}
            className="mt-2 h-12 px-8 text-sm font-semibold"
          >
            Commencer une session
          </Button>
        </motion.div>
      </div>
    );
  }

  // Section 1 — chart data: oldest → newest, last 10
  const chartData = [...groups]
    .slice(0, 10)
    .reverse()
    .map((g) => ({
      date: format(new Date(g.date), "dd/MM"),
      score: g.sgs.global,
      groupId: g.groupId,
    }));

  // Section 2 — best/last per dimension
  const dimStats = DIMENSIONS.map((dim) => {
    const scores = groups.map((g) => g.sgs.dimensions.find((d) => d.key === dim.key)?.score ?? 0);
    const best = scores.length ? Math.max(...scores) : 0;
    const last = scores[0] ?? 0; // groups[0] is most recent
    const prev = scores[1] ?? last;
    let trend: "up" | "down" | "stable" = "stable";
    const delta = last - prev;
    if (delta > 3) trend = "up";
    else if (delta < -3) trend = "down";
    return { ...dim, best, last, trend };
  });

  return (
    <div className="px-5 pt-12 pb-24">
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground">Historique</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {groups.length} session{groups.length !== 1 ? "s" : ""} enregistrée{groups.length !== 1 ? "s" : ""}
        </p>
      </motion.div>

      {/* Section 1 — Evolution */}
      <motion.section
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-6 rounded-2xl border border-border bg-card p-4"
      >
        <h2 className="mb-3 text-sm font-semibold text-foreground">Évolution du SGS</h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                axisLine={{ stroke: "hsl(var(--border))" }}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "0.75rem",
                  fontSize: "12px",
                }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={(props: any) => {
                  const { cx, cy, payload } = props;
                  const v = payload.score as number;
                  const color =
                    v > 70 ? "oklch(0.637 0.177 152.535)"
                    : v >= 40 ? "oklch(0.7 0.18 75)"
                    : "oklch(0.577 0.245 27.325)";
                  return <Dot cx={cx} cy={cy} r={5} fill={color} stroke="hsl(var(--card))" strokeWidth={2} />;
                }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      {/* Section 2 — Best per dimension */}
      <motion.section
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6"
      >
        <h2 className="mb-3 text-sm font-semibold text-foreground">Meilleurs scores par dimension</h2>
        <div className="grid grid-cols-2 gap-3">
          {dimStats.map((d) => {
            const TrendIcon = d.trend === "up" ? TrendingUp : d.trend === "down" ? TrendingDown : Minus;
            const trendColor =
              d.trend === "up" ? "text-primary"
              : d.trend === "down" ? "text-destructive"
              : "text-muted-foreground";
            return (
              <div key={d.key} className="rounded-2xl border border-border bg-card p-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <d.icon className="h-4 w-4 text-primary" />
                  </div>
                  <p className="flex-1 text-xs font-semibold leading-tight text-foreground">{d.label}</p>
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-foreground">{d.best}</span>
                  <span className="text-xs text-muted-foreground">/100</span>
                </div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Meilleur score</p>
                <div className={`mt-2 flex items-center gap-1 text-xs ${trendColor}`}>
                  <TrendIcon className="h-3.5 w-3.5" />
                  <span className="font-medium">{d.last}</span>
                  <span className="text-muted-foreground">dernière session</span>
                </div>
              </div>
            );
          })}
        </div>
      </motion.section>

      {/* Section 3 — Sessions list */}
      <motion.section
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6"
      >
        <h2 className="mb-3 text-sm font-semibold text-foreground">10 dernières sessions</h2>
        <div className="flex flex-col gap-2">
          {groups.slice(0, 10).map((g) => {
            const status = getGlobalStatus(g.sgs.global);
            return (
              <button
                key={g.groupId}
                onClick={() => setSelected(g)}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors active:bg-muted"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted">
                  <BarChart3 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {format(new Date(g.date), "dd/MM/yyyy 'à' HH:mm")}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground truncate">
                    {g.testTypes.length > 0 ? g.testTypes.join(" • ") : "Aucun test"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-bold ${status.color} bg-primary/10`}
                >
                  {g.sgs.global}/100
                </span>
              </button>
            );
          })}
        </div>
      </motion.section>

      {/* Detail bottom sheet */}
      <Sheet open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
          {selected && (
            <>
              <SheetHeader>
                <SheetTitle>
                  Session du {format(new Date(selected.date), "dd/MM/yyyy 'à' HH:mm")}
                </SheetTitle>
              </SheetHeader>
              <div className="mt-4 rounded-2xl bg-primary/10 p-4 text-center">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">SGS Global</p>
                <p className="mt-1 text-3xl font-bold text-foreground">
                  {selected.sgs.global}<span className="text-base text-muted-foreground">/100</span>
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-2 pb-4">
                {selected.sgs.dimensions.map((dim) => {
                  const meta = DIMENSIONS.find((d) => d.key === dim.key);
                  const Icon = meta?.icon ?? Brain;
                  return (
                    <div key={dim.key} className="flex items-center gap-3 rounded-xl border border-border p-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-foreground">{dim.label}</p>
                          <p className="text-sm font-bold text-foreground">{dim.score}/100</p>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary"
                            style={{ width: `${dim.score}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
