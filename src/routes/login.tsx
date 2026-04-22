import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Eye, EyeOff, Mail, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { data: signInData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    const userId = signInData.user?.id;
    if (userId) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .maybeSingle();

      if ((profile as { role?: string } | null)?.role === "coach") {
        navigate({ to: "/coach/dashboard", replace: true });
        return;
      }
    }

    navigate({ to: "/home", replace: true });
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 pt-12 pb-8">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col items-center gap-2 mb-10"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Brain className="h-9 w-9 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">CogniRaja</h1>
        <p className="text-sm text-muted-foreground">Connecte-toi pour continuer</p>
      </motion.div>

      <motion.form
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        onSubmit={handleLogin}
        className="flex flex-col gap-4"
      >
        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="email"
              type="email"
              placeholder="ton.email@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Mot de passe</Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Link
          to="/forgot-password"
          className="self-end text-sm font-medium text-primary"
        >
          Mot de passe oublié ?
        </Link>

        <Button type="submit" disabled={loading} className="mt-2 h-12 text-base font-semibold">
          {loading ? "Connexion..." : "Se connecter"}
        </Button>
      </motion.form>

      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Pas encore de compte ?{" "}
          <Link to="/register" className="font-semibold text-primary">
            S'inscrire
          </Link>
        </p>
      </div>
    </div>
  );
}
