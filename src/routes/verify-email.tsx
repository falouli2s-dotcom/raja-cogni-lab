import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, Mail, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

export const Route = createFileRoute("/verify-email")({
  component: VerifyEmailPage,
  validateSearch: (search: Record<string, unknown>) => ({
    email: (search.email as string) || "",
  }),
});

function VerifyEmailPage() {
  const navigate = useNavigate();
  const { email } = Route.useSearch();
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  async function handleVerify() {
    if (otp.length !== 6) return;
    setLoading(true);
    setError("");

    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: "email",
    });

    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }

    navigate({ to: "/home", replace: true });
  }

  async function handleResend() {
    if (resendCooldown > 0) return;
    setError("");

    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });

    if (resendError) {
      setError(resendError.message);
      return;
    }

    setResendCooldown(60);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 pt-12 pb-8">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex flex-col items-center gap-2 mb-8"
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary">
          <Brain className="h-9 w-9 text-primary-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Vérifie ton email</h1>
      </motion.div>

      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="flex flex-col items-center gap-6"
      >
        <div className="flex items-center gap-2 rounded-lg bg-muted px-4 py-3">
          <Mail className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Code envoyé à <span className="font-semibold text-foreground">{email}</span>
          </p>
        </div>

        <p className="text-sm text-center text-muted-foreground">
          Saisis le code à 6 chiffres reçu par email
        </p>

        {error && (
          <div className="w-full rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <InputOTP maxLength={6} value={otp} onChange={setOtp}>
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>

        <Button
          onClick={handleVerify}
          disabled={loading || otp.length !== 6}
          className="w-full h-12 text-base font-semibold"
        >
          {loading ? "Vérification..." : "Vérifier"}
        </Button>

        <button
          onClick={handleResend}
          disabled={resendCooldown > 0}
          className="text-sm text-primary font-medium disabled:text-muted-foreground"
        >
          {resendCooldown > 0
            ? `Renvoyer le code dans ${resendCooldown}s`
            : "Renvoyer le code"}
        </button>

        <button
          onClick={() => navigate({ to: "/register" })}
          className="flex items-center gap-1 text-sm text-muted-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Retour à l'inscription
        </button>
      </motion.div>
    </div>
  );
}
