import { useEffect } from "react";

/**
 * Keeps the screen awake while mounted using the Screen Wake Lock API.
 * Re-acquires the lock automatically when the tab regains visibility
 * (the browser releases it when the page is hidden).
 * Silently no-ops on browsers without support (e.g. older iOS).
 */
export function useWakeLock(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    if (!nav.wakeLock) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        const lock = await nav.wakeLock!.request("screen");
        if (cancelled) {
          lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        sentinel.addEventListener("release", () => {
          sentinel = null;
        });
      } catch {
        /* user gesture required or denied — ignore */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinel) {
        acquire();
      }
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (sentinel) {
        sentinel.release().catch(() => {});
        sentinel = null;
      }
    };
  }, [active]);
}

interface WakeLockSentinel extends EventTarget {
  release: () => Promise<void>;
}
