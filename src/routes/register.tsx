import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Eye, EyeOff, Mail, Lock, User, Calendar, ChevronRight, ChevronLeft, Camera, Loader2, Trophy, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type PlayerCategory = Database["public"]["Enums"]["player_category"];
type PlayerPosition = Database["public"]["Enums"]["player_position"];
type DominantFoot = Database["public"]["Enums"]["dominant_foot"];

export const Route = createFileRoute("/register")({
  component: RegisterPage,
});

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const levels = [
    { label: "Faible", color: "bg-destructive" },
    { label: "Faible", color: "bg-destructive" },
    { label: "Moyen", color: "bg-warning" },
    { label: "Bon", color: "bg-primary" },
    { label: "Fort", color: "bg-primary" },
  ];
  return { score, ...levels[score] };
}

const TOTAL_STEPS = 3;

type Role = "joueur" | "coach";

function RegisterPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [role, setRole] = useState<Role | null>(null);
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [poste, setPoste] = useState<PlayerPosition | "">("");
  const [category, setCategory] = useState<PlayerCategory | "">("");
  const [dominantFoot, setDominantFoot] = useState<DominantFoot | "">("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = getPasswordStrength(password);

  function handleAvatarSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("L'image doit faire moins de 5 Mo");
      return;
    }
    if (!file.type.startsWith("image/")) {
      toast.error("Format d'image invalide");
      return;
    }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleCoachRegister(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    const fullName = `${prenom.trim()} ${nom.trim()}`.trim();

    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { prenom, nom, full_name: fullName },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const userId = signUpData.user?.id;
    if (userId) {
      await supabase
        .from("profiles")
        .upsert(
          { id: userId, full_name: fullName || null, role: "coach_pending" },
          { onConflict: "id" }
        );

      await supabase.from("coach_requests").insert({
        user_id: userId,
        full_name: fullName,
        email,
        status: "pending",
      });
    }

    navigate({ to: "/verify-email", search: { email }, replace: true });
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const fullName = `${prenom.trim()} ${nom.trim()}`.trim();

    const { data: signUpData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          nom,
          prenom,
          full_name: fullName,
          date_naissance: dateNaissance,
          position: poste,
        },
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const userId = signUpData.user?.id;
    let avatarUrl: string | null = null;

    if (userId && avatarFile) {
      const ext = avatarFile.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${userId}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true, contentType: avatarFile.type });
      if (!uploadError) {
        const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
        avatarUrl = pub.publicUrl;
      } else {
        toast.error("Avatar non uploadé : " + uploadError.message);
      }
    }

    if (userId) {
      await supabase.from("profiles").upsert(
        {
          id: userId,
          full_name: fullName || null,
          birth_date: dateNaissance || null,
          position: (poste || null) as PlayerPosition | null,
          category: (category || null) as PlayerCategory | null,
          dominant_foot: (dominantFoot || null) as DominantFoot | null,
          avatar_url: avatarUrl,
          role: "joueur",
        },
        { onConflict: "id" }
      );
    }

    navigate({ to: "/verify-email", search: { email }, replace: true });
  }

  // ROLE SELECTION SCREEN
  if (role === null) {
    return (
      <div className="flex min-h-screen flex-col bg-background px-6 pt-12 pb-8">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col items-center gap-2 mb-10"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <Brain className="h-9 w-9 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Créer un compte</h1>
          <p className="text-sm text-muted-foreground">Choisis ton profil</p>
        </motion.div>

        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => setRole("joueur")}
            className="flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-5 text-left transition hover:border-primary hover:bg-primary/5"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <Trophy className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Je suis Joueur</p>
              <p className="text-sm text-muted-foreground">Réalise tes tests cognitifs</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>

          <button
            type="button"
            onClick={() => setRole("coach")}
            className="flex items-center gap-4 rounded-2xl border-2 border-border bg-card p-5 text-left transition hover:border-primary hover:bg-primary/5"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
              <ClipboardList className="h-7 w-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Je suis Coach</p>
              <p className="text-sm text-muted-foreground">Suis les performances de tes joueurs</p>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Déjà un compte ?{" "}
            <Link to="/login" className="font-semibold text-primary">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // COACH REGISTRATION FORM
  if (role === "coach") {
    return (
      <div className="flex min-h-screen flex-col bg-background px-6 pt-12 pb-8">
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="flex flex-col items-center gap-2 mb-8"
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
            <ClipboardList className="h-9 w-9 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Inscription Coach</h1>
          <button
            type="button"
            onClick={() => setRole(null)}
            className="text-xs text-muted-foreground underline"
          >
            Changer de profil
          </button>
        </motion.div>

        {error && (
          <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleCoachRegister} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="c-prenom">Prénom</Label>
              <Input id="c-prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="c-nom">Nom</Label>
              <Input id="c-nom" value={nom} onChange={(e) => setNom(e.target.value)} required />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="c-email"
                type="email"
                placeholder="ton.email@exemple.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-password">Mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="c-password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < strength.score ? strength.color : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{strength.label}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="c-confirm">Confirmation mot de passe</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="c-confirm"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-10"
                required
              />
            </div>
          </div>

          <Button type="submit" disabled={loading} className="mt-2 h-12 text-base font-semibold">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Inscription...</> : "Créer mon compte coach"}
          </Button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            Déjà un compte ?{" "}
            <Link to="/login" className="font-semibold text-primary">
              Se connecter
            </Link>
          </p>
        </div>
      </div>
    );
  }

  // PLAYER REGISTRATION (existing flow)
  return (
    <div className="flex min-h-screen flex-col bg-background px-6 pt-12 pb-8">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col items-center gap-2 mb-8"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Brain className="h-9 w-9 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Créer un compte</h1>
        <p className="text-sm text-muted-foreground">Étape {step} sur {TOTAL_STEPS}</p>
        <button
          type="button"
          onClick={() => setRole(null)}
          className="text-xs text-muted-foreground underline"
        >
          Changer de profil
        </button>
      </motion.div>

      {/* Progress bar */}
      <div className="mb-6 flex gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full ${step >= i + 1 ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <AnimatePresence mode="wait">
        {step === 1 && (
          <motion.div
            key="step1"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="ton.email@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reg-password">Mot de passe</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reg-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {password && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < strength.score ? strength.color : "bg-muted"
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{strength.label}</p>
                </div>
              )}
            </div>

            <Button
              onClick={() => {
                if (!email || !password) return;
                setStep(2);
              }}
              className="mt-4 h-12 text-base font-semibold"
            >
              Suivant <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </motion.div>
        )}

        {step === 2 && (
          <motion.div
            key="step2"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="prenom">Prénom</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="prenom"
                    placeholder="Prénom"
                    value={prenom}
                    onChange={(e) => setPrenom(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="nom">Nom</Label>
                <Input
                  id="nom"
                  placeholder="Nom"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="date-naissance">Date de naissance</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="date-naissance"
                  type="date"
                  value={dateNaissance}
                  onChange={(e) => setDateNaissance(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="poste">Poste</Label>
                <Select value={poste} onValueChange={(v) => setPoste(v as PlayerPosition)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Gardien">Gardien</SelectItem>
                    <SelectItem value="Défenseur">Défenseur</SelectItem>
                    <SelectItem value="Milieu">Milieu</SelectItem>
                    <SelectItem value="Attaquant">Attaquant</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="categorie">Catégorie</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as PlayerCategory)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir" />
                  </SelectTrigger>
                  <SelectContent>
                    {(["U13", "U14", "U15", "U16", "U17", "U18", "U21"] as PlayerCategory[]).map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pied">Pied dominant</Label>
              <Select value={dominantFoot} onValueChange={(v) => setDominantFoot(v as DominantFoot)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisis ton pied dominant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Droit">Droit</SelectItem>
                  <SelectItem value="Gauche">Gauche</SelectItem>
                  <SelectItem value="Les deux">Les deux</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="mt-4 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(1)}
                className="h-12 flex-1"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Retour
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!prenom || !nom || !dateNaissance) return;
                  setStep(3);
                }}
                className="h-12 flex-1 text-base font-semibold"
              >
                Suivant <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}

        {step === 3 && (
          <motion.form
            key="step3"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            onSubmit={handleRegister}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col items-center gap-3">
              <p className="text-sm font-medium text-foreground">Photo de profil (optionnel)</p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative flex h-32 w-32 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border bg-muted transition hover:border-primary"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Aperçu avatar" className="h-full w-full object-cover" />
                ) : (
                  <Camera className="h-8 w-8 text-muted-foreground" />
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-primary/80 py-1 text-center text-xs font-medium text-primary-foreground">
                  {avatarPreview ? "Changer" : "Ajouter"}
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarSelect}
                className="hidden"
              />
              <p className="text-xs text-muted-foreground">JPG, PNG • max 5 Mo</p>
            </div>

            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <p className="font-semibold text-foreground mb-2">Récapitulatif</p>
              <ul className="space-y-1 text-muted-foreground">
                <li><span className="text-foreground">{prenom} {nom}</span></li>
                <li>{email}</li>
                {poste && <li>Poste : <span className="text-foreground">{poste}</span></li>}
                {category && <li>Catégorie : <span className="text-foreground">{category}</span></li>}
                {dominantFoot && <li>Pied : <span className="text-foreground">{dominantFoot}</span></li>}
              </ul>
            </div>

            <div className="mt-2 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep(2)}
                disabled={loading}
                className="h-12 flex-1"
              >
                <ChevronLeft className="mr-1 h-4 w-4" /> Retour
              </Button>
              <Button type="submit" disabled={loading} className="h-12 flex-1 text-base font-semibold">
                {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Inscription...</> : "S'inscrire"}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Déjà un compte ?{" "}
          <Link to="/login" className="font-semibold text-primary">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
