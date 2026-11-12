import { cn } from "../lib/utils";
import { RangeField } from "../components/ui/form";
import { TRIM_PARTS, TRIM_STYLES, TRIM_WIDTH_RANGE } from "./utils/trims";

const ColorInput = ({ label, value, onChange }) => (
  <label className="flex items-center gap-2 text-sm">
    <input
      type="color"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-12 cursor-pointer rounded-[var(--radius-control)] border border-input bg-background p-1"
    />
    {label}
  </label>
);

/**
 * Bordures du t-shirt : parties (col, manches, bas), style, couleurs, largeur.
 * `trim` : calque bordure courant ou null. `onChange(patch)` le crée/modifie ; `onRemove()` le retire.
 */
const TrimEditor = ({ trim, onChange, onRemove }) => {
  const parts = trim?.parts ?? [];
  const toggle = (id, on) => {
    const next = on ? [...parts, id] : parts.filter((p) => p !== id);
    if (!next.length) onRemove();
    else onChange({ parts: next });
  };

  return (
    <section aria-label="Bordures du t-shirt" className="space-y-3">
      <h3 className="text-sm font-medium">Bordures du t-shirt</h3>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Parties à border">
        {TRIM_PARTS.map((p) => {
          const on = parts.includes(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(p.id, !on)}
              className={cn(
                "rounded-full border px-3 py-1 text-sm transition-colors",
                on ? "border-brand bg-brand text-white" : "border-input hover:border-brand"
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      {trim ? (
        <>
          <div role="radiogroup" aria-label="Style de bordure" className="flex flex-wrap gap-1.5">
            {TRIM_STYLES.map((s) => (
              <button
                key={s.id}
                type="button"
                role="radio"
                aria-checked={trim.style === s.id}
                onClick={() => onChange({ style: s.id })}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  trim.style === s.id ? "border-brand bg-brand-soft text-brand-ink" : "border-input hover:border-brand"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-4">
            <ColorInput label="Couleur" value={trim.color} onChange={(color) => onChange({ color })} />
            {trim.style !== "solid" && <ColorInput label="2e couleur" value={trim.color2 ?? "#ffffff"} onChange={(color2) => onChange({ color2 })} />}
          </div>
          <RangeField
            label="Largeur (manches et bas)"
            value={trim.width}
            display={`${trim.width} px`}
            min={TRIM_WIDTH_RANGE[0]}
            max={TRIM_WIDTH_RANGE[1]}
            onChange={(width) => onChange({ width })}
          />
        </>
      ) : (
        <p className="text-xs text-muted-foreground">Choisissez les parties à border : col, manches et/ou bas du t-shirt.</p>
      )}
    </section>
  );
};

export default TrimEditor;
