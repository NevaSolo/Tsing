import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import {
  Circle,
  Eraser,
  Heart,
  Move3d,
  MousePointer2,
  PenLine,
  Redo2,
  Shapes,
  SlidersHorizontal,
  Square,
  Star,
  Trash2,
  Triangle,
  Type,
  Undo2,
} from "lucide-react";
import { cn } from "../lib/utils";
import { SHAPES } from "./utils/layers";

const SHAPE_ICONS = { rect: Square, circle: Circle, triangle: Triangle, star: Star, heart: Heart };

export const TOOLS = [
  { id: "orbit", label: "Naviguer (tourner le t-shirt)", short: "H", icon: Move3d },
  { id: "select", label: "Sélectionner et déplacer", short: "V", icon: MousePointer2 },
  { id: "pen", label: "Stylo (dessin à main levée)", short: "P", icon: PenLine },
  { id: "eraser", label: "Gomme (efface un élément)", short: "E", icon: Eraser },
  { id: "text", label: "Texte (cliquez sur le t-shirt)", short: "T", icon: Type },
];

const ToolButton = ({ active, label, shortcut, onClick, disabled, children, ...rest }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-pressed={active}
    aria-label={label}
    title={shortcut ? `${label} (${shortcut})` : label}
    className={cn(
      "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors disabled:opacity-35",
      active ? "bg-brand text-white shadow-sm" : "text-foreground hover:bg-muted"
    )}
    {...rest}
  >
    {children}
  </button>
);

const Divider = () => <span className="mx-1 h-6 w-px shrink-0 bg-border" aria-hidden="true" />;

const menuContent =
  "z-50 min-w-[200px] rounded-xl border border-border bg-card p-2 shadow-[var(--shadow-card-hover)]";

/**
 * Barre d'outils d'édition flottante (bas de l'aperçu 3D).
 */
const EditorToolbar = ({ tool, onToolChange, style, onStyleChange, canUndo, canRedo, onUndo, onRedo, onClear, hasLayers }) => {
  const activeShape = tool.startsWith("shape:") ? tool.slice(6) : null;
  const ShapeIcon = activeShape ? SHAPE_ICONS[activeShape] : Shapes;

  return (
    <div
      role="toolbar"
      aria-label="Outils d'édition"
      className="flex max-w-full flex-wrap items-center justify-center gap-0.5 rounded-2xl border border-border bg-background/95 p-1.5 shadow-[var(--shadow-card-hover)] backdrop-blur sm:flex-nowrap"
    >
      {TOOLS.map((t) => {
        const Icon = t.icon;
        return (
          <ToolButton key={t.id} active={tool === t.id} label={t.label} shortcut={t.short} onClick={() => onToolChange(t.id)}>
            <Icon className="size-5" aria-hidden="true" />
          </ToolButton>
        );
      })}

      {/* Formes */}
      <DropdownMenu.Root modal={false}>
        <DropdownMenu.Trigger asChild>
          <ToolButton active={Boolean(activeShape)} label="Formes" shortcut="S">
            <ShapeIcon className="size-5" aria-hidden="true" />
          </ToolButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content side="top" sideOffset={10} className={menuContent}>
            <DropdownMenu.Label className="px-2 pb-1 text-xs font-medium text-muted-foreground">
              Cliquez ensuite sur le t-shirt
            </DropdownMenu.Label>
            {SHAPES.map((shape) => {
              const Icon = SHAPE_ICONS[shape.id];
              return (
                <DropdownMenu.Item
                  key={shape.id}
                  onSelect={() => onToolChange(`shape:${shape.id}`)}
                  className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {shape.label}
                </DropdownMenu.Item>
              );
            })}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <Divider />

      {/* Couleur */}
      <label
        className="relative flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-xl hover:bg-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[var(--color-ring)]"
        title="Couleur"
      >
        <span className="size-6 rounded-full border-2 border-background shadow-[0_0_0_1px_var(--color-border)]" style={{ backgroundColor: style.color }} />
        <input
          type="color"
          value={style.color}
          onChange={(e) => onStyleChange({ color: e.target.value })}
          aria-label="Couleur de l'outil"
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </label>

      {/* Réglages : épaisseur, taille, remplissage */}
      <Popover.Root>
        <Popover.Trigger asChild>
          <ToolButton label="Épaisseur, taille et remplissage">
            <SlidersHorizontal className="size-5" aria-hidden="true" />
          </ToolButton>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content side="top" sideOffset={10} aria-label="Réglages de l'outil" className={cn(menuContent, "w-64 space-y-4 p-4")}>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <label htmlFor="tool-width">Épaisseur du trait</label>
                <span className="tabular-nums text-muted-foreground">{style.width} px</span>
              </div>
              <input
                id="tool-width"
                type="range"
                min={2}
                max={60}
                value={style.width}
                onChange={(e) => onStyleChange({ width: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <div className="mb-1 flex justify-between text-sm">
                <label htmlFor="tool-size">Taille des formes</label>
                <span className="tabular-nums text-muted-foreground">{style.size} px</span>
              </div>
              <input
                id="tool-size"
                type="range"
                min={30}
                max={400}
                value={style.size}
                onChange={(e) => onStyleChange({ size: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={style.filled}
                onChange={(e) => onStyleChange({ filled: e.target.checked })}
                className="size-4 accent-[var(--color-brand)]"
              />
              Formes pleines
            </label>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

      <Divider />

      <ToolButton label="Annuler" shortcut="Ctrl+Z" onClick={onUndo} disabled={!canUndo}>
        <Undo2 className="size-5" aria-hidden="true" />
      </ToolButton>
      <ToolButton label="Rétablir" shortcut="Ctrl+Y" onClick={onRedo} disabled={!canRedo}>
        <Redo2 className="size-5" aria-hidden="true" />
      </ToolButton>
      <ToolButton label="Tout effacer" onClick={onClear} disabled={!hasLayers}>
        <Trash2 className="size-5" aria-hidden="true" />
      </ToolButton>
    </div>
  );
};

export default EditorToolbar;
