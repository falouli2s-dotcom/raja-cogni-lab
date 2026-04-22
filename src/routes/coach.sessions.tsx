import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/coach/sessions")({
  component: CoachSessions,
});

function CoachSessions() {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6">
      <h1 className="text-2xl font-semibold text-foreground">Sessions</h1>
    </div>
  );
}
