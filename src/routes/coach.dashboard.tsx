import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  ClipboardList,
  CheckCircle2,
  Brain,
  AlertTriangle,
  ChevronRight,
  CalendarDays,
  Activity,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { groupTestSessions } from "@/lib/group-test-sessions";

export const Route = createFileRoute("/coach/dashboard")({
  component: CoachDashboard,
});

// ─── Constants ────────────────────────────────────────────────────────────────
const WEEKS_TO_DISPLAY = 8;

// ─── Animation variants ───────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

// ─── Types ────────────────────────────────────────────────────────────────────
type Stats = {
  totalJoueurs: number;
  sessionsThisMois: number;
  completedSessions: number;
  avgSGS: number | null;
};

type PlayerAlert = {
  id: string;
  full_name: string | null;
  avgSGS: number;
  weakestDimension: string;
};

type WeeklyData = {
  week: string;
  avgSGS: number;
  sessions: number;
};

type UpcomingSession = {
  id: string;
  player_id: string;
  session_category: string | null;
  scheduled_at: string;
  player_name: string | null;
};

type RecentActivity = {
  id: string;
  user_id: string;
  test_type: string;
  created_at: string;
  score_global: number | null;
  player_name: string | null;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
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

function sgsBadgeClass(score: number) {
  if (score >= 70) return "bg-emerald-500/15 text-emerald-400";
  if (score >= 40) return "bg-amber-500/15 text-amber-400";
  return "bg-rose-500/15 text-rose-400";
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return "il y a moins d'1 h";
  if (h < 24) return `il y a ${h} h`;
  const d = Math.floor(h / 24);
  return `il y a ${d} j`;
}

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

const TEST_LABELS: Record<string, string> = {
  simon_task: "Simon Task",
  n_back: "N-Back 2",
  tmt: "Trail Making Test",
  crt: "Choice Reaction Time",
  anticipation: "Test d'Anticipation",
};

const DIMENSION_LABELS: Record<string, string> = {
  flexibility: "Flexibilité cognitive",
  attention: "Attention sélective",
  workingMemory: "Mémoire de travail",
  inhibition: "Inhibition",
  reactionTime: "Temps de réaction",
  anticipation: "Anticipation",
};

// ─── Main component ───────────────────────────────────────────────────────────
function CoachDashboard() {
  const navigate = useNavigate();
  const [coachId, setCoachId] = useState<string | null>(null);
  const [firstName, setFirstName] = useState<string>("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [alerts, setAlerts] = useState<PlayerAlert[]>([]);
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [upcoming, setUpcoming] = useState<UpcomingSession[]>([]);
  const [recent, setRecent] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      setCoachId(user.id);
      await loadDashboard(user.id);
    })();
  }, [navigate]);

  async function loadDashboard(uid: string) {
    setLoading(true);
    try {
      // ── Accepted players ──────────────────────────────────────────────────
      const { data: relData, error: relErr } = await (supabase as any)
        .from("coach_players")
        .select("player_id")
        .eq("coach_id", uid)
        .eq("status", "accepted");
      if (relErr) throw relErr;
      const playerIds: string[] = (relData ?? []).map((r: any) => r.player_id);

      // ── Coach profile (first name) ────────────────────────────────────────
      const { data: profileData } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", uid)
        .maybeSingle();
      const fullName = (profileData as any)?.full_name ?? "";
      setFirstName(fullName.trim().split(/\s+/)[0] ?? "");

      // ── Sessions this month ───────────────────────────────────────────────
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { count: sessionsMois } = await (supabase as any)
        .from("sessions_planifiees")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", uid)
        .gte("created_at", startOfMonth.toISOString());

      const { count: sessionsCompleted } = await (supabase as any)
        .from("sessions_planifiees")
        .select("id", { count: "exact", head: true })
        .eq("coach_id", uid)
        .eq("status", "completed");

      // ── sessions_test for all players ────────────────────────────────────
      let allTests: any[] = [];
      if (playerIds.length > 0) {
        const { data: testsData, error: testsErr } = await (supabase as any)
          .from("sessions_test")
          .select("id, user_id, test_type, created_at, score_global, donnees_brutes")
          .in("user_id", playerIds)
          .order("created_at", { ascending: false })
          .limit(500);
        if (testsErr) throw testsErr;
        allTests = testsData ?? [];
      }

      // ── Player profiles map ───────────────────────────────────────────────
      let profilesMap = new Map<string, { full_name: string | null }>();
      if (playerIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", playerIds);
        profilesMap = new Map(
          (profs ?? []).map((p: any) => [p.id, { full_name: p.full_name }])
        );
      }

      // ── Avg SGS across all team ───────────────────────────────────────────
      const grouped = groupTestSessions(allTests);
      const allScores = grouped
        .map((s) => s.avgScore)
        .filter((v): v is number => v != null);
      const avgSGS =
        allScores.length > 0
          ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
          : null;

      setStats({
        totalJoueurs: playerIds.length,
        sessionsThisMois: sessionsMois ?? 0,
        completedSessions: sessionsCompleted ?? 0,
        avgSGS,
      });

      // ── Alerts: players with recent avg SGS < 50 ──────────────────────────
      const alertList: PlayerAlert[] = [];
      for (const pid of playerIds) {
        const playerSessions = grouped
          .filter((s) => s.user_id === pid)
          .slice(0, 3);
        const recentScores = playerSessions
          .map((s) => s.avgScore)
          .filter((v): v is number => v != null);
        if (recentScores.length === 0) continue;
        const recentAvg = Math.round(
          recentScores.reduce((a, b) => a + b, 0) / recentScores.length
        );
        if (recentAvg < 50) {
          // Find weakest dimension from donnees_brutes of last session
          const lastRows = playerSessions[0]?.rows ?? [];
          const dimScores: Record<string, number[]> = {};
          for (const row of lastRows) {
            const brutes = row.donnees_brutes as Record<string, unknown> | null;
            if (!brutes) continue;
            const dims = brutes.dimensions as Record<string, number> | undefined;
            if (!dims) continue;
            for (const [k, v] of Object.entries(dims)) {
              if (typeof v === "number") {
                if (!dimScores[k]) dimScores[k] = [];
                dimScores[k].push(v);
              }
            }
          }
          let weakest = "Non déterminé";
          let weakestScore = Infinity;
          for (const [k, vals] of Object.entries(dimScores)) {
            const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
            if (avg < weakestScore) {
              weakestScore = avg;
              weakest = DIMENSION_LABELS[k] ?? k;
            }
          }
          alertList.push({
            id: pid,
            full_name: profilesMap.get(pid)?.full_name ?? null,
            avgSGS: recentAvg,
            weakestDimension: weakest,
          });
        }
      }
      setAlerts(alertList);

      // ── Weekly progression (last 8 weeks) ────────────────────────────────
      const now = new Date();
      const weeks: WeeklyData[] = [];
      for (let i = WEEKS_TO_DISPLAY - 1; i >= 0; i--) {
        const weekStart = startOfWeek(
          new Date(now.getTime() - i * 7 * 24 * 3600 * 1000)
        );
        const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3600 * 1000);
        const weekSessions = grouped.filter((s) => {
          const t = new Date(s.startedAt).getTime();
          return t >= weekStart.getTime() && t < weekEnd.getTime();
        });
        const scores = weekSessions
          .map((s) => s.avgScore)
          .filter((v): v is number => v != null);
        const avg =
          scores.length > 0
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : 0;
        weeks.push({
          week: `S${WEEKS_TO_DISPLAY - i}`,
          avgSGS: avg,
          sessions: weekSessions.length,
        });
      }
      setWeeklyData(weeks);

      // ── Upcoming sessions ─────────────────────────────────────────────────
      const { data: upcomingData } = await (supabase as any)
        .from("sessions_planifiees")
        .select("id, player_id, session_category, scheduled_at")
        .eq("coach_id", uid)
        .eq("status", "pending")
        .gte("scheduled_at", new Date().toISOString())
        .order("scheduled_at", { ascending: true })
        .limit(3);
      const upcomingRows: UpcomingSession[] = (upcomingData ?? []).map(
        (s: any) => ({
          ...s,
          player_name: profilesMap.get(s.player_id)?.full_name ?? null,
        })
      );
      setUpcoming(upcomingRows);

      // ── Recent activity ───────────────────────────────────────────────────
      if (playerIds.length > 0) {
        const { data: recentData } = await (supabase as any)
          .from("sessions_test")
          .select("id, user_id, test_type, created_at, score_global")
          .in("user_id", playerIds)
          .order("created_at", { ascending: false })
          .limit(5);
        const recentRows: RecentActivity[] = (recentData ?? []).map((r: any) => ({
          ...r,
          player_name: profilesMap.get(r.user_id)?.full_name ?? null,
        }));
        setRecent(recentRows);
      }
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur lors du chargement");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const completionRate =
    stats && stats.sessionsThisMois > 0
      ? Math.round((stats.completedSessions / stats.sessionsThisMois) * 100)
      : 0;

  return (
    <motion.div
      className="px-4 pt-10 pb-4"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <motion.header variants={itemVariants} className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          Bonjour, {firstName || "Coach"} 👋
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground capitalize">
          Raja Casablanca · {today}
        </p>
      </motion.header>

      {/* ── Section 1 — Stats globales (2×2 grid) ─────────────────────────── */}
      <motion.section variants={itemVariants} className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Statistiques équipe
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {/* Joueurs actifs */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats?.totalJoueurs ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Joueurs actifs</p>
          </div>

          {/* Sessions ce mois */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10">
              <ClipboardList className="h-4 w-4 text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-foreground">
              {stats?.sessionsThisMois ?? 0}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">Sessions ce mois</p>
          </div>

          {/* Taux complétion */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </div>
            <p className="text-2xl font-bold text-foreground">{completionRate}%</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Taux complétion</p>
          </div>

          {/* SGS moyen équipe */}
          <div className="rounded-2xl border border-border bg-card p-4">
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-violet-500/10">
              <Brain className="h-4 w-4 text-violet-400" />
            </div>
            {stats?.avgSGS != null ? (
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-lg font-bold ${sgsBadgeClass(stats.avgSGS)}`}
              >
                {stats.avgSGS}
              </span>
            ) : (
              <p className="text-2xl font-bold text-muted-foreground">—</p>
            )}
            <p className="mt-0.5 text-xs text-muted-foreground">SGS moyen équipe</p>
          </div>
        </div>
      </motion.section>

      {/* ── Section 2 — Alertes joueurs ───────────────────────────────────── */}
      <motion.section variants={itemVariants} className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Alertes joueurs
        </h2>

        {alerts.length === 0 ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 text-center">
            <p className="text-sm text-emerald-400">
              ✅ Tous les joueurs sont dans la normale
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {alerts.map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 rounded-2xl border border-rose-500/20 bg-card p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-500/10 text-xs font-bold text-rose-400">
                  {initials(a.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {a.full_name ?? "Joueur"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {a.weakestDimension}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-bold text-rose-400">
                    SGS {a.avgSGS}
                  </span>
                  <button
                    onClick={() => navigate({ to: "/coach/exercices" })}
                    className="flex items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
                  >
                    Voir recommandations <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* ── Section 3 — Progression collective ────────────────────────────── */}
      <motion.section variants={itemVariants} className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Progression collective (8 semaines)
        </h2>
        <div className="rounded-2xl border border-border bg-card p-4">
          {weeklyData.every((w) => w.avgSGS === 0) ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Pas encore de données suffisantes
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart
                data={weeklyData}
                margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="sgsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="week"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: 12,
                    color: "hsl(var(--foreground))",
                  }}
                  formatter={(value: number, _: string, props: any) => [
                    `SGS moyen : ${value} · ${props.payload.sessions} session(s)`,
                    "",
                  ]}
                  labelFormatter={(label) => label}
                />
                <Area
                  type="monotone"
                  dataKey="avgSGS"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fill="url(#sgsGradient)"
                  dot={{ r: 4, fill: "hsl(var(--primary))", strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </motion.section>

      {/* ── Section 4 — Sessions à venir ──────────────────────────────────── */}
      <motion.section variants={itemVariants} className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Sessions à venir</h2>
          <button
            onClick={() => navigate({ to: "/coach/sessions" })}
            className="flex items-center gap-0.5 text-xs font-medium text-primary hover:underline"
          >
            Voir toutes <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>

        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-center">
            <CalendarDays className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune session planifiée</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {upcoming.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {initials(s.player_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {s.player_name ?? "Joueur"}
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {s.session_category ?? "Session"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium text-foreground">
                    {new Date(s.scheduled_at).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {new Date(s.scheduled_at).toLocaleTimeString("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* ── Section 5 — Activité récente ──────────────────────────────────── */}
      <motion.section variants={itemVariants} className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-foreground">
          Activité récente
        </h2>

        {recent.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4 text-center">
            <Activity className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Aucune activité récente</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {recent.map((r) => (
              <div
                key={r.id}
                className="flex items-start gap-3 rounded-2xl border border-border bg-card p-3"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold text-muted-foreground">
                  {initials(r.player_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">
                      {r.player_name ?? "Joueur"}
                    </span>{" "}
                    a complété{" "}
                    <span className="font-medium">
                      {TEST_LABELS[r.test_type] ?? r.test_type}
                    </span>
                    {r.score_global != null && (
                      <>
                        {" "}
                        · SGS :{" "}
                        <span
                          className={`font-bold ${
                            r.score_global >= 70
                              ? "text-emerald-400"
                              : r.score_global >= 40
                                ? "text-amber-400"
                                : "text-rose-400"
                          }`}
                        >
                          {r.score_global}
                        </span>
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {timeAgo(r.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}
