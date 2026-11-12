import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PackageSearch, Search, X } from "lucide-react";
import Header from "../components/Header";
import Footer from "../layout/Footer";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import { Button } from "../components/ui/button";
import { EmptyState, ErrorState, PageTitle } from "../components/ui/feedback";
import { Input, Select } from "../components/ui/form";
import api, { getErrorMessage, isCancel } from "../lib/api";
import { cn } from "../lib/utils";

const SORTS = {
  recent: { label: "Nouveautés", compare: (a, b) => new Date(b.created_at) - new Date(a.created_at) },
  "price-asc": { label: "Prix croissant", compare: (a, b) => Number(a.price) - Number(b.price) },
  "price-desc": { label: "Prix décroissant", compare: (a, b) => Number(b.price) - Number(a.price) },
};

const Ecommerce = () => {
  const [params, setParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  // L'état des filtres vit dans l'URL : partageable et conservé au retour arrière.
  const query = params.get("q") ?? "";
  const sort = SORTS[params.get("tri")] ? params.get("tri") : "recent";
  const color = params.get("couleur") ?? "";
  const designerId = params.get("designer") ?? "";

  const updateParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    // Une seule requête : la liste contient déjà toutes les données nécessaires.
    api
      .get("/shirts/", { signal: controller.signal })
      .then(({ data }) => {
        setProducts(data);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (isCancel(err)) return;
        setError(getErrorMessage(err, "Impossible de charger les t-shirts."));
        setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const colors = useMemo(
    () => [...new Set(products.map((p) => p.shirt_color?.toLowerCase()).filter(Boolean))],
    [products]
  );
  const designerName = useMemo(
    () => products.find((p) => String(p.designer) === designerId)?.designer_name,
    [products, designerId]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((p) => !q || [p.name, p.description, p.designer_name].some((v) => v?.toLowerCase().includes(q)))
      .filter((p) => !color || p.shirt_color?.toLowerCase() === color)
      .filter((p) => !designerId || String(p.designer) === designerId)
      .sort(SORTS[sort].compare);
  }, [products, query, color, designerId, sort]);

  const hasFilters = Boolean(query || color || designerId);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-[104px] md:px-8">
        <PageTitle
          subtitle={
            designerName
              ? `Les créations de ${designerName}`
              : "Des t-shirts imaginés par nos designers, rendus en 3D."
          }
        >
          Notre collection
        </PageTitle>

        {/* Barre d'outils */}
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              aria-label="Rechercher un t-shirt"
              placeholder="Rechercher un t-shirt, un designer…"
              value={query}
              onChange={(e) => updateParam("q", e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {colors.length > 1 && (
              <div role="group" aria-label="Filtrer par couleur" className="flex items-center gap-1.5">
                {colors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => updateParam("couleur", color === c ? "" : c)}
                    aria-pressed={color === c}
                    aria-label={`Couleur ${c}`}
                    title={c}
                    className={cn(
                      "size-7 rounded-full border border-input transition-shadow",
                      color === c && "ring-2 ring-brand ring-offset-2"
                    )}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            )}
            <Select
              aria-label="Trier par"
              value={sort}
              onChange={(e) => updateParam("tri", e.target.value === "recent" ? "" : e.target.value)}
              className="w-auto min-w-[170px]"
            >
              {Object.entries(SORTS).map(([value, { label }]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
            {hasFilters && (
              <Button variant="ghost" onClick={() => setParams({}, { replace: true })}>
                <X /> Réinitialiser
              </Button>
            )}
          </div>
        </div>

        {error ? (
          <ErrorState description={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <EmptyState
            icon={PackageSearch}
            title={products.length === 0 ? "La boutique est encore vide" : "Aucun résultat"}
            description={
              products.length === 0
                ? "Les premiers t-shirts arrivent bientôt. Vous êtes designer ? Publiez le vôtre !"
                : "Essayez d'autres mots-clés ou retirez les filtres."
            }
            action={
              products.length === 0 ? (
                <Button asChild>
                  <Link to="/auth?role=designer">Devenir designer</Link>
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setParams({}, { replace: true })}>
                  Réinitialiser les filtres
                </Button>
              )
            }
          />
        ) : (
          <>
            <p className="mb-4 text-sm text-muted-foreground" aria-live="polite">
              {visible.length} t-shirt{visible.length > 1 ? "s" : ""}
            </p>
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map((product) => (
                <li key={product.id}>
                  <ProductCard product={product} />
                </li>
              ))}
            </ul>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Ecommerce;
