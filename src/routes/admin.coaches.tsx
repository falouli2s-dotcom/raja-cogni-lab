import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Loader2, LogOut, Shield, Check, X, Mail, User as UserIcon, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/coaches")({
  component: AdminCoachesPage,
});

type CoachRequest = {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  status: "pending" | "approved" | "rejected";
  reviewed_at: string | null;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  role: string;
};

type CoachPlayerRow = {
  coach_id: string;
  player_id: string;
  status: string;
};

type PersonCard = {
  id: string;
  full_name: string;
  email: string;
};

type CoachWithPlayers = PersonCard & {
  players: PersonCard[];
};

type PlayerWithCoach = PersonCard & {
  coach: PersonCard | null;
};

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function AdminCoachesPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [requests, setRequests] = useState<CoachRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const [coachesLoading, setCoachesLoading] = useState(true);
  const [coaches, setCoaches] = useState<CoachWithPlayers[]>([]);
  const [players, setPlayers] = useState<PlayerWithCoach[]>([]);
  const [expandedCoachId, setExpandedCoachId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("coach_requests")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("Erreur de chargement, veuillez réessayer");
    } else {
      setRequests((data ?? []) as CoachRequest[]);
    }
    setLoading(false);
  }, []);

  const loadCoachesAndPlayers = useCallback(async () => {
    setCoachesLoading(true);
    try {
      const [profilesRes, relationsRes, emailsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role").in("role", ["coach", "joueur"]),
        supabase.from("coach_players").select("coach_id, player_id, status"),
        (supabase as any).rpc("admin_list_user_emails"),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (relationsRes.error) throw relationsRes.error;
      if (emailsRes.error) throw emailsRes.error;

      const profiles = (profilesRes.data ?? []) as ProfileRow[];
      const relations = (relationsRes.data ?? []) as CoachPlayerRow[];
      const emailMap = new Map<string, string>(
        ((emailsRes.data ?? []) as { id: string; email: string }[]).map((u) => [u.id, u.email])
      );

      const toCard = (p: ProfileRow): PersonCard => ({
        id: p.id,
        full_name: p.full_name ?? "—",
        email: emailMap.get(p.id) ?? "—",
      });

      const coachProfiles = profiles.filter((p) => p.role === "coach");
      const playerProfiles = profiles.filter((p) => p.role === "joueur");

      // Only "accepted" relations represent actual assignments
      const accepted = relations.filter((r) => r.status === "accepted");

      const playersByCoach = new Map<string, PersonCard[]>();
      const coachByPlayer = new Map<string, string>();
      for (const r of accepted) {
        coachByPlayer.set(r.player_id, r.coach_id);
        const list = playersByCoach.get(r.coach_id) ?? [];
        const player = playerProfiles.find((p) => p.id === r.player_id);
        if (player) list.push(toCard(player));
        playersByCoach.set(r.coach_id, list);
      }

      const coachesWithPlayers: CoachWithPlayers[] = coachProfiles
        .map((c) => ({
          ...toCard(c),
          players: playersByCoach.get(c.id) ?? [],
        }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name));

      const coachCardById = new Map(coachesWithPlayers.map((c) => [c.id, { id: c.id, full_name: c.full_name, email: c.email }]));

      const playersWithCoach: PlayerWithCoach[] = playerProfiles
        .map((p) => {
          const coachId = coachByPlayer.get(p.id);
          return {
            ...toCard(p),
            coach: coachId ? coachCardById.get(coachId) ?? null : null,
          };
        })
        .sort((a, b) => a.full_name.localeCompare(b.full_name));

      setCoaches(coachesWithPlayers);
      setPlayers(playersWithCoach);
    } catch (err) {
      console.error(err);
      toast.error("Erreur de chargement, veuillez réessayer");
    } finally {
      setCoachesLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if ((profile as { role?: string } | null)?.role !== "admin") {
        navigate({ to: "/home", replace: true });
        return;
      }
      setReady(true);
      await Promise.all([loadRequests(), loadCoachesAndPlayers()]);
    })();
  }, [navigate, loadRequests, loadCoachesAndPlayers]);

  async function handleDecision(req: CoachRequest, approve: boolean) {
    setActingId(req.id);
    const newRole = approve ? "coach" : "joueur";
    const { error: profileErr } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("id", req.user_id);

    if (profileErr) {
      console.error(profileErr);
      toast.error("Erreur lors de la mise à jour du profil");
      setActingId(null);
      return;
    }

    const { error: reqErr } = await supabase
      .from("coach_requests")
      .update({
        status: approve ? "approved" : "rejected",
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", req.id);

    if (reqErr) {
      console.error(reqErr);
      toast.error("Erreur lors du traitement de la demande");
    } else {
      toast.success(approve ? "Coach approuvé" : "Demande refusée");
      await Promise.all([loadRequests(), loadCoachesAndPlayers()]);
    }
    setActingId(null);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "pending");
  const history = requests.filter((r) => r.status !== "pending");

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">Administration</h1>
            <p className="text-xs text-muted-foreground">Demandes Coach</p>
          </div>
        </div>
        <Button onClick={handleLogout} variant="ghost" size="sm">
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-6 py-6">
        {/* Pending */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            En attente ({pending.length})
          </h2>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : pending.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Aucune demande en attente
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {pending.map((req) => (
                <div
                  key={req.id}
                  className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                      <UserIcon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">
                        {req.full_name}
                      </p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                        <Mail className="h-3 w-3 shrink-0" /> {req.email}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Demande : {formatDate(req.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleDecision(req, true)}
                      disabled={actingId === req.id}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {actingId === req.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Check className="mr-1 h-4 w-4" /> Approuver
                        </>
                      )}
                    </Button>
                    <Button
                      onClick={() => handleDecision(req, false)}
                      disabled={actingId === req.id}
                      variant="destructive"
                      className="flex-1"
                    >
                      <X className="mr-1 h-4 w-4" /> Refuser
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* History */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Historique ({history.length})
          </h2>
          {history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Aucun historique
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {req.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{req.email}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(req.reviewed_at)}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      req.status === "approved"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {req.status === "approved" ? "Approuvé" : "Refusé"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Coaches */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Coachs inscrits ({coaches.length})
          </h2>
          {coachesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : coaches.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Aucun coach inscrit
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {coaches.map((coach) => {
                const expanded = expandedCoachId === coach.id;
                return (
                  <div
                    key={coach.id}
                    className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedCoachId(expanded ? null : coach.id)}
                      className="flex w-full items-start gap-3 text-left"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <UserIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground truncate">
                          {coach.full_name}
                        </p>
                        <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                          <Mail className="h-3 w-3 shrink-0" /> {coach.email}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {coach.players.length} joueur(s) assigné(s)
                        </p>
                      </div>
                      {expanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>

                    {expanded && (
                      <div className="border-t border-border pt-3">
                        {coach.players.length === 0 ? (
                          <p className="text-center text-sm text-muted-foreground py-2">
                            Aucun joueur assigné.
                          </p>
                        ) : (
                          <div className="flex flex-col gap-2">
                            {coach.players.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
                              >
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
                                  <UserIcon className="h-4 w-4 text-primary" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-medium text-foreground truncate">
                                    {p.full_name}
                                  </p>
                                  <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                                    <Mail className="h-3 w-3 shrink-0" /> {p.email}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Players */}
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Joueurs inscrits ({players.length})
          </h2>
          {coachesLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : players.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
              Aucun joueur inscrit
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {players.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-card p-4"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                    <UserIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {p.full_name}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground truncate">
                      <Mail className="h-3 w-3 shrink-0" /> {p.email}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground truncate">
                      Coach :{" "}
                      {p.coach ? (
                        <span className="text-foreground">{p.coach.full_name}</span>
                      ) : (
                        <span className="italic">Aucun coach assigné</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
