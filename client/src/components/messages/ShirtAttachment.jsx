import { Link } from "react-router-dom";
import { X } from "lucide-react";
import ShirtPreview from "../ShirtPreview";
import { formatPrice } from "../../lib/format";
import { cn } from "../../lib/utils";

/**
 * Design joint à un message : aperçu du t-shirt + nom + prix, lien vers sa page.
 * `onRemove` : affiche une croix (pièce jointe d'un message en cours d'écriture).
 */
const ShirtAttachment = ({ shirt, onRemove, inverted = false, className }) => (
  <div
    className={cn(
      "flex items-center gap-3 rounded-[var(--radius-control)] border p-2",
      inverted ? "border-white/30 bg-white/10" : "border-border bg-card",
      className
    )}
  >
    <Link to={`/ecommerce/${shirt.id}`} className="block size-16 shrink-0 overflow-hidden rounded-[var(--radius-control)] bg-muted">
      <ShirtPreview shirt={shirt} className="h-full w-full" />
    </Link>
    <div className="min-w-0 flex-1">
      <Link to={`/ecommerce/${shirt.id}`} className={cn("block truncate text-sm font-medium hover:underline", inverted ? "text-white" : "text-foreground")}>
        {shirt.name}
      </Link>
      <p className={cn("text-xs", inverted ? "text-white/80" : "text-muted-foreground")}>
        {formatPrice(shirt.price)}
        {shirt.designer_name ? ` · ${shirt.designer_name}` : ""}
      </p>
    </div>
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        aria-label={`Retirer le design « ${shirt.name} »`}
      >
        <X className="size-4" />
      </button>
    )}
  </div>
);

export default ShirtAttachment;
