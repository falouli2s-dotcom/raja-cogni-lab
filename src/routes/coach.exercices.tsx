import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronRight,
  X,
  Timer,
  Brain,
  Target,
  Dumbbell,
  Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export const Route = createFileRoute("/coach/exercices")({
  component: CoachExercices,
});

type Exercice = {
  id: string;
  numero: number;
  titre: string;
  niveau: string;
  indicateur_cognitif: string;
  materiel: string | null;
  objectif_cognitif: string;
  duree_serie: string;
  tache_motrice: string;
  series: number;
  recuperation_secondes: number;
  source_scientifique: string | null;
  alignement_test_digital: string;
};

type Player = { id: string; full_name: string | null };

const INDICATEURS = [
  "Tous",
  "Flexibilité cognitive",
  "Mémoire de travail",
  "Contrôle inhibiteur",
  "Attention sélective",
  "Temps de réaction",
  "Anticipation perceptuelle",
] as const;

const NIVEAUX = ["Débutant", "Intermédiaire", "Avancé"] as const;

function niveauColor(niveau: string) {
  if (niveau === "Débutant")
    return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  if (niveau === "Intermédiaire")
    return "bg-amber-500/15 text-amber-400 border-amber-500/20";
  return "bg-rose-500/15 text-rose-400 border-rose-500/20";
}

function padNum(n: number) {
  return String(n).padStart(2, "0");
}

