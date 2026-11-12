import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Palette } from "lucide-react";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import { Button } from "../components/ui/button";
import { EmptyState } from "../components/ui/feedback";
import api, { isCancel } from "../lib/api";

const COUNT = 4;

/** Vitrine des derniers t-shirts publiés (données réelles de la boutique). */
const LatestCreations = () => {
  const [shirts, setShirts] = useState([]);
  const [status, setStatus] = useState("loading"); // loading | ready | error

  useEffect(() => {
    const controller = new AbortController();
    api
      .get("/shirts/", { signal: controller.signal })
      .then(({ data }) => {
        // L'API trie déjà du plus récent au plus ancien ; on privilégie ce qui est en stock.
        const inStock = data.filter((s) => s.stock > 0);
        setShirts((inStock.length >= COUNT ? inStock : data).slice(0, COUNT));
        setStatus("ready");
      })
      .catch((err) => {
        if (!isCancel(err)) setStatus("error");
      });
    return () => controller.abort();
  }, []);

  // En cas d'erreur réseau, la section disparaît plutôt que d'afficher un bloc cassé sur l'accueil.
  if (status === "error") return null;

  return (
    <section aria-labelledby="latest-title" className="mx-auto max-w-[1280px] px-4 pb-16 md:px-8 md:pb-24">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="latest-title" className="font-display text-4xl md:text-5xl">
            Dernières créations
          </h2>
          <p className="mt-2 text-muted-foreground">Fraîchement publiées par nos designers.</p>
        </div>
        {shirts.length > 0 && (
          <Button asChild variant="outline-brand">
            <Link to="/ecommerce">
              Voir toute la boutique <ArrowRight />
            </Link>
          </Button>
        )}
      </div>

      {status === "loading" ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" aria-busy="true">
          {Array.from({ length: COUNT }, (_, i) => (
            <ProductCardSkeleton key={i} />
          ))}
        </div>
      ) : shirts.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="Les premières créations arrivent"
          description="Soyez le premier designer à publier un t-shirt sur Tsing."
          action={
            <Button asChild>
              <Link to="/auth?role=designer">Devenir designer</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {shirts.map((shirt) => (
            <li key={shirt.id}>
              <ProductCard product={shirt} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default LatestCreations;
