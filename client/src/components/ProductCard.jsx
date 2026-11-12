import { Link } from "react-router-dom";
import { formatPrice } from "../lib/format";
import ShirtPreview from "./ShirtPreview";
import { Badge, Card, Skeleton } from "./ui/feedback";

/** Carte produit de la boutique : un vrai lien (clavier, clic milieu, lecteur d'écran). */
const ProductCard = ({ product }) => (
  <Card className="group overflow-hidden transition-shadow hover:shadow-[var(--shadow-card-hover)]">
    <Link to={`/ecommerce/${product.id}`} className="block focus-visible:outline-offset-[-2px]">
      <div className="relative aspect-square bg-muted">
        <ShirtPreview
          shirt={product}
          className="h-full w-full transition-transform duration-300 group-hover:scale-[1.03]"
        />
        {product.stock === 0 && (
          <Badge tone="neutral" className="absolute left-3 top-3 bg-background/90">
            Épuisé
          </Badge>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg text-foreground" title={product.name}>
            {product.name}
          </h3>
          {product.designer_name && (
            <p className="truncate text-sm text-muted-foreground">par {product.designer_name}</p>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <span className="font-display text-lg text-brand-ink">{formatPrice(product.price)}</span>
          <span
            className="size-4 rounded-full border border-border"
            style={{ backgroundColor: product.shirt_color }}
            title={`Couleur ${product.shirt_color}`}
            aria-hidden="true"
          />
        </div>
      </div>
    </Link>
  </Card>
);

export const ProductCardSkeleton = () => (
  <Card className="overflow-hidden">
    <Skeleton className="aspect-square rounded-none" />
    <div className="space-y-2 p-4">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
    </div>
  </Card>
);

export default ProductCard;