function CoachExercices() {
  const [coachId, setCoachId] = useState<string | null>(null);
  const [exercices, setExercices] = useState<Exercice[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [activeIndicateur, setActiveIndicateur] = useState<string>("Tous");
  const [activeNiveaux, setActiveNiveaux] = useState<Set<string>>(new Set());

  // Modal
  const [selected, setSelected] = useState<Exercice | null>(null);
  const [assignPlayer, setAssignPlayer] = useState("");
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setCoachId(user.id);

      const [{ data: exData }, { data: rels }] = await Promise.all([
        (supabase as any)
          .from("exercices")
          .select("*")
          .order("numero", { ascending: true }),
        (supabase as any)
          .from("coach_players")
          .select("player_id")
          .eq("coach_id", user.id)
          .eq("status", "accepted"),
      ]);

      setExercices((exData ?? []) as Exercice[]);

      const ids = ((rels ?? []) as { player_id: string }[]).map(
        (r) => r.player_id
      );
      if (ids.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", ids);
        setPlayers(
          (profs ?? []).map((p: any) => ({
            id: p.id,
            full_name: p.full_name,
          }))
        );
      }
      setLoading(false);
    })();
  }, []);

  function toggleNiveau(n: string) {
    setActiveNiveaux((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });
  }

  const filtered = exercices.filter((ex) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      ex.titre.toLowerCase().includes(q) ||
      ex.indicateur_cognitif.toLowerCase().includes(q);
    const matchIndicateur =
      activeIndicateur === "Tous" ||
      ex.indicateur_cognitif
        .toLowerCase()
        .includes(activeIndicateur.toLowerCase());
    const matchNiveau =
      activeNiveaux.size === 0 || activeNiveaux.has(ex.niveau);
    return matchSearch && matchIndicateur && matchNiveau;
  });

  async function handleAssign() {
    if (!coachId || !selected || !assignPlayer) return;
    setAssigning(true);
    try {
      const { error } = await (supabase as any)
        .from("sessions_planifiees")
        .insert({
          coach_id: coachId,
          player_id: assignPlayer,
          session_category: "exercices",
          exercice_ids: [selected.id],
          scheduled_at: new Date().toISOString(),
          status: "pending",
        });
      if (error) throw error;
      toast.success("Exercice assigné ✓");
      setSelected(null);
      setAssignPlayer("");
    } catch (err: any) {
      toast.error(err?.message ?? "Erreur lors de l'assignation");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="px-5 pt-12 pb-24">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">
          Espace Coach
        </p>
        <h1 className="text-2xl font-bold text-foreground">Exercices</h1>
      </header>

      {/* Search */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="relative mb-4"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher un exercice..."
          className="pl-9"
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </motion.div>

      {/* Indicateur filter chips */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.05 }}
        className="mb-3 flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
      >
        {INDICATEURS.map((ind) => (
          <button
            key={ind}
            onClick={() => setActiveIndicateur(ind)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              activeIndicateur === ind
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:text-foreground"
            }`}
          >
            {ind}
          </button>
        ))}
      </motion.div>

      {/* Niveau toggles */}
      <motion.div
        initial={{ y: 8, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mb-5 flex gap-2"
      >
        {NIVEAUX.map((n) => (
          <button
            key={n}
            onClick={() => toggleNiveau(n)}
            className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-colors ${
              activeNiveaux.has(n)
                ? niveauColor(n)
                : "border-border bg-card text-muted-foreground"
            }`}
          >
            {n}
          </button>
        ))}
      </motion.div>

      {/* Count */}
      <p className="mb-3 text-xs text-muted-foreground">
        {filtered.length} exercice{filtered.length !== 1 ? "s" : ""}
      </p>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <Brain className="mx-auto mb-2 h-7 w-7 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Aucun exercice trouvé
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((ex, i) => (
            <motion.button
              key={ex.id}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.05 * Math.min(i, 10) }}
              onClick={() => {
                setSelected(ex);
                setAssignPlayer("");
              }}
              className="flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors active:bg-muted/50"
            >
              {/* Number */}
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <span className="text-sm font-bold text-primary">
                  #{padNum(ex.numero)}
                </span>
              </div>
              {/* Info */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-foreground">
                  {ex.titre}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    {ex.indicateur_cognitif}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${niveauColor(ex.niveau)}`}
                  >
                    {ex.niveau}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  <span>{ex.duree_serie}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </motion.button>
          ))}
        </div>
      )}

      {/* Detail modal / bottom sheet */}
      <AnimatePresence>
        {selected && (
          <>
            {/* Backdrop */}
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelected(null)}
              className="fixed inset-0 z-40 bg-black/60"
            />
            {/* Sheet */}
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-border bg-card p-6 pb-10"
            >
              {/* Handle */}
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted" />

              {/* Header */}
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <span className="text-base font-bold text-primary">
                      #{padNum(selected.numero)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-foreground">
                      {selected.titre}
                    </h2>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                        {selected.indicateur_cognitif}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${niveauColor(selected.niveau)}`}
                      >
                        {selected.niveau}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setSelected(null)}
                  className="mt-1 rounded-full p-1 text-muted-foreground hover:bg-muted"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Details rows */}
              <div className="flex flex-col gap-3">
                <DetailRow
                  icon={<Target className="h-4 w-4 text-primary" />}
                  label="Objectif cognitif"
                  value={selected.objectif_cognitif}
                />
                <DetailRow
                  icon={<Dumbbell className="h-4 w-4 text-primary" />}
                  label="Tâche motrice"
                  value={selected.tache_motrice}
                />
                <DetailRow
                  icon={<Timer className="h-4 w-4 text-primary" />}
                  label="Durée / Séries"
                  value={`${selected.duree_serie} — ${selected.series} série${selected.series !== 1 ? "s" : ""} · récup. ${selected.recuperation_secondes}s`}
                />
                {selected.materiel && (
                  <DetailRow
                    icon={<Brain className="h-4 w-4 text-primary" />}
                    label="Matériel"
                    value={selected.materiel}
                  />
                )}
                {selected.source_scientifique && (
                  <DetailRow
                    icon={<Brain className="h-4 w-4 text-primary" />}
                    label="Source"
                    value={selected.source_scientifique}
                  />
                )}
              </div>

              {/* Assign section */}
              <div className="mt-6">
                <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                  <Users className="h-4 w-4" /> Assigner à un joueur
                </p>
                {players.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Aucun joueur accepté dans votre équipe.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Select
                      value={assignPlayer}
                      onValueChange={setAssignPlayer}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Choisir un joueur" />
                      </SelectTrigger>
                      <SelectContent>
                        {players.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name ?? "Joueur sans nom"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      onClick={handleAssign}
                      disabled={!assignPlayer || assigning}
                    >
                      {assigning ? "..." : "Assigner"}
                    </Button>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-background p-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 text-sm text-foreground">{value}</p>
      </div>
    </div>
  );
}
