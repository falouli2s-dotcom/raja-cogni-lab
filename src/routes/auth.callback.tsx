import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Brain, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function finalize() {
      // Wait for Supabase to process the OAuth tokens from the URL hash
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;

      if (!session) {
        // Try once more after a short delay (token exchange can be async)
        await new Promise((r) => setTimeout(r, 400));
        const retry = await supabase.auth.getSession();
        if (!retry.data.session) {
          if (!cancelled) navigate({ to: "/login", replace: true });
          return;
        }
      }

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        if (!cancelled) navigate({ to: "/login", replace: true });
        return;
      }

      // Read the role the user picked before the OAuth round-trip
      let intendedRole: "joueur" | "coach" | null = null;
      try {
        const stored = sessionStorage.getItem("cogniraja_intended_role");
        if (stored === "joueur" || stored === "coach") intendedRole = stored;
      } catch {
        // ignore
      }

      // Make sure the user metadata reflects the intended role so the
      // handle_new_user trigger picks it up on first creation. For existing
      // users we just patch metadata; the trigger only fires once.
      if (intendedRole) {
        const currentIntent = (user.user_metadata as Record<string, unknown> | null)?.intended_role;
        if (currentIntent !== intendedRole) {
          await supabase.auth.updateUser({
            data: { intended_role: intendedRole },
          });
        }
      }

      // Fetch the profile (created by the trigger). Retry briefly in case
      // the trigger has not finished yet.
      let profile: { role: string; birth_date: string | null } | null = null;
      for (let i = 0; i < 5; i++) {
        const { data } = await supabase
          .from("profiles")
          .select("role, birth_date")
          .eq("id", user.id)
          .maybeSingle();
        if (data) {
          profile = data as typeof profile;
          break;
        }
        await new Promise((r) => setTimeout(r, 300));
      }

      // If somehow the trigger never ran (existing user without profile),
      // create a minimal one based on the intended role.
      if (!profile) {
        const initialRole = intendedRole === "coach" ? "coach_pending" : "joueur";
        const fullName =
          (user.user_metadata?.full_name as string | undefined) ||
          (user.user_metadata?.name as string | undefined) ||
          null;
        await supabase.from("profiles").insert({
          id: user.id,
          full_name: fullName,
          role: initialRole,
        });
        profile = { role: initialRole, birth_date: null };
      }

      try {
        sessionStorage.removeItem("cogniraja_intended_role");
      } catch {
        // ignore
      }

      if (cancelled) return;

      // Coach pending → wait-room
      if (profile.role === "coach_pending") {
        navigate({ to: "/coach/pending", replace: true });
        return;
      }
      if (profile.role === "coach") {
        navigate({ to: "/coach/dashboard", replace: true });
        return;
      }
      if (profile.role === "admin") {
        navigate({ to: "/admin/coaches", replace: true });
        return;
      }

      // Joueur — needs birth_date to be considered complete
      if (!profile.birth_date) {
        navigate({ to: "/complete-profile", replace: true });
        return;
      }

      navigate({ to: "/home", replace: true });
    }

    finalize();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4 px-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
        <Brain className="h-9 w-9 text-primary-foreground" />
      </div>
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Connexion en cours…</span>
      </div>
    </div>
  );
}
