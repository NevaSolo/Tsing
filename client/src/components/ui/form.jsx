import { forwardRef, useId } from "react";
import { cn } from "../../lib/utils";

const controlBase =
  "w-full rounded-[var(--radius-control)] border border-input bg-background px-3 py-2 text-sm text-foreground " +
  "placeholder:text-muted-foreground transition-colors " +
  "focus-visible:outline-none focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand/20 " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive";

export const Label = ({ className, ...props }) => (
  <label className={cn("block text-sm font-medium text-foreground mb-1.5", className)} {...props} />
);

export const Input = forwardRef(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(controlBase, "h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = forwardRef(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(controlBase, "min-h-[88px]", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = forwardRef(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(controlBase, "h-10 pr-8", className)} {...props}>
    {children}
  </select>
));
Select.displayName = "Select";

/**
 * Champ complet : libellé relié au contrôle, aide et message d'erreur annoncé.
 * `children` reçoit les props d'accessibilité à appliquer au contrôle.
 */
export const Field = ({ label, hint, error, className, children }) => {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      {label && <Label htmlFor={id}>{label}</Label>}
      {children({ id, "aria-describedby": describedBy, "aria-invalid": error ? true : undefined })}
      {hint && !error && (
        <p id={hintId} className="mt-1 text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};

/** Curseur avec libellé et valeur affichée, relié pour les lecteurs d'écran. */
export const RangeField = ({ label, value, display, onChange, min, max, step = 1 }) => {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
        </label>
        <output htmlFor={id} className="text-xs tabular-nums text-muted-foreground">
          {display ?? value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full cursor-pointer"
      />
    </div>
  );
};
