import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Clock, LogOut, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/coach/pending")({
  component: CoachPendingPage,
});

function CoachPendingPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

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

      const role = (profile as { role?: string } | null)?.role;
      if (role === "coach") {
        navigate({ to: "/coach/dashboard", replace: true });
        return;
      }
      if (role === "admin") {
        navigate({ to: "/admin/coaches", replace: true });
        return;
      }
      if (role === "joueur") {
        navigate({ to: "/home", replace: true });
        return;
      }
      if (role !== "coach_pending") {
        navigate({ to: "/login", replace: true });
        return;
      }
      setReady(true);
    })();
  }, [navigate]);

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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-6">
      <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-3xl border border-border bg-card p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Clock className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-foreground">Demande envoyée ✓</h1>
          <p className="text-sm text-muted-foreground">
            Votre compte coach est en cours de validation par l'administrateur.
            Vous serez notifié par email dès que votre accès sera activé.
          </p>
        </div>
        <Button onClick={handleLogout} variant="outline" className="w-full">
          <LogOut className="mr-2 h-4 w-4" />
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
