import { createFileRoute, Outlet } from "@tanstack/react-router";
import { CoachBottomNav } from "@/components/CoachBottomNav";

export const Route = createFileRoute("/coach")({
  component: CoachLayout,
});

function CoachLayout() {
  return (
    <div className="min-h-screen bg-background pb-20">
      <Outlet />
      <CoachBottomNav />
    </div>
  );
}
