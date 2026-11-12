import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";
import { cn } from "../lib/utils";
import { Button } from "./ui/button";

export const THEME_OPTIONS = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
];

const LABEL = { light: "clair", dark: "sombre", system: "système" };

/** Bouton icône + menu (Clair / Sombre / Système). */
const ThemeToggle = ({ className }) => {
  const { mode, resolved, setMode } = useTheme();
  const Icon = resolved === "dark" ? Moon : Sun;
  return (
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger asChild>
        <Button variant="ghost" size="icon" className={className} aria-label={`Thème : ${LABEL[mode]}. Changer de thème`}>
          <Icon className="!size-5" />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-[170px] rounded-xl border border-border bg-card p-1.5 text-foreground shadow-[var(--shadow-card-hover)]"
        >
          <DropdownMenu.Label className="px-2 py-1 text-xs font-medium text-muted-foreground">Thème</DropdownMenu.Label>
          <DropdownMenu.RadioGroup value={mode} onValueChange={setMode}>
            {THEME_OPTIONS.map(({ value, label, icon }) => {
              const ItemIcon = icon;
              return (
                <DropdownMenu.RadioItem
                  key={value}
                  value={value}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                >
                  <ItemIcon className="size-4 text-muted-foreground" aria-hidden="true" />
                  <span className="flex-1">{label}</span>
                  <DropdownMenu.ItemIndicator>
                    <Check className="size-4 text-brand-ink" aria-hidden="true" />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
};

/** Variante en ligne (menu mobile) : trois boutons radio. */
export const ThemeSegmented = ({ className }) => {
  const { mode, setMode } = useTheme();
  return (
    <div role="radiogroup" aria-label="Thème" className={cn("grid grid-cols-3 gap-1 rounded-[var(--radius-control)] bg-muted p-1", className)}>
      {THEME_OPTIONS.map(({ value, label, icon }) => {
        const ItemIcon = icon;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors",
              mode === value ? "bg-background font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <ItemIcon className="size-4" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
};

export default ThemeToggle;
