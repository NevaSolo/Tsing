import { cn } from "../lib/utils";

const VIEWS = [
  { value: "front", label: "Face" },
  { value: "back", label: "Dos" },
];

/** Sélecteur Face / Dos (boutons radio accessibles au clavier). */
const ViewToggle = ({ value, onChange, className }) => (
  <div
    role="radiogroup"
    aria-label="Côté du t-shirt affiché"
    className={cn("inline-flex rounded-full border border-border bg-background/90 p-1 shadow-[var(--shadow-card)] backdrop-blur", className)}
  >
    {VIEWS.map((v) => (
      <button
        key={v.value}
        type="button"
        role="radio"
        aria-checked={value === v.value}
        onClick={() => onChange(v.value)}
        className={cn(
          "rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
          value === v.value ? "bg-brand text-white" : "text-muted-foreground hover:text-foreground"
        )}
      >
        {v.label}
      </button>
    ))}
  </div>
);

export default ViewToggle;
