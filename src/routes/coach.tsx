import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CoachBottomNav } from "@/components/CoachBottomNav";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/coach")({
  component: CoachLayout,
});

function CoachLayout() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      // Server-verified identity
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error || !user) {
        navigate({ to: "/login", replace: true });
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();

      if ((profile as { role?: string } | null)?.role !== "coach") {
        navigate({ to: "/home", replace: true });
        return;
      }
      setReady(true);
    })();
  }, [navigate]);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <Outlet />
      <CoachBottomNav />
    </div>
  );
}
