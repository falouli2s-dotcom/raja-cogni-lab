import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Eye, EyeOff, Mail, Lock, User, Calendar, ChevronRight, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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

function RegisterPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [nom, setNom] = useState("");
  const [prenom, setPrenom] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [poste, setPoste] = useState<"Gardien" | "Défenseur" | "Milieu" | "Attaquant" | "">("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const strength = getPasswordStrength(password);

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
    if (userId) {
      await supabase.from("profiles").upsert(
        {
          id: userId,
          full_name: fullName || null,
          birth_date: dateNaissance || null,
          position: poste || null,
        },
        { onConflict: "id" }
      );
    }

    navigate({ to: "/verify-email", search: { email }, replace: true });
  }

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
        <p className="text-sm text-muted-foreground">Étape {step} sur 2</p>
      </motion.div>

      {/* Progress bar */}
      <div className="mb-6 flex gap-2">
        <div className={`h-1 flex-1 rounded-full ${step >= 1 ? "bg-primary" : "bg-muted"}`} />
        <div className={`h-1 flex-1 rounded-full ${step >= 2 ? "bg-primary" : "bg-muted"}`} />
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
          <motion.form
            key="step2"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            onSubmit={handleRegister}
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

            <div className="space-y-2">
              <Label htmlFor="poste">Poste</Label>
              <Select value={poste} onValueChange={(v) => setPoste(v as typeof poste)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisis ton poste" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Gardien">Gardien</SelectItem>
                  <SelectItem value="Défenseur">Défenseur</SelectItem>
                  <SelectItem value="Milieu">Milieu</SelectItem>
                  <SelectItem value="Attaquant">Attaquant</SelectItem>
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
              <Button type="submit" disabled={loading} className="h-12 flex-1 text-base font-semibold">
                {loading ? "Inscription..." : "S'inscrire"}
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
