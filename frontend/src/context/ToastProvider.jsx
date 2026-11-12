import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { ToastContext } from "./contexts";

const STYLES = {
  success: { box: "border-ink bg-ink text-paper", Icon: CheckCircle2 },
  error: { box: "border-danger/25 bg-paper text-danger", Icon: AlertCircle },
  info: { box: "border-line bg-paper text-ink", Icon: Info },
};

let nextId = 1;

/** Small success/error notifications in the bottom-right corner. */
export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message, type = "info") => {
      const id = nextId++;
      setToasts((current) => [...current, { id, message, type }]);
      setTimeout(() => dismiss(id), type === "error" ? 7000 : 3500);
    },
    [dismiss]
  );

  const value = useMemo(
    () => ({
      success: (message) => show(message, "success"),
      error: (message) => show(message, "error"),
      info: (message) => show(message, "info"),
    }),
    [show]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6"
      >
        {toasts.map((toast) => {
          const { box, Icon } = STYLES[toast.type];
          return (
          <div
            key={toast.id}
            role={toast.type === "error" ? "alert" : "status"}
            className={`pointer-events-auto flex w-full max-w-sm animate-pop-in items-start gap-3 rounded-lg border px-4 py-3 text-sm shadow-lg ${box}`}
          >
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="flex-1">{toast.message}</p>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="text-current opacity-60 hover:opacity-100"
              aria-label="Dismiss notification"
            >
              <X className="size-4" />
            </button>
          </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
