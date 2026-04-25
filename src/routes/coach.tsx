import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CoachBottomNav } from "@/components/CoachBottomNav";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/coach")({
  component: CoachLayout,
});

function CoachLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
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

      const role = (profile as { role?: string } | null)?.role;
      if (role === "admin") {
        navigate({ to: "/admin/coaches", replace: true });
        return;
      }
      if (role === "coach_pending") {
        navigate({ to: "/coach/pending", replace: true });
        return;
      }
      if (role !== "coach") {
        navigate({ to: "/home", replace: true });
        return;
      }
      if (location.pathname === "/coach") {
        navigate({ to: "/coach/dashboard", replace: true });
        return;
      }
      setReady(true);
    })();
  }, [navigate, location.pathname]);

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
