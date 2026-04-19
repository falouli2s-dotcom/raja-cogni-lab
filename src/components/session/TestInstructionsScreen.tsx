import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, ArrowUp, Languages, Target, ListOrdered, Lightbulb, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSession, SESSION_TESTS } from "@/lib/session-manager";
import { useLanguage, type Lang } from "@/lib/language-context";
import { INSTRUCTIONS } from "@/lib/instructions-content";

const WAIT_SECONDS = 5;

interface Props {
  onStart: () => void;
}

export function TestInstructionsScreen({ onStart }: Props) {
  const { getCurrentTest, currentTestIndex } = useSession();
  const { lang, setLang, dir } = useLanguage();
  const test = getCurrentTest();
  const [remaining, setRemaining] = useState(WAIT_SECONDS);
  const [countdown, setCountdown] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setRemaining(WAIT_SECONDS);
    const id = setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [currentTestIndex]);

  useEffect(() => {
    if (countdown === null) return;
    if (countdown === 0) {
      const t = setTimeout(() => onStart(), 600);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setCountdown(countdown - 1), 800);
    return () => clearTimeout(t);
  }, [countdown, onStart]);

  if (!test) return null;
  const content = INSTRUCTIONS[lang][test.id];
  const canStart = remaining === 0;

  const handleReread = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (countdown !== null) {
    return (
      <div
        dir={dir}
        className="fixed inset-0 z-50 flex items-center justify-center bg-[oklch(0.18_0.04_220)]"
        style={{ fontFamily: lang === "ar" ? "'Cairo', 'Tajawal', sans-serif" : undefined }}
      >
        <AnimatePresence mode="wait">
          <motion.div
            key={countdown}
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <p className="mb-4 text-sm uppercase tracking-widest text-white/60">
              {content.countdownLabel}
            </p>
            <p className="text-[160px] font-bold leading-none text-white">
              {countdown === 0 ? "GO" : countdown}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    );
  }

  return (
    <div
      dir={dir}
      ref={scrollRef}
      className="min-h-screen overflow-y-auto bg-[oklch(0.18_0.04_220)] text-white"
      style={{ fontFamily: lang === "ar" ? "'Cairo', 'Tajawal', sans-serif" : undefined }}
    >
      {/* Top bar */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/10 bg-[oklch(0.18_0.04_220)]/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-2 text-xs font-medium text-white/70">
          <span className="rounded-full bg-white/10 px-3 py-1">
            {content.progressLabel(currentTestIndex + 1, SESSION_TESTS.length)}
          </span>
        </div>
        <LanguageToggle lang={lang} onChange={setLang} />
      </div>

      <div className="mx-auto max-w-xl px-5 pb-32 pt-6">
        {/* Title */}
        <motion.div initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
          <p className="text-xs font-semibold uppercase tracking-widest text-[oklch(0.7_0.18_152)]">
            {content.subtitle}
          </p>
          <h1 className="mt-2 text-3xl font-bold">{content.title}</h1>
        </motion.div>

        {/* Objective */}
        <Section
          icon={<Target className="h-5 w-5" />}
          label={content.objectiveLabel}
          delay={0.1}
        >
          <p className="text-base leading-relaxed text-white/90">{content.objective}</p>
        </Section>

        {/* Simon-only diagram */}
        {test.id === "simon" && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mt-4 overflow-hidden rounded-2xl border border-white/10"
          >
            <div className="grid grid-cols-2 gap-1">
              <div className="flex h-28 items-center justify-center bg-[oklch(0.55_0.22_27)]">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 rounded-full bg-white/95" />
                  <p className="mt-2 text-xs font-bold uppercase tracking-wider text-white">
                    {lang === "ar" ? "يسار · أحمر" : "Gauche · Rouge"}
                  </p>
                </div>
              </div>
              <div className="flex h-28 items-center justify-center bg-[oklch(0.55_0.17_152)]">
                <div className="text-center">
                  <div className="mx-auto h-10 w-10 rounded-full bg-white/95" />
                  <p className="mt-2 text-xs font-bold uppercase tracking-wider text-white">
                    {lang === "ar" ? "يمين · أخضر" : "Droite · Vert"}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Steps */}
        <Section
          icon={<ListOrdered className="h-5 w-5" />}
          label={content.instructionsLabel}
          delay={0.2}
        >
          <ol className="flex flex-col gap-3">
            {content.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[oklch(0.7_0.18_152)] text-sm font-bold text-[oklch(0.18_0.04_220)]">
                  {i + 1}
                </span>
                <p className="pt-0.5 text-sm leading-relaxed text-white/90">{step}</p>
              </li>
            ))}
          </ol>
        </Section>

        {/* Example */}
        <Section
          icon={<Lightbulb className="h-5 w-5" />}
          label={content.exampleLabel}
          delay={0.3}
        >
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            {content.example.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed text-white/90">
                {line}
              </p>
            ))}
          </div>
        </Section>

        {/* Duration */}
        <Section icon={<Clock className="h-5 w-5" />} label={content.durationLabel} delay={0.4}>
          <p className="text-sm text-white/90">{content.duration}</p>
        </Section>

        {/* Reread */}
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          onClick={handleReread}
          className="mt-6 inline-flex items-center gap-2 text-sm font-medium text-white/70 underline-offset-4 hover:underline"
        >
          <ArrowUp className="h-4 w-4" />
          {content.rereadButton}
        </motion.button>
      </div>

      {/* Sticky CTA */}
      <div
        dir={dir}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-[oklch(0.16_0.04_220)]/95 px-5 py-4 backdrop-blur safe-area-bottom"
      >
        <div className="mx-auto max-w-xl">
          <Button
            onClick={() => setCountdown(3)}
            disabled={!canStart}
            className="h-14 w-full bg-[oklch(0.7_0.18_152)] text-base font-semibold text-[oklch(0.18_0.04_220)] hover:bg-[oklch(0.75_0.18_152)] disabled:opacity-60"
            size="lg"
          >
            <Play className="h-5 w-5" />
            {canStart ? content.startButton : content.waitHint(remaining)}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Section({
  icon,
  label,
  delay,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  delay: number;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={{ y: 12, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay }}
      className="mt-6"
    >
      <div className="mb-2 flex items-center gap-2 text-[oklch(0.7_0.18_152)]">
        {icon}
        <h2 className="text-xs font-bold uppercase tracking-widest">{label}</h2>
      </div>
      {children}
    </motion.section>
  );
}

function LanguageToggle({ lang, onChange }: { lang: Lang; onChange: (l: Lang) => void }) {
  return (
    <div className="flex items-center gap-1 rounded-full border border-white/15 bg-white/5 p-1">
      <Languages className="ms-2 h-3.5 w-3.5 text-white/60" />
      <button
        onClick={() => onChange("fr")}
        className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
          lang === "fr" ? "bg-white text-[oklch(0.18_0.04_220)]" : "text-white/70"
        }`}
      >
        FR
      </button>
      <button
        onClick={() => onChange("ar")}
        className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
          lang === "ar" ? "bg-white text-[oklch(0.18_0.04_220)]" : "text-white/70"
        }`}
        style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}
      >
        AR
      </button>
    </div>
  );
}
