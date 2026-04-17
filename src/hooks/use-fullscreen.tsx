import { useCallback, useEffect, useState } from "react";

/**
 * Manages fullscreen mode for a test session.
 * - Auto-enters fullscreen on mount (best effort, ignores rejection).
 * - Exits fullscreen on unmount.
 * - Returns a `requestFullscreen` callback for manual re-trigger.
 * - `supported` is false on browsers without the API (e.g. iOS Safari) — UI can hide the indicator.
 */
export function useFullscreen() {
  const [supported, setSupported] = useState(false);

  const request = useCallback(() => {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    try {
      if (el.requestFullscreen) {
        el.requestFullscreen().catch(() => {});
      } else if (el.webkitRequestFullscreen) {
        el.webkitRequestFullscreen();
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    const el = document.documentElement as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void>;
    };
    const isSupported = !!(el.requestFullscreen || el.webkitRequestFullscreen);
    setSupported(isSupported);
    if (!isSupported) return;

    try {
      el.requestFullscreen?.().catch(() => {});
    } catch {
      /* ignore */
    }

    return () => {
      const docAny = document as Document & {
        webkitFullscreenElement?: Element | null;
        webkitExitFullscreen?: () => Promise<void>;
      };
      try {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if (docAny.webkitFullscreenElement && docAny.webkitExitFullscreen) {
          docAny.webkitExitFullscreen();
        }
      } catch {
        /* ignore */
      }
    };
  }, []);

  return { supported, request };
}
