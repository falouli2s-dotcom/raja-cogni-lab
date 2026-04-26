import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Trash2, Clock, X, Mail, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/coach/joueurs")({
  component: CoachJoueurs,
});

type Relation = {
  id: string;
  player_id: string;
  status: "pending" | "accepted" | "declined";
  created_at: string;
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
    category: string | null;
    position: string | null;
  } | null;
};

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

function CoachJoueurs() {
  const navigate = useNavigate();
  const [coachId, setCoachId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [relations, setRelations] = useState<Relation[]>([]);
  const [loading, setLoading] = useState(true);

  async function loadRelations(uid: string) {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("coach_players")
      .select("id, player_id, status, created_at")
      .eq("coach_id", uid)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Impossible de charger les joueurs");
      setLoading(false);
      return;
    }
    const rels = (data ?? []) as Relation[];
    const ids = rels.map((r) => r.player_id);
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, category, position")
        .in("id", ids);
      const map = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      rels.forEach((r) => {
        r.profile = (map.get(r.player_id) as any) ?? null;
      });
    }
    setRelations(rels);
    setLoading(false);
  }

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCoachId(user.id);
      await loadRelations(user.id);
    })();
  }, []);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    if (!coachId || !email.trim()) return;
    setSending(true);
    try {
      const { data: found, error: findErr } = await (supabase as any).rpc(
        "find_player_by_email",
        { _email: email.trim() }
      );
      if (findErr) throw findErr;
      const player = (found ?? [])[0];
      if (!player) {
        toast.error("Aucun compte joueur trouvé");
        return;
      }
      if (player.id === coachId) {
        toast.error("Vous ne pouvez pas vous inviter vous-même");
        return;
      }

      const { data: existing } = await (supabase as any)
        .from("coach_players")
        .select("id, status")
        .eq("coach_id", coachId)
        .eq("player_id", player.id)
        .maybeSingle();

      if (existing) {
        if (existing.status === "pending") {
          toast.info("Invitation déjà envoyée, en attente");
          return;
        }
        if (existing.status === "accepted") {
          toast.info("Ce joueur est déjà dans votre équipe");
          return;
        }
        if (existing.status === "declined") {
          const { error: upErr } = await (supabase as any)
            .from("coach_players")
            .update({ status: "pending" })
            .eq("id", existing.id);
          if (upErr) throw upErr;
          toast.success("Invitation envoyée ✓");
        }
      } else {
        const { error: insErr } = await (supabase as any)
          .from("coach_players")
          .insert({ coach_id: coachId, player_id: player.id, status: "pending" });
        if (insErr) throw insErr;
        toast.success("Invitation envoyée ✓");
      }

      setEmail("");
      await loadRelations(coachId);
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur lors de l'envoi");
    } finally {
      setSending(false);
    }
  }

  async function removeRelation(id: string) {
    if (!coachId) return;
    const { error } = await (supabase as any)
      .from("coach_players")
      .delete()
      .eq("id", id);
    if (error) {
      toast.error("Suppression impossible");
      return;
    }
    toast.success("Joueur retiré");
    await loadRelations(coachId);
  }

  const accepted = relations.filter((r) => r.status === "accepted");
  const pending = relations.filter((r) => r.status === "pending");

  return (
    <div className="px-5 pt-12 pb-4">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Espace Coach
        </p>
        <h1 className="text-2xl font-bold text-foreground">Mes Joueurs</h1>
      </header>

      {/* Section 1 - Invite */}
      <motion.section
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 rounded-2xl border border-border bg-card p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <UserPlus className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Inviter un joueur</p>
            <p className="text-xs text-muted-foreground">
              Envoyer une invitation par email
            </p>
          </div>
        </div>
        <form onSubmit={handleInvite} className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email du joueur"
              className="pl-9"
              disabled={sending}
            />
          </div>
          <Button type="submit" disabled={sending || !email.trim()}>
            {sending ? "Envoi..." : "Envoyer l'invitation"}
          </Button>
        </form>
      </motion.section>

      {/* Section 2A - Confirmed */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Joueurs confirmés
          </h2>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {accepted.length}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : accepted.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/50 p-6 text-center">
            <Users className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Aucun joueur dans votre équipe pour l'instant
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <AnimatePresence>
              {accepted.map((r) => (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-muted/50"
                  onClick={() =>
                    navigate({
                      to: "/coach/joueur/$playerId",
                      params: { playerId: r.player_id },
                    })
                  }
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {r.profile?.avatar_url ? (
                      <img
                        src={r.profile.avatar_url}
                        alt={r.profile.full_name ?? ""}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      initials(r.profile?.full_name)
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {r.profile?.full_name ?? r.profile?.category ?? "Joueur sans nom"}
                    </p>
                    {!r.profile?.full_name && (
                      <p className="text-[11px] font-medium text-amber-400">
                        ⚠ Profil incomplet
                      </p>
                    )}
                    <div className="mt-0.5 flex flex-wrap gap-1.5">
                      {r.profile?.category && (
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {r.profile.category}
                        </span>
                      )}
                      {r.profile?.position && (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                          {r.profile.position}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRelation(r.id)}
                    className="text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Retirer
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </section>

      {/* Section 2B - Pending */}
      {pending.length > 0 && (
        <section className="mb-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Invitations en attente
            </h2>
            <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
              {pending.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            <AnimatePresence>
              {pending.map((r) => (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-sm font-bold text-amber-400">
                    {initials(r.profile?.full_name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {r.profile?.full_name ?? r.profile?.category ?? "Joueur sans nom"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      En attente de réponse...
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-1 text-[10px] font-semibold text-amber-400">
                    <Clock className="h-3 w-3" /> Pending
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeRelation(r.id)}
                    aria-label="Annuler l'invitation"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  );
}
