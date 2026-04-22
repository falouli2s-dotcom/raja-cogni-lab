import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/coach/joueurs")({
  component: CoachJoueurs,
});

function CoachJoueurs() {
  return (
    <div className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-6">
      <h1 className="text-2xl font-semibold text-foreground">Joueurs</h1>
    </div>
  );
}
