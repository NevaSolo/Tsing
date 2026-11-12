import { useEffect, useId, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, MessageCircle, Minus, Plus, ShoppingBag } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import Footer from "../layout/Footer";
import ShirtCanvas from "../canvas/objects/ShirtCanvas";
import { Button } from "../components/ui/button";
import { Badge, ErrorState, PageLoader } from "../components/ui/feedback";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import api, { getErrorMessage, isCancel } from "../lib/api";
import { formatPrice } from "../lib/format";
import { cn } from "../lib/utils";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL"];

const ProductDetail = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const { addToCart, setIsCartOpen } = useCart();
  const { toast } = useToast();
  const sizeLabelId = useId();

  const [product, setProduct] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [size, setSize] = useState("M");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .get(`/shirts/${id}/`, { signal: controller.signal })
      .then((response) => {
        setProduct(response.data);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (isCancel(err)) return;
        setError(err.response?.status === 404 ? "Ce t-shirt n'existe pas ou n'est plus en vente." : getErrorMessage(err));
        setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-[72px]">
          <PageLoader />
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="pt-[104px]">
          <ErrorState
            title="Produit introuvable"
            description={error}
            onRetry={undefined}
          />
          <div className="flex justify-center">
            <Button asChild variant="outline">
              <Link to="/ecommerce">Retour à la boutique</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const outOfStock = product.stock < 1;
  const maxQuantity = Math.max(1, product.stock);

  const handleAddToCart = () => {
    if (outOfStock) return;
    addToCart(product, quantity, size);
    toast({
      title: "Ajouté au panier",
      description: `${quantity} × ${product.name} · taille ${size}`,
    });
    setIsCartOpen(true);
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-[96px] md:px-8">
        <Button asChild variant="ghost" className="-ml-3 mb-4 text-muted-foreground">
          <Link to="/ecommerce">
            <ArrowLeft /> Retour à la boutique
          </Link>
        </Button>

        <div className="grid grid-cols-1 gap-10 lg:grid-cols-2">
          <section
            aria-label="Aperçu 3D interactif"
            className="h-[380px] overflow-hidden rounded-[var(--radius-card)] border border-border bg-muted sm:h-[480px] lg:sticky lg:top-[96px] lg:h-[560px]"
          >
            <ShirtCanvas shirt={product} />
          </section>

          <div className="flex flex-col">
            <h1 className="font-display text-3xl text-foreground md:text-4xl">{product.name}</h1>
            {product.designer_name && (
              <p className="mt-1 text-muted-foreground">
                Design par{" "}
                <Link to={`/ecommerce?designer=${product.designer}`} className="text-brand-ink hover:underline">
                  {product.designer_name}
                </Link>
              </p>
            )}
            <div className="mt-4 flex items-center gap-3">
              <span className="font-display text-3xl text-brand-ink">{formatPrice(product.price)}</span>
              <Badge tone={outOfStock ? "neutral" : "success"}>
                {outOfStock ? "Rupture de stock" : `${product.stock} en stock`}
              </Badge>
            </div>

            {product.description && (
              <p className="mt-6 leading-relaxed text-muted-foreground">{product.description}</p>
            )}

            {/* Taille */}
            <fieldset className="mt-8">
              <legend id={sizeLabelId} className="mb-3 font-medium">
                Taille
              </legend>
              <div role="radiogroup" aria-labelledby={sizeLabelId} className="flex flex-wrap gap-2">
                {SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    role="radio"
                    aria-checked={size === s}
                    onClick={() => setSize(s)}
                    className={cn(
                      "h-11 min-w-12 rounded-[var(--radius-control)] border px-3 text-sm font-medium transition-colors",
                      size === s
                        ? "border-brand bg-brand text-white"
                        : "border-input text-foreground hover:border-brand"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </fieldset>

            {/* Quantité */}
            <div className="mt-8">
              <p className="mb-3 font-medium">Quantité</p>
              <div className="inline-flex items-center rounded-[var(--radius-control)] border border-input" role="group" aria-label="Quantité">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="Diminuer la quantité"
                >
                  <Minus />
                </Button>
                <span className="w-10 text-center font-medium tabular-nums" aria-live="polite">
                  {quantity}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
                  disabled={quantity >= maxQuantity}
                  aria-label="Augmenter la quantité"
                >
                  <Plus />
                </Button>
              </div>
            </div>

            <Button size="lg" onClick={handleAddToCart} disabled={outOfStock} className="mt-10 w-full">
              <ShoppingBag />
              {outOfStock ? "Épuisé" : `Ajouter au panier · ${formatPrice(Number(product.price) * quantity)}`}
            </Button>
            {product.designer && user?.id !== product.designer && (
              <Button asChild variant="outline" size="lg" className="mt-3 w-full">
                <Link to={`/chat/${product.designer}?shirt=${product.id}`}>
                  <MessageCircle /> Contacter {product.designer_name ?? "le designer"} (sur mesure, question…)
                </Link>
              </Button>
            )}
            <p className="mt-3 text-center text-sm text-muted-foreground">Livraison gratuite · Faites pivoter le t-shirt pour l'inspecter</p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default ProductDetail;
