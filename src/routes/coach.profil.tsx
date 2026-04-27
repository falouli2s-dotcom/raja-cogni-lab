import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  LogOut,
  Pencil,
  Check,
  X,
  ChevronRight,
  Shield,
  Bell,
  Palette,
  Eye,
  EyeOff,
  Camera,
  Trash2,
  Loader2,
  Sun,
  Moon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
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

type SheetType = "security" | "notifications" | "appearance" | null;

interface NotifPrefs {
  rappels: boolean;
  resultats: boolean;
  exercices: boolean;
}

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

function pathFromPublicUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const marker = "/storage/v1/object/public/avatars/";
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.substring(idx + marker.length).split("?")[0];
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

  // Edit mode (name)
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);

  // Sheets
  const [openSheet, setOpenSheet] = useState<SheetType>(null);

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);

  // Security
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({
    rappels: true,
    resultats: false,
    exercices: false,
  });
  const [savingNotifs, setSavingNotifs] = useState(false);

  // Theme
  const [theme, setTheme] = useState<"light" | "dark">("light");

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

    // Notif prefs
    try {
      const stored = localStorage.getItem("cogni_coach_notif_prefs");
      if (stored) setNotifPrefs(JSON.parse(stored));
    } catch {}

    // Theme (shared key with player profile)
    const storedTheme = localStorage.getItem("cogni_theme") as
      | "light"
      | "dark"
      | null;
    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      setTheme(
        document.documentElement.classList.contains("dark") ? "dark" : "light"
      );
    }
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

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !profile) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner une image");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image trop volumineuse (max 5 Mo)");
      return;
    }

    setUploadingAvatar(true);
    try {
      const oldPath = pathFromPublicUrl(profile.avatar_url);
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const newPath = `${profile.id}/avatar-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(newPath, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage
        .from("avatars")
        .getPublicUrl(newPath);
      const publicUrl = pub.publicUrl;

      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", profile.id);
      if (updErr) throw updErr;

      if (oldPath && oldPath !== newPath) {
        await supabase.storage.from("avatars").remove([oldPath]);
      }

      setProfile((p) =>
        p ? { ...p, avatar_url: `${publicUrl}?v=${Date.now()}` } : p
      );
      toast.success("Photo de profil mise à jour");
    } catch (err: any) {
      toast.error(err.message || "Échec de l'upload");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleAvatarDelete() {
    if (!profile?.avatar_url) return;
    setDeletingAvatar(true);
    try {
      const oldPath = pathFromPublicUrl(profile.avatar_url);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", profile.id);
      if (updErr) throw updErr;
      if (oldPath) {
        await supabase.storage.from("avatars").remove([oldPath]);
      }
      setProfile((p) => (p ? { ...p, avatar_url: null } : p));
      toast.success("Photo supprimée");
    } catch (err: any) {
      toast.error(err.message || "Échec de la suppression");
    } finally {
      setDeletingAvatar(false);
    }
  }

  async function handleSaveSecurity() {
    if (newPassword.length < 8) {
      toast.error("8 caractères minimum");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setSavingSecurity(true);
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    setSavingSecurity(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Mot de passe mis à jour");
    setOpenSheet(null);
  }

  function handleSaveNotifs() {
    setSavingNotifs(true);
    localStorage.setItem(
      "cogni_coach_notif_prefs",
      JSON.stringify(notifPrefs)
    );
    setTimeout(() => {
      setSavingNotifs(false);
      toast.success("Préférences enregistrées");
      setOpenSheet(null);
    }, 300);
  }

  function handleSetTheme(t: "light" | "dark") {
    setTheme(t);
    localStorage.setItem("cogni_theme", t);
    if (t === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    toast.success(t === "dark" ? "Mode sombre activé" : "Mode clair activé");
    setOpenSheet(null);
  }

  const menuItems = [
    {
      icon: Shield,
      label: "Sécurité",
      action: () => setOpenSheet("security"),
    },
    {
      icon: Bell,
      label: "Notifications",
      action: () => setOpenSheet("notifications"),
    },
    {
      icon: Palette,
      label: "Apparence",
      action: () => setOpenSheet("appearance"),
    },
  ];

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
        <div className="relative">
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
          <label
            htmlFor="avatar-upload"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95"
            aria-label="Changer la photo"
          >
            {uploadingAvatar ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Camera className="h-3.5 w-3.5" />
            )}
          </label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
            disabled={uploadingAvatar || deletingAvatar}
          />
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">
            {profile?.full_name ?? "Coach"}
          </p>
          <span className="mt-0.5 inline-block rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary capitalize">
            {profile?.role ?? "Coach"}
          </span>
          {profile?.avatar_url && (
            <div className="mt-2">
              <button
                type="button"
                onClick={handleAvatarDelete}
                disabled={deletingAvatar || uploadingAvatar}
                className="inline-flex items-center gap-1 text-xs font-medium text-destructive transition-opacity active:opacity-70 disabled:opacity-50"
              >
                <Trash2 className="h-3 w-3" /> Supprimer la photo
              </button>
            </div>
          )}
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
        <StatCard
          emoji="✅"
          label="Complétées"
          value={stats.sessionsCompleted}
        />
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
          <InfoField label="Email" value={email} editing={false} disabled />
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

      {/* Settings menu */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.14 }}
        className="mb-6 flex flex-col rounded-2xl border border-border bg-card"
      >
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={i}
              onClick={item.action}
              className={`flex items-center justify-between px-4 py-4 text-left transition-colors active:bg-muted ${
                i !== menuItems.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {item.label}
                </span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
      </motion.div>

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

      {/* === SHEETS === */}

      {/* Security */}
      <Sheet
        open={openSheet === "security"}
        onOpenChange={(o) => !o && setOpenSheet(null)}
      >
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Sécurité</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Confirmer le mot de passe
              </label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmer"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive mt-1">
                  Les mots de passe ne correspondent pas
                </p>
              )}
            </div>
            <Button
              onClick={handleSaveSecurity}
              disabled={
                savingSecurity ||
                newPassword.length < 8 ||
                newPassword !== confirmPassword
              }
              className="h-12 w-full text-base font-semibold mt-2"
            >
              {savingSecurity ? "Mise à jour..." : "Mettre à jour"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Notifications */}
      <Sheet
        open={openSheet === "notifications"}
        onOpenChange={(o) => !o && setOpenSheet(null)}
      >
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-1">
            {[
              { key: "rappels" as const, label: "Rappels de session" },
              { key: "resultats" as const, label: "Résultats de tests" },
              { key: "exercices" as const, label: "Nouveaux exercices" },
            ].map((item) => (
              <div
                key={item.key}
                className="flex items-center justify-between py-3 border-b border-border last:border-0"
              >
                <span className="text-sm font-medium text-foreground">
                  {item.label}
                </span>
                <Switch
                  checked={notifPrefs[item.key]}
                  onCheckedChange={(v) =>
                    setNotifPrefs((p) => ({ ...p, [item.key]: v }))
                  }
                />
              </div>
            ))}
            <Button
              onClick={handleSaveNotifs}
              disabled={savingNotifs}
              className="h-12 w-full text-base font-semibold mt-4"
            >
              {savingNotifs ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Appearance */}
      <Sheet
        open={openSheet === "appearance"}
        onOpenChange={(o) => !o && setOpenSheet(null)}
      >
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Apparence</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSetTheme("light")}
              className={cn(
                "flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-colors",
                theme === "light"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              )}
            >
              <Sun
                className={cn(
                  "h-8 w-8",
                  theme === "light" ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-sm font-semibold",
                  theme === "light" ? "text-primary" : "text-muted-foreground"
                )}
              >
                Clair
              </span>
            </button>
            <button
              onClick={() => handleSetTheme("dark")}
              className={cn(
                "flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-colors",
                theme === "dark"
                  ? "border-primary bg-primary/5"
                  : "border-border bg-card"
              )}
            >
              <Moon
                className={cn(
                  "h-8 w-8",
                  theme === "dark" ? "text-primary" : "text-muted-foreground"
                )}
              />
              <span
                className={cn(
                  "text-sm font-semibold",
                  theme === "dark" ? "text-primary" : "text-muted-foreground"
                )}
              >
                Sombre
              </span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
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
