import { Link, useLocation } from "@tanstack/react-router";
import { Home, Brain, Dumbbell, User, TrendingUp } from "lucide-react";

const tabs = [
  { to: "/home", label: "Accueil", icon: Home },
  { to: "/tests", label: "Tests", icon: Brain },
  { to: "/history", label: "Historique", icon: TrendingUp },
  { to: "/exercises", label: "Exercices", icon: Dumbbell },
  { to: "/profile", label: "Profil", icon: User },
] as const;

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md safe-area-bottom">
      <div className="mx-auto flex max-w-lg items-center justify-around px-2 py-1">
        {tabs.map((tab) => {
          const isActive = location.pathname.startsWith(tab.to);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.to}
              to={tab.to}
              className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg px-2 py-2 text-xs font-medium transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon
                className={`h-5 w-5 transition-all ${
                  isActive ? "scale-110" : ""
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
