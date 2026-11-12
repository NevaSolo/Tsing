import { AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

export const Card = ({ className, as = "div", ...props }) => {
  const Tag = as;
  return (
  <Tag
    className={cn(
      "rounded-[var(--radius-card)] border border-border bg-card shadow-[var(--shadow-card)]",
      className
    )}
    {...props}
  />
  );
};

const BADGE_TONES = {
  neutral: "bg-muted text-muted-foreground",
  brand: "bg-brand-soft text-brand-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  danger: "bg-brand-soft text-destructive",
};

export const Badge = ({ tone = "neutral", className, ...props }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
      BADGE_TONES[tone],
      className
    )}
    {...props}
  />
);

/** Badge de statut de commande (valeurs de l'API : pending, paid, shipped, delivered, cancelled). */
const ORDER_STATUS_TONE = {
  pending: "warning",
  paid: "info",
  shipped: "info",
  delivered: "success",
  cancelled: "danger",
};
export const OrderStatusBadge = ({ status, label }) => (
  <Badge tone={ORDER_STATUS_TONE[status] ?? "neutral"}>{label ?? status}</Badge>
);

export const Spinner = ({ className, label = "Chargement" }) => (
  <span role="status" className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}>
    <Loader2 className="size-5 animate-spin" aria-hidden="true" />
    <span className="sr-only">{label}</span>
  </span>
);

export const PageLoader = ({ label = "Chargement..." }) => (
  <div className="flex min-h-[50vh] items-center justify-center gap-3 text-muted-foreground">
    <Spinner />
    <span className="font-display text-lg">{label}</span>
  </div>
);

export const Skeleton = ({ className }) => (
  <div className={cn("animate-pulse rounded-[var(--radius-control)] bg-muted", className)} aria-hidden="true" />
);

const IconSlot = ({ icon }) => {
  const Icon = icon;
  return <Icon className="size-7" aria-hidden="true" />;
};

export const EmptyState = ({ icon, title, description, action, className }) => (
  <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
    {icon && (
      <div className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
        <IconSlot icon={icon} />
      </div>
    )}
    <h2 className="font-display text-xl text-foreground">{title}</h2>
    {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);

export const ErrorState = ({ title = "Une erreur est survenue", description, onRetry, className }) => (
  <div role="alert" className={cn("flex flex-col items-center justify-center gap-3 px-6 py-14 text-center", className)}>
    <div className="flex size-14 items-center justify-center rounded-full bg-brand-soft text-destructive">
      <AlertTriangle className="size-7" aria-hidden="true" />
    </div>
    <h2 className="font-display text-xl text-foreground">{title}</h2>
    {description && <p className="max-w-md text-sm text-muted-foreground">{description}</p>}
    {onRetry && (
      <Button variant="outline" onClick={onRetry} className="mt-2">
        Réessayer
      </Button>
    )}
  </div>
);

/** Titre de page cohérent sur tout le site. */
export const PageTitle = ({ children, subtitle, actions, className }) => (
  <div className={cn("mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
    <div>
      <h1 className="font-display text-3xl text-foreground md:text-4xl">{children}</h1>
      {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
    </div>
    {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
  </div>
);
