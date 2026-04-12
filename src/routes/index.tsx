import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SplashScreen } from "@/components/SplashScreen";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: SplashPage,
});

function SplashPage() {
  const navigate = useNavigate();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(async () => {
      const session = await getSession();
      if (session) {
        navigate({ to: "/home", replace: true });
      } else {
        navigate({ to: "/login", replace: true });
      }
    }, 2500);
    return () => clearTimeout(timer);
  }, [navigate]);

  if (!show) return null;
  return <SplashScreen />;
}
