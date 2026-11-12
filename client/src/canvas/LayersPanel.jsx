import { useEffect, useRef } from "react";
import { Copy, Frame, Layers, Mountain, PenLine, RefreshCw, Shapes, Trash2, Type } from "lucide-react";
import TrimEditor from "./TrimEditor";
import { cn } from "../lib/utils";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/feedback";
import { Field, Input, RangeField, Select } from "../components/ui/form";
import font from "./utils/font";
import { newLayerId, SHAPES, translateLayer } from "./utils/layers";
import { EFFECTS, MAX_EFFECTS, motifInfo } from "../studio/motifs";

const TYPE_ICON = { path: PenLine, shape: Shapes, text: Type, motif: Mountain, trim: Frame };

const layerName = (layer) => {
  if (layer.type === "text") return `« ${layer.text || "Texte"} »`;
  if (layer.type === "shape") return SHAPES.find((s) => s.id === layer.shape)?.label ?? "Forme";
  if (layer.type === "motif") return motifInfo(layer.motif)?.label ?? "Motif";
  if (layer.type === "trim") return "Bordures";
  return `Trait (${layer.points.length} pts)`;
};

const LayerRow = ({ layer, selected, onSelect, onRemove }) => {
  const Icon = TYPE_ICON[layer.type];
  return (
    <li
      className={cn(
        "flex items-center gap-2 rounded-[var(--radius-control)] border px-2 py-1.5",
        selected ? "border-brand bg-brand-soft" : "border-border"
      )}
    >
      <button type="button" onClick={onSelect} aria-pressed={selected} className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm">
        <span className="size-4 shrink-0 rounded-full border border-border" style={{ backgroundColor: layer.color }} aria-hidden="true" />
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="truncate">{layerName(layer)}</span>
      </button>
      <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-destructive" onClick={onRemove} aria-label={`Supprimer ${layerName(layer)}`}>
        <Trash2 />
      </Button>
    </li>
  );
};

