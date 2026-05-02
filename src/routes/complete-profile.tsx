import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Calendar, Loader2 } from "lucide-react";
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

export const Route = createFileRoute("/complete-profile")({
  component: CompleteProfilePage,
});

function CompleteProfilePage() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [dateNaissance, setDateNaissance] = useState("");
  const [poste, setPoste] = useState<PlayerPosition | "">("");
  const [category, setCategory] = useState<PlayerCategory | "">("");
  const [dominantFoot, setDominantFoot] = useState<DominantFoot | "">("");
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, full_name, birth_date, position, category, dominant_foot")
        .eq("id", session.user.id)
        .maybeSingle();

      const p = profile as {
        role: string;
        full_name: string | null;
        birth_date: string | null;
        position: PlayerPosition | null;
        category: PlayerCategory | null;
        dominant_foot: DominantFoot | null;
      } | null;

      if (!p) {
        navigate({ to: "/login", replace: true });
        return;
      }

      // If already complete (joueur with birth_date) → home
      if (p.role === "joueur" && p.birth_date) {
        navigate({ to: "/home", replace: true });
        return;
      }
      // Coach roles don't pass through here
      if (p.role === "coach") {
        navigate({ to: "/coach/dashboard", replace: true });
        return;
      }
      if (p.role === "coach_pending") {
        navigate({ to: "/coach/pending", replace: true });
        return;
      }

      setUserId(session.user.id);
      setRole(p.role);
      setFullName(p.full_name || "");
      setDateNaissance(p.birth_date || "");
      setPoste(p.position || "");
      setCategory(p.category || "");
      setDominantFoot(p.dominant_foot || "");
      setBootstrapping(false);
    })();
  }, [navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!userId) return;
    if (!fullName.trim()) {
      setError("Renseigne ton nom complet");
      return;
    }
    if (!dateNaissance) {
      setError("Renseigne ta date de naissance");
      return;
    }
    setLoading(true);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        birth_date: dateNaissance,
        position: (poste || null) as PlayerPosition | null,
        category: (category || null) as PlayerCategory | null,
        dominant_foot: (dominantFoot || null) as DominantFoot | null,
      })
      .eq("id", userId);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    toast.success("Profil complété");
    navigate({ to: "/home", replace: true });
  }

  if (bootstrapping) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
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
        <h1 className="text-2xl font-bold text-foreground">Complète ton profil</h1>
        <p className="text-sm text-muted-foreground text-center">
          Encore quelques infos pour personnaliser ton expérience
        </p>
      </motion.div>

      {error && (
        <div className="mb-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="space-y-2">
          <Label htmlFor="full-name">Nom complet</Label>
          <Input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="birth-date">Date de naissance</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="birth-date"
              type="date"
              value={dateNaissance}
              onChange={(e) => setDateNaissance(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        {role === "joueur" && (
          <>
            <div className="space-y-2">
              <Label>Catégorie</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as PlayerCategory)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une catégorie" />
                </SelectTrigger>
                <SelectContent>
                  {(["U13", "U14", "U15", "U16", "U17", "U18", "U21"] as const).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Poste</Label>
              <Select value={poste} onValueChange={(v) => setPoste(v as PlayerPosition)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un poste" />
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
              <Label>Pied dominant</Label>
              <Select value={dominantFoot} onValueChange={(v) => setDominantFoot(v as DominantFoot)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un pied" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Droit">Droit</SelectItem>
                  <SelectItem value="Gauche">Gauche</SelectItem>
                  <SelectItem value="Les deux">Les deux</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        <Button
          type="submit"
          disabled={loading}
          className="mt-4 h-12 text-base font-semibold"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enregistrement…
            </>
          ) : (
            "Continuer"
          )}
        </Button>
      </form>
    </div>
  );
}
