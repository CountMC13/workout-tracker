import { useCallback, useRef, useState } from 'react';
import { Trophy, Undo2 } from 'lucide-react';

interface ToastOptions {
  actionLabel?: string; // shows a button (e.g. "Undo")
  onAction?: () => void;
  durationMs?: number; // default 2400; undo toasts use ~5000
}

interface ToastState {
  msg: string;
  actionLabel?: string;
  onAction?: () => void;
}

// Tiny transient toast, used for the "PR!" moment, confirmations, and undo actions.
export function useToast() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | null>(null);

  const dismiss = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    setToast(null);
  }, []);

  const show = useCallback((m: string, opts?: ToastOptions) => {
    setToast({ msg: m, actionLabel: opts?.actionLabel, onAction: opts?.onAction });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setToast(null), opts?.durationMs ?? 2400);
  }, []);

  const hasAction = !!(toast?.actionLabel && toast.onAction);
  const node = toast ? (
    <div className="toast" role="status">
      {!hasAction && <Trophy size={18} />}
      <span>{toast.msg}</span>
      {hasAction && (
        <button
          className="toast-action"
          onClick={() => {
            toast!.onAction!();
            dismiss();
          }}
        >
          <Undo2 size={15} /> {toast!.actionLabel}
        </button>
      )}
    </div>
  ) : null;

  return { show, node };
}