/** Onglet « Calques » : liste des éléments ajoutés et propriétés de l'élément sélectionné. */
const LayersPanel = ({ editor, focusTextOf, onFocused }) => {
  const { layers, selectedId, setSelectedId, updateLayer, removeLayer, commit } = editor;
  const selected = layers.find((l) => l.id === selectedId);
  const textInputRef = useRef(null);

  // Après la création d'un texte, on place le curseur dans son champ pour le renommer tout de suite.
  useEffect(() => {
    if (!focusTextOf || focusTextOf !== selectedId) return;
    // Différé : le texte est créé pendant un « pointerdown » sur le canvas, et l'action par défaut
    // du « mousedown » qui suit replacerait le focus sur la page.
    const timer = setTimeout(() => {
      textInputRef.current?.select();
      onFocused?.(); // demande consommée : resélectionner ce texte plus tard ne vole plus le focus
    }, 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTextOf, selectedId]);

  if (!layers.length) {
    return (
      <EmptyState
        icon={Layers}
        title="Aucun élément"
        description="Utilisez la barre d'outils sous le t-shirt : stylo, formes ou texte, puis cliquez directement sur le t-shirt."
        className="py-8"
      />
    );
  }

  const duplicate = () => {
    const copy = { ...translateLayer(selected, 0.02, 0.02), id: newLayerId() };
    commit([...layers, copy]);
    setSelectedId(copy.id);
  };

  return (
    <div className="space-y-6">
      {selected?.type === "trim" && (
        <div className="rounded-[var(--radius-card)] border border-border p-4">
          <TrimEditor trim={selected} onChange={(patch) => updateLayer(selected.id, patch)} onRemove={() => removeLayer(selected.id)} />
        </div>
      )}
      {selected && selected.type !== "trim" && (
        <section aria-label="Propriétés de l'élément" className="space-y-4 rounded-[var(--radius-card)] border border-border p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">{layerName(selected)}</h3>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={duplicate}>
                <Copy /> Dupliquer
              </Button>
            </div>
          </div>

          {selected.type === "text" && (
            <>
              <Field label="Texte">
                {(a11y) => (
                  <Input
                    {...a11y}
                    ref={textInputRef}
                    value={selected.text}
                    onChange={(e) => updateLayer(selected.id, { text: e.target.value })}
                  />
                )}
              </Field>
              <Field label="Police">
                {(a11y) => (
                  <Select {...a11y} value={selected.font} onChange={(e) => updateLayer(selected.id, { font: e.target.value })}>
                    {font.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            </>
          )}

          <Field label={selected.type === "motif" ? "Couleur principale" : "Couleur"}>
            {(a11y) => (
              <input
                {...a11y}
                type="color"
                value={selected.color}
                onChange={(e) => updateLayer(selected.id, { color: e.target.value })}
                className="h-10 w-14 cursor-pointer rounded-[var(--radius-control)] border border-input bg-background p-1"
              />
            )}
          </Field>

          {selected.type === "motif" && (
            <>
              <div className="flex gap-4">
                {[
                  ["color2", "Couleur 2"],
                  ["accent", "Couleur 3"],
                ].map(([key, label]) => (
                  <Field key={key} label={label}>
                    {(a11y) => (
                      <input
                        {...a11y}
                        type="color"
                        value={selected[key] ?? selected.color}
                        onChange={(e) => updateLayer(selected.id, { [key]: e.target.value })}
                        className="h-10 w-14 cursor-pointer rounded-[var(--radius-control)] border border-input bg-background p-1"
                      />
                    )}
                  </Field>
                ))}
              </div>
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium">Effets ({MAX_EFFECTS} au plus)</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {EFFECTS.map((fx) => {
                    const on = (selected.effects ?? []).includes(fx.id);
                    const full = (selected.effects ?? []).length >= MAX_EFFECTS;
                    return (
                      <label key={fx.id} className={cn("flex items-center gap-2 text-sm", !on && full && "opacity-50")}>
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={!on && full}
                          onChange={(e) =>
                            updateLayer(selected.id, {
                              effects: e.target.checked
                                ? [...(selected.effects ?? []), fx.id]
                                : (selected.effects ?? []).filter((id) => id !== fx.id),
                            })
                          }
                          className="size-4 accent-[var(--color-brand)]"
                        />
                        {fx.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
              <Button variant="outline" size="sm" onClick={() => updateLayer(selected.id, { seed: ((selected.seed ?? 1) % 9999) + 1 })}>
                <RefreshCw /> Redessiner
              </Button>
            </>
          )}

          {selected.type === "path" ? (
            <RangeField
              label="Épaisseur"
              value={selected.width}
              display={`${selected.width} px`}
              min={2}
              max={60}
              onChange={(width) => updateLayer(selected.id, { width })}
            />
          ) : (
            <>
              <RangeField
                label="Taille"
                value={selected.size}
                display={`${selected.size} px`}
                min={selected.type === "text" ? 12 : 30}
                max={400}
                onChange={(size) => updateLayer(selected.id, { size })}
              />
              <RangeField
                label="Rotation"
                value={selected.rotation ?? 0}
                display={`${selected.rotation ?? 0}°`}
                min={-180}
                max={180}
                onChange={(rotation) => updateLayer(selected.id, { rotation })}
              />
            </>
          )}

          {selected.type === "shape" && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={selected.filled}
                onChange={(e) => updateLayer(selected.id, { filled: e.target.checked })}
                className="size-4 accent-[var(--color-brand)]"
              />
              Forme pleine
            </label>
          )}
          <p className="text-xs text-muted-foreground">
            Astuce : avec l'outil Sélection, faites glisser l'élément directement sur le t-shirt.
          </p>
        </section>
      )}

      <section aria-label="Liste des éléments">
        <h3 className="mb-2 text-sm font-medium">Éléments ({layers.length})</h3>
        <ul className="space-y-1.5">
          {[...layers].reverse().map((layer) => (
            <LayerRow
              key={layer.id}
              layer={layer}
              selected={layer.id === selectedId}
              onSelect={() => setSelectedId(layer.id === selectedId ? null : layer.id)}
              onRemove={() => removeLayer(layer.id)}
            />
          ))}
        </ul>
      </section>
    </div>
  );
};

export default LayersPanel;
