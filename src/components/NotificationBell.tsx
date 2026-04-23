import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Notification = {
  id: string;
  type: "invitation_coach" | "session_planifiee" | "session_completee";
  title: string;
  message: string;
  is_read: boolean;
  metadata: Record<string, any>;
  created_at: string;
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `il y a ${d}j`;
  return new Date(iso).toLocaleDateString("fr-FR");
}

const TYPE_ICON: Record<Notification["type"], string> = {
  invitation_coach: "🤝",
  session_planifiee: "🗓️",
  session_completee: "✅",
};

type InvitationStatus = "pending" | "accepted" | "declined";

export function NotificationBell() {
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [activeInvitationId, setActiveInvitationId] = useState<string | null>(null);
  const [activeCoachName, setActiveCoachName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [invitationStatuses, setInvitationStatuses] = useState<Record<string, InvitationStatus>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  async function load() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await (supabase as any)
      .from("notifications")
      .select("id, type, title, message, is_read, metadata, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const list = (data ?? []) as Notification[];
    setItems(list);
    await refreshInvitationStatuses(list);
  }

  async function refreshInvitationStatuses(list: Notification[]) {
    const ids = list
      .filter((n) => n.type === "invitation_coach" && n.metadata?.coach_players_id)
      .map((n) => n.metadata.coach_players_id as string);
    if (ids.length === 0) {
      setInvitationStatuses({});
      return;
    }
    const { data } = await (supabase as any)
      .from("coach_players")
      .select("id, status")
      .in("id", ids);
    const map: Record<string, InvitationStatus> = {};
    (data ?? []).forEach((r: any) => {
      map[r.id] = r.status as InvitationStatus;
    });
    setInvitationStatuses(map);
  }

  useEffect(() => {
    load();
  }, []);

  // Re-check invitation statuses each time the panel opens
  useEffect(() => {
    if (open) refreshInvitationStatuses(items);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Click outside to close
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const unreadCount = items.filter((n) => !n.is_read).length;

  async function markRead(id: string) {
    await (supabase as any).from("notifications").update({ is_read: true }).eq("id", id);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  }

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await (supabase as any)
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    setItems((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  async function handleClick(n: Notification) {
    if (n.type === "invitation_coach") {
      const cpId = n.metadata?.coach_players_id as string | undefined;
      const status = cpId ? invitationStatuses[cpId] : undefined;
      // Already processed → ignore click
      if (status && status !== "pending") return;
      await markRead(n.id);
      setActiveInvitationId(cpId ?? null);
      setActiveCoachName(n.metadata?.coach_name ?? null);
      return;
    }
    await markRead(n.id);
    if (n.type === "session_planifiee") {
      setOpen(false);
      navigate({ to: "/tests" });
    } else if (n.type === "session_completee") {
      setOpen(false);
      navigate({ to: "/sessions" });
    }
  }

  async function respondInvitation(status: "accepted" | "declined") {
    if (!activeInvitationId) return;
    setBusy(true);
    const { error } = await (supabase as any)
      .from("coach_players")
      .update({ status })
      .eq("id", activeInvitationId);
    setBusy(false);
    if (error) {
      toast.error("Action impossible");
      return;
    }
    if (status === "accepted") {
      toast.success("✓ Invitation acceptée", {
        style: { background: "rgb(16 185 129)", color: "white", border: "none" },
      });
    } else {
      toast.error("✗ Invitation refusée", {
        style: { background: "rgb(244 63 94)", color: "white", border: "none" },
      });
    }
    setInvitationStatuses((prev) => ({ ...prev, [activeInvitationId]: status }));
    setActiveInvitationId(null);
    setActiveCoachName(null);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className="relative flex h-10 w-10 items-center justify-center rounded-full bg-card transition-colors active:bg-muted"
      >
        <Bell className="h-5 w-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            className="absolute right-0 top-12 z-50 w-[min(20rem,90vw)] overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Notifications</p>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] font-semibold text-primary hover:underline"
                >
                  Tout marquer comme lu
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  Aucune notification pour l'instant
                </p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => handleClick(n)}
                    className={`flex w-full items-start gap-3 border-b border-border/50 px-4 py-3 text-left transition-colors hover:bg-muted/40 ${
                      n.is_read ? "" : "bg-primary/5"
                    }`}
                  >
                    <span className="text-xl leading-none">{TYPE_ICON[n.type]}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">{n.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                      <p className="mt-1 text-[10px] text-muted-foreground/70">
                        {timeAgo(n.created_at)}
                      </p>
                    </div>
                    {!n.is_read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Invitation modal */}
      <AnimatePresence>
        {activeInvitationId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-5"
            onClick={() => setActiveInvitationId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-border bg-card p-5"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/20 text-lg">
                  🤝
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">Invitation d'un coach</p>
                  <p className="text-xs text-muted-foreground">
                    Coach {activeCoachName ?? "anonyme"}
                  </p>
                </div>
              </div>
              <p className="mb-4 text-sm text-foreground">
                Le coach <span className="font-semibold">{activeCoachName ?? "anonyme"}</span>{" "}
                vous invite à rejoindre son équipe.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => respondInvitation("accepted")}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition active:scale-95 disabled:opacity-50"
                >
                  <Check className="h-4 w-4" /> Accepter
                </button>
                <button
                  onClick={() => respondInvitation("declined")}
                  disabled={busy}
                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-border bg-background px-3 py-2 text-sm font-semibold text-foreground transition active:scale-95 disabled:opacity-50"
                >
                  <X className="h-4 w-4" /> Décliner
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
