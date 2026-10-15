import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { SplashScreen } from "@/components/SplashScreen";
import { getSession } from "@/lib/auth";

export const Route = createFileRoute("/")({
  component: SplashPage,
  head: () => ({
    meta: [
      { title: "Percivo — Cognitive Assessments App" },
      {
        name: "description",
        content:
          "Percivo is a cognitive assessments app — Simon Task, N-Back and Trail Making Test — with a global cognitive score and personalized recommendations.",
      },
      { property: "og:title", content: "Percivo — Cognitive Assessments App" },
      {
        property: "og:description",
        content:
          "Percivo is a cognitive assessments app — Simon Task, N-Back and Trail Making Test — with a global cognitive score and personalized recommendations.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://percivo.lovable.app/" },
      { property: "og:site_name", content: "Percivo" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "Percivo — Cognitive Assessments App" },
      {
        name: "twitter:description",
        content:
          "Percivo is a cognitive assessments app — Simon Task, N-Back and Trail Making Test — with a global cognitive score and personalized recommendations.",
      },
    ],
    links: [{ rel: "canonical", href: "https://percivo.lovable.app/" }],
  }),
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
