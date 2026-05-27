import { useCallback, useRef } from 'react';

// Minimal wake-lock type (not in lib.dom for all TS versions).
interface WakeLockLike {
  release: () => Promise<void>;
}

// Keep the screen awake during a timed gym activity (WOD stopwatch, rest timer).
// No-op where the Screen Wake Lock API is unsupported.
export function useWakeLock() {
  const ref = useRef<WakeLockLike | null>(null);

  const acquire = useCallback(async () => {
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<WakeLockLike> } }).wakeLock;
      if (wl) ref.current = await wl.request('screen');
    } catch {
      /* unsupported or denied — ignore */
    }
  }, []);

  const release = useCallback(() => {
    ref.current?.release().catch(() => {});
    ref.current = null;
  }, []);

  return { acquire, release };
}
