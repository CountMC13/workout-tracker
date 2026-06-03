import { useCallback, useEffect, useRef } from 'react';

// Minimal wake-lock type (not in lib.dom for all TS versions).
interface WakeLockLike {
  release: () => Promise<void>;
  addEventListener?: (type: 'release', listener: () => void) => void;
}

// Keep the screen awake during a timed gym activity (WOD stopwatch, rest timer).
// No-op where the Screen Wake Lock API is unsupported.
//
// The browser automatically releases the lock whenever the page is hidden (the
// user switches apps, the screen auto-locks, the notification shade opens), so
// we re-acquire it on visibilitychange while the activity is still wanted.
export function useWakeLock() {
  const ref = useRef<WakeLockLike | null>(null);
  const wanted = useRef(false);

  const request = useCallback(async () => {
    if (ref.current || document.visibilityState !== 'visible') return;
    try {
      const wl = (navigator as unknown as { wakeLock?: { request: (t: string) => Promise<WakeLockLike> } }).wakeLock;
      if (wl) {
        const lock = await wl.request('screen');
        // The lock can be dropped by the browser at any time; forget it so the
        // next re-acquire attempt actually requests a fresh one.
        lock.addEventListener?.('release', () => {
          if (ref.current === lock) ref.current = null;
        });
        ref.current = lock;
      }
    } catch {
      /* unsupported or denied — ignore */
    }
  }, []);

  const acquire = useCallback(async () => {
    wanted.current = true;
    await request();
  }, [request]);

  const release = useCallback(() => {
    wanted.current = false;
    ref.current?.release().catch(() => {});
    ref.current = null;
  }, []);

  useEffect(() => {
    const onVisible = () => {
      if (wanted.current && document.visibilityState === 'visible') void request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [request]);

  return { acquire, release };
}
