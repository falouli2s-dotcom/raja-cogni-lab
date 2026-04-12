import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { User, LogOut, ChevronRight, Shield, Bell, Palette } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_app/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState<{ email?: string; prenom?: string; nom?: string } | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        setUser({
          email: authUser.email,
          prenom: authUser.user_metadata?.prenom,
          nom: authUser.user_metadata?.nom,
        });
      }
    });
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  }

  const menuItems = [
    { icon: User, label: "Informations personnelles", action: () => {} },
    { icon: Shield, label: "Sécurité", action: () => {} },
    { icon: Bell, label: "Notifications", action: () => {} },
    { icon: Palette, label: "Apparence", action: () => {} },
  ];

  return (
    <div className="px-5 pt-12 pb-4">
      <motion.div
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
      >
        <h1 className="text-2xl font-bold text-foreground">Profil</h1>
      </motion.div>

      {/* User info card */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="mt-6 flex items-center gap-4 rounded-2xl border border-border bg-card p-4"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <User className="h-7 w-7 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">
            {user?.prenom && user?.nom
              ? `${user.prenom} ${user.nom}`
              : "Joueur"}
          </p>
          <p className="text-sm text-muted-foreground">{user?.email || ""}</p>
        </div>
      </motion.div>

      {/* Menu */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="mt-6 flex flex-col rounded-2xl border border-border bg-card"
      >
        {menuItems.map((item, i) => {
          const Icon = item.icon;
          return (
            <button
              key={i}
              onClick={item.action}
              className={`flex items-center justify-between px-4 py-4 text-left transition-colors active:bg-muted ${
                i !== menuItems.length - 1 ? "border-b border-border" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{item.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          );
        })}
      </motion.div>

      {/* Logout */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="mt-6"
      >
        <Button
          variant="destructive"
          onClick={handleLogout}
          className="h-12 w-full text-base font-semibold"
        >
          <LogOut className="mr-2 h-5 w-5" /> Se déconnecter
        </Button>
      </motion.div>

      <p className="mt-8 text-center text-xs text-muted-foreground">
        CogniRaja v1.0 — Académie Raja Casablanca
      </p>
    </div>
  );
}
