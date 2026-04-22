import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dumbbell, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Invitation = {
  id: string;
  coach_id: string;
  coachName: string | null;
};

export function CoachInvitations() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase as any)
        .from("coach_players")
        .select("id, coach_id")
        .eq("player_id", user.id)
        .eq("status", "pending");

      if (error || !data) return;

      const coachIds = data.map((d: any) => d.coach_id);
      let nameMap = new Map<string, string | null>();
      if (coachIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", coachIds);
        nameMap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
      }

      setInvitations(
        data.map((d: any) => ({
          id: d.id,
          coach_id: d.coach_id,
          coachName: nameMap.get(d.coach_id) ?? null,
        }))
      );
    })();
  }, []);

  async function respond(id: string, status: "accepted" | "declined") {
    setBusy(id);
    const { error } = await (supabase as any)
      .from("coach_players")
      .update({ status })
      .eq("id", id);
    setBusy(null);
    if (error) {
      toast.error("Action impossible");
      return;
    }
    toast.success(status === "accepted" ? "Invitation acceptée ✓" : "Invitation déclinée");
    setInvitations((prev) => prev.filter((i) => i.id !== id));
  }

  if (invitations.length === 0) return null;

  return (
    <motion.section
      initial={{ y: -10, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="mb-5"
    >
      <p className="mb-2 text-sm font-semibold text-foreground">Invitations</p>
      <div className="flex flex-col gap-2">
        <AnimatePresence>
          {invitations.map((inv) => (
            <motion.div
              key={inv.id}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20, height: 0, marginBottom: 0 }}
              className="overflow-hidden rounded-2xl border border-accent/30 bg-accent/10 p-4"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-lg">
                  🏋️
                  <Dumbbell className="hidden" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-foreground">
                    Le coach{" "}
                    <span className="font-semibold">
                      {inv.coachName ?? "anonyme"}
                    </span>{" "}
                    vous invite à rejoindre son équipe
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => respond(inv.id, "accepted")}
                      disabled={busy === inv.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition active:scale-95 disabled:opacity-50"
                    >
                      <Check className="h-3.5 w-3.5" /> Accepter
                    </button>
                    <button
                      onClick={() => respond(inv.id, "declined")}
                      disabled={busy === inv.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition active:scale-95 disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" /> Décliner
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
