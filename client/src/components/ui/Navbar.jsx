import { Link } from "react-router-dom";
import { ArrowLeft, Download, Save } from "lucide-react";
import { Button } from "./button";
import ThemeToggle from "../ThemeToggle";

/** Barre d'actions du personnaliseur. */
/** `onLeave(to)` (optionnel) intercepte la navigation, par exemple pour confirmer l'abandon des modifications. */
const Navbar = ({ title, onExport, onSave, onLeave }) => {
  const guard = (to) => (e) => {
    if (!onLeave) return;
    e.preventDefault();
    onLeave(to);
  };
  return (
  <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-3 md:px-6">
    <div className="flex min-w-0 items-center gap-2 md:gap-4">
      <Button asChild variant="ghost" size="icon" aria-label="Retour à mes créations">
        <Link to="/archive" onClick={guard("/archive")}>
          <ArrowLeft className="!size-5" />
        </Link>
      </Button>
      <Link to="/" onClick={guard("/")} className="hidden font-display text-2xl tracking-[2px] text-brand-ink sm:block">
        TSING
      </Link>
      {title && <span className="truncate text-sm text-muted-foreground sm:border-l sm:border-border sm:pl-4">{title}</span>}
    </div>

    <div className="flex shrink-0 gap-2">
      <ThemeToggle />
      <Button variant="outline-brand" onClick={onExport} aria-label="Exporter l'aperçu en PNG">
        <Download />
        <span className="hidden sm:inline">Exporter</span>
      </Button>
      <Button onClick={onSave}>
        <Save />
        Enregistrer
      </Button>
    </div>
  </header>
  );
};

export default Navbar;
