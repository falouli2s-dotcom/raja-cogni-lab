import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { LogOut, Pencil, Check, X, Users, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/coach/profil")({
  component: CoachProfil,
});

type Profile = {
  id: string;
  full_name: string | null;
  role: string;
  avatar_url: string | null;
  category: string | null;
  position: string | null;
};

type PlayerItem = {
  player_id: string;
  full_name: string | null;
  category: string | null;
  position: string | null;
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

function CoachProfil() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [email, setEmail] = useState<string>("");
  const [players, setPlayers] = useState<PlayerItem[]>([]);
  const [stats, setStats] = useState({
    playersCount: 0,
    sessionsTotal: 0,
    sessionsCompleted: 0,
  });
  const [loading, setLoading] = useState(true);

  // Edit mode
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setEmail(user.email ?? "");

      const [{ data: prof }, { data: rels }, { data: sessAll }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id, full_name, role, avatar_url, category, position")
            .eq("id", user.id)
            .single(),
          (supabase as any)
            .from("coach_players")
            .select("player_id")
            .eq("coach_id", user.id)
            .eq("status", "accepted"),
          (supabase as any)
            .from("sessions_planifiees")
            .select("id, status")
            .eq("coach_id", user.id),
        ]);

      const p = prof as Profile | null;
      setProfile(p);
      setEditName(p?.full_name ?? "");

      const acceptedIds = ((rels ?? []) as { player_id: string }[]).map(
        (r) => r.player_id
      );
      const allSessions = (sessAll ?? []) as { id: string; status: string }[];
      setStats({
        playersCount: acceptedIds.length,
        sessionsTotal: allSessions.length,
        sessionsCompleted: allSessions.filter((s) => s.status === "completed")
          .length,
      });

      if (acceptedIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, category, position")
          .in("id", acceptedIds);
        setPlayers(
          (profs ?? []).map((pp: any) => ({
            player_id: pp.id,
            full_name: pp.full_name,
            category: pp.category,
            position: pp.position,
          }))
        );
      }

      setLoading(false);
    })();
  }, []);

  async function handleSave() {
    if (!profile) return;
    if (!editName.trim()) {
      toast.error("Le nom ne peut pas être vide");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: editName.trim() })
        .eq("id", profile.id);
      if (error) throw error;
      setProfile((prev) =>
        prev ? { ...prev, full_name: editName.trim() } : prev
      );
      setEditing(false);
      toast.success("Profil mis à jour ✓");
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur lors de la sauvegarde");
    } finally {
      setSaving(false);
    }
  }

  function handleCancelEdit() {
    setEditName(profile?.full_name ?? "");
    setEditing(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-12 pb-28">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Espace Coach
        </p>
        <h1 className="text-2xl font-bold text-foreground">Mon Profil</h1>
      </header>

      {/* Avatar + Name */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="mb-6 flex flex-col items-center gap-3"
      >
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-2xl font-bold text-primary">
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
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">
            {profile?.full_name ?? "Coach"}
          </p>
          <span className="mt-0.5 inline-block rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary capitalize">
            {profile?.role ?? "Coach"}
          </span>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.08 }}
        className="mb-6 grid grid-cols-3 gap-3"
      >
        <StatCard emoji="👥" label="Joueurs" value={stats.playersCount} />
        <StatCard emoji="📋" label="Sessions" value={stats.sessionsTotal} />
        <StatCard emoji="✅" label="Complétées" value={stats.sessionsCompleted} />
      </motion.div>

      {/* Personal info */}
      <motion.section
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.12 }}
        className="mb-6"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">
            Informations personnelles
          </h2>
          {!editing ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
            >
              <Pencil className="h-3.5 w-3.5" /> Modifier
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                <X className="h-3.5 w-3.5" /> Annuler
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1 rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground"
              >
                <Check className="h-3.5 w-3.5" />{" "}
                {saving ? "Sauvegarde..." : "Sauvegarder"}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
          <InfoField
            label="Nom complet"
            value={editing ? editName : (profile?.full_name ?? "")}
            editing={editing}
            onChange={setEditName}
          />
          <div className="h-px bg-border" />
          <InfoField
            label="Email"
            value={email}
            editing={false}
            disabled
          />
          {profile?.category && (
            <>
              <div className="h-px bg-border" />
              <InfoField
                label="Catégorie"
                value={profile.category}
                editing={false}
                disabled
              />
            </>
          )}
          {profile?.position && (
            <>
              <div className="h-px bg-border" />
              <InfoField
                label="Poste"
                value={profile.position}
                editing={false}
                disabled
              />
            </>
          )}
        </div>
      </motion.section>

      {/* Players */}
      {players.length > 0 && (
        <motion.section
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.16 }}
          className="mb-6"
        >
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              Mes joueurs
            </h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
              {players.length}
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {players.map((pl) => (
              <button
                key={pl.player_id}
                onClick={() => navigate({ to: "/coach/joueurs" })}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 text-left transition-colors active:bg-muted/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {initials(pl.full_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {pl.full_name ?? "Joueur sans nom"}
                  </p>
                  <div className="mt-0.5 flex flex-wrap gap-1.5">
                    {pl.category && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                        {pl.category}
                      </span>
                    )}
                    {pl.position && (
                      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-medium text-accent">
                        {pl.position}
                      </span>
                    )}
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            ))}
          </div>
        </motion.section>
      )}

      {/* Logout */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <Button
          variant="outline"
          onClick={handleLogout}
          className="h-12 w-full border-rose-500/30 text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
        >
          <LogOut className="mr-2 h-4 w-4" /> Déconnexion
        </Button>
      </motion.div>
    </div>
  );
}

function StatCard({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: number;
}) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-2xl border border-border bg-card p-3 text-center">
      <span className="text-xl">{emoji}</span>
      <p className="text-xl font-bold text-foreground">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function InfoField({
  label,
  value,
  editing,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange?: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </p>
      {editing && !disabled ? (
        <Input
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className="h-8 flex-1 text-right text-sm"
        />
      ) : (
        <p
          className={`flex-1 text-right text-sm font-medium ${
            disabled ? "text-muted-foreground" : "text-foreground"
          }`}
        >
          {value || "—"}
        </p>
      )}
    </div>
  );
}
