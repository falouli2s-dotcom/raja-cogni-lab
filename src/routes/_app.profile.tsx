import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { User, LogOut, ChevronRight, Shield, Bell, Palette, BarChart3, Sun, Moon, Eye, EyeOff, Camera, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type PlayerCategory = Database["public"]["Enums"]["player_category"];
type PlayerPosition = Database["public"]["Enums"]["player_position"];
type DominantFoot = Database["public"]["Enums"]["dominant_foot"];
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

type SheetType = "personal" | "security" | "notifications" | "appearance" | null;

interface NotifPrefs {
  rappels: boolean;
  resultats: boolean;
  exercices: boolean;
}

function ProfilePage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [profile, setProfile] = useState<{ full_name: string | null; birth_date: string | null; category: PlayerCategory | null; position: PlayerPosition | null; dominant_foot: DominantFoot | null; avatar_url: string | null } | null>(null);
  const [openSheet, setOpenSheet] = useState<SheetType>(null);

  // Personal info state
  const [fullName, setFullName] = useState("");
  const [dateNaissance, setDateNaissance] = useState<Date | undefined>();
  const [position, setPosition] = useState<PlayerPosition | "">("");
  const [category, setCategory] = useState<PlayerCategory | "">("");
  const [dominantFoot, setDominantFoot] = useState<DominantFoot | "">("");
  const [savingPersonal, setSavingPersonal] = useState(false);

  // Security state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savingSecurity, setSavingSecurity] = useState(false);

  // Notifications state
  const [notifPrefs, setNotifPrefs] = useState<NotifPrefs>({ rappels: true, resultats: false, exercices: false });
  const [savingNotifs, setSavingNotifs] = useState(false);

  // Theme state
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Avatar state
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;
      setUserId(authUser.id);
      setEmail(authUser.email || "");

      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name, birth_date, category, position, dominant_foot, avatar_url")
        .eq("id", authUser.id)
        .maybeSingle();

      if (prof) {
        setProfile(prof);
        setFullName(prof.full_name || "");
        setPosition(prof.position || "");
        setCategory(prof.category || "");
        setDominantFoot(prof.dominant_foot || "");
        if (prof.birth_date) setDateNaissance(new Date(prof.birth_date));
      }
    })();

    // Load notif prefs
    try {
      const stored = localStorage.getItem("cogni_notif_prefs");
      if (stored) setNotifPrefs(JSON.parse(stored));
    } catch {}

    // Load theme
    const storedTheme = localStorage.getItem("cogni_theme") as "light" | "dark" | null;
    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
    }
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  // Extract storage path from a public URL
  function pathFromPublicUrl(url: string | null | undefined): string | null {
    if (!url) return null;
    const marker = "/storage/v1/object/public/avatars/";
    const idx = url.indexOf(marker);
    if (idx === -1) return null;
    return url.substring(idx + marker.length).split("?")[0];
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !userId) return;

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
      const oldPath = pathFromPublicUrl(profile?.avatar_url);
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const newPath = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(newPath, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(newPath);
      const publicUrl = `${pub.publicUrl}?v=${Date.now()}`;

      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("id", userId);
      if (updErr) throw updErr;

      // Best-effort delete old file
      if (oldPath && oldPath !== newPath) {
        await supabase.storage.from("avatars").remove([oldPath]);
      }

      setProfile((p) => ({
        full_name: p?.full_name ?? null,
        birth_date: p?.birth_date ?? null,
        category: p?.category ?? null,
        position: p?.position ?? null,
        dominant_foot: p?.dominant_foot ?? null,
        avatar_url: publicUrl,
      }));
      toast.success("Photo de profil mise à jour");
    } catch (err: any) {
      toast.error(err.message || "Échec de l'upload");
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleAvatarDelete() {
    if (!userId || !profile?.avatar_url) return;
    setDeletingAvatar(true);
    try {
      const oldPath = pathFromPublicUrl(profile.avatar_url);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: null })
        .eq("id", userId);
      if (updErr) throw updErr;
      if (oldPath) {
        await supabase.storage.from("avatars").remove([oldPath]);
      }
      setProfile((p) => ({
        full_name: p?.full_name ?? null,
        birth_date: p?.birth_date ?? null,
        category: p?.category ?? null,
        position: p?.position ?? null,
        dominant_foot: p?.dominant_foot ?? null,
        avatar_url: null,
      }));
      toast.success("Photo supprimée");
    } catch (err: any) {
      toast.error(err.message || "Échec de la suppression");
    } finally {
      setDeletingAvatar(false);
    }
  }

  // Personal info save
  async function handleSavePersonal() {
    if (!userId) return;
    setSavingPersonal(true);
    const payload = {
      id: userId,
      full_name: fullName.trim() || null,
      birth_date: dateNaissance ? dateNaissance.toISOString().split("T")[0] : null,
      position: (position || null) as PlayerPosition | null,
      category: (category || null) as PlayerCategory | null,
      dominant_foot: (dominantFoot || null) as DominantFoot | null,
    };
    const { error } = await supabase.from("profiles").upsert(payload, { onConflict: "id" });
    setSavingPersonal(false);
    if (error) { toast.error(error.message); return; }
    setProfile((p) => ({
      full_name: payload.full_name,
      birth_date: payload.birth_date,
      position: payload.position,
      category: payload.category,
      dominant_foot: payload.dominant_foot,
      avatar_url: p?.avatar_url ?? null,
    }));
    toast.success("Informations mises à jour");
    setOpenSheet(null);
  }

  // Security save
  async function handleSaveSecurity() {
    if (newPassword.length < 8) { toast.error("Le mot de passe doit contenir au moins 8 caractères"); return; }
    if (newPassword !== confirmPassword) { toast.error("Les mots de passe ne correspondent pas"); return; }
    setSavingSecurity(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingSecurity(false);
    if (error) { toast.error(error.message); return; }
    setNewPassword(""); setConfirmPassword("");
    toast.success("Mot de passe mis à jour");
    setOpenSheet(null);
  }

  // Notifications save
  function handleSaveNotifs() {
    setSavingNotifs(true);
    localStorage.setItem("cogni_notif_prefs", JSON.stringify(notifPrefs));
    setTimeout(() => {
      setSavingNotifs(false);
      toast.success("Préférences de notifications enregistrées");
      setOpenSheet(null);
    }, 300);
  }

  // Theme toggle
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
    { icon: BarChart3, label: "Historique des sessions", action: () => navigate({ to: "/sessions" }) },
    { icon: User, label: "Informations personnelles", action: () => setOpenSheet("personal") },
    { icon: Shield, label: "Sécurité", action: () => setOpenSheet("security") },
    { icon: Bell, label: "Notifications", action: () => setOpenSheet("notifications") },
    { icon: Palette, label: "Apparence", action: () => setOpenSheet("appearance") },
  ];

  return (
    <div className="px-5 pt-12 pb-4">
      <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="text-2xl font-bold text-foreground">Profil</h1>
      </motion.div>

      {/* User info card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
      >
        <div className="relative">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-primary/10">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <User className="h-7 w-7 text-primary" />
            )}
          </div>
          <label
            htmlFor="avatar-upload"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md transition-transform active:scale-95"
            aria-label="Changer la photo"
          >
            {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
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
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">
            {profile?.full_name || "Joueur"}
          </p>
          <p className="truncate text-sm text-muted-foreground">{email}</p>
          {profile?.avatar_url && (
            <button
              type="button"
              onClick={handleAvatarDelete}
              disabled={deletingAvatar || uploadingAvatar}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-destructive transition-opacity active:opacity-70 disabled:opacity-50"
            >
              <Trash2 className="h-3 w-3" /> Supprimer la photo
            </button>
          )}
        </div>
      </motion.div>

      {/* Menu */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 flex flex-col rounded-2xl border border-border bg-card"
      >
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={i}
              onClick={item.action}
              className={`flex items-center justify-between px-4 py-4 text-left transition-colors active:bg-muted ${i !== menuItems.length - 1 ? "border-b border-border" : ""}`}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{item.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
      </motion.div>

      {/* Logout */}
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6">
        <Button variant="destructive" onClick={handleLogout} className="h-12 w-full text-base font-semibold">
          <LogOut className="mr-2 h-5 w-5" /> Se déconnecter
        </Button>
      </motion.div>

      <p className="mt-8 text-center text-xs text-muted-foreground">CogniRaja v1.0 — Académie Raja Casablanca</p>

      {/* === SHEETS === */}

      {/* Personal Info Sheet */}
      <Sheet open={openSheet === "personal"} onOpenChange={(o) => !o && setOpenSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Informations personnelles</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nom complet</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Prénom Nom" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Date de naissance</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !dateNaissance && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateNaissance ? format(dateNaissance, "d MMMM yyyy", { locale: fr }) : "Sélectionner"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateNaissance}
                    onSelect={setDateNaissance}
                    disabled={(d) => d > new Date()}
                    initialFocus
                    className="p-3 pointer-events-auto"
                    captionLayout="dropdown"
                    fromYear={1980}
                    toYear={new Date().getFullYear()}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Catégorie</label>
              <Select value={category} onValueChange={(v) => setCategory(v as PlayerCategory)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner une catégorie" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="U13">U13</SelectItem>
                  <SelectItem value="U14">U14</SelectItem>
                  <SelectItem value="U15">U15</SelectItem>
                  <SelectItem value="U16">U16</SelectItem>
                  <SelectItem value="U17">U17</SelectItem>
                  <SelectItem value="U18">U18</SelectItem>
                  <SelectItem value="U21">U21</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Poste</label>
              <Select value={position} onValueChange={(v) => setPosition(v as PlayerPosition)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un poste" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gardien">Gardien</SelectItem>
                  <SelectItem value="Défenseur">Défenseur</SelectItem>
                  <SelectItem value="Milieu">Milieu</SelectItem>
                  <SelectItem value="Attaquant">Attaquant</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Pied dominant</label>
              <Select value={dominantFoot} onValueChange={(v) => setDominantFoot(v as DominantFoot)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un pied" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Droit">Droit</SelectItem>
                  <SelectItem value="Gauche">Gauche</SelectItem>
                  <SelectItem value="Les deux">Les deux</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleSavePersonal} disabled={savingPersonal} className="h-12 w-full text-base font-semibold mt-2">
              {savingPersonal ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Security Sheet */}
      <Sheet open={openSheet === "security"} onOpenChange={(o) => !o && setOpenSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Sécurité</SheetTitle>
          </SheetHeader>
          <div className="mt-4 flex flex-col gap-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Nouveau mot de passe</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 caractères"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Confirmer le mot de passe</label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmer"
              />
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive mt-1">Les mots de passe ne correspondent pas</p>
              )}
            </div>
            <Button onClick={handleSaveSecurity} disabled={savingSecurity || newPassword.length < 8 || newPassword !== confirmPassword} className="h-12 w-full text-base font-semibold mt-2">
              {savingSecurity ? "Mise à jour..." : "Mettre à jour"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Notifications Sheet */}
      <Sheet open={openSheet === "notifications"} onOpenChange={(o) => !o && setOpenSheet(null)}>
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
              <div key={item.key} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                <span className="text-sm font-medium text-foreground">{item.label}</span>
                <Switch
                  checked={notifPrefs[item.key]}
                  onCheckedChange={(v) => setNotifPrefs((p) => ({ ...p, [item.key]: v }))}
                />
              </div>
            ))}
            <Button onClick={handleSaveNotifs} disabled={savingNotifs} className="h-12 w-full text-base font-semibold mt-4">
              {savingNotifs ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Appearance Sheet */}
      <Sheet open={openSheet === "appearance"} onOpenChange={(o) => !o && setOpenSheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Apparence</SheetTitle>
          </SheetHeader>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSetTheme("light")}
              className={cn(
                "flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-colors",
                theme === "light" ? "border-primary bg-primary/5" : "border-border bg-card"
              )}
            >
              <Sun className={cn("h-8 w-8", theme === "light" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-semibold", theme === "light" ? "text-primary" : "text-muted-foreground")}>Clair</span>
            </button>
            <button
              onClick={() => handleSetTheme("dark")}
              className={cn(
                "flex flex-col items-center gap-3 rounded-2xl border-2 p-6 transition-colors",
                theme === "dark" ? "border-primary bg-primary/5" : "border-border bg-card"
              )}
            >
              <Moon className={cn("h-8 w-8", theme === "dark" ? "text-primary" : "text-muted-foreground")} />
              <span className={cn("text-sm font-semibold", theme === "dark" ? "text-primary" : "text-muted-foreground")}>Sombre</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
