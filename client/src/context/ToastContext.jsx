import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "../lib/utils";

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };
const TONES = {
  success: "text-success",
  error: "text-destructive",
  info: "text-info",
};

/** Notifications non bloquantes (remplacent window.alert). */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, description, variant = "success", duration = 4000 }) => {
      const id = ++nextId.current;
      setToasts((list) => [...list.slice(-3), { id, title, description, variant }]);
      if (duration) setTimeout(() => dismiss(id), duration);
      return id;
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map(({ id, title, description, variant }) => {
          const Icon = ICONS[variant] ?? Info;
          return (
            <div
              key={id}
              role={variant === "error" ? "alert" : "status"}
              className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[var(--radius-card)] border border-border bg-card p-4 shadow-[var(--shadow-card-hover)] animate-toast-in"
            >
              <Icon className={cn("mt-0.5 size-5 shrink-0", TONES[variant])} aria-hidden="true" />
              <div className="flex-1 text-sm">
                <p className="font-medium text-foreground">{title}</p>
                {description && <p className="mt-0.5 text-muted-foreground">{description}</p>}
              </div>
              <button
                type="button"
                onClick={() => dismiss(id)}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Fermer la notification"
              >
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used within a ToastProvider");
  return context;
};
