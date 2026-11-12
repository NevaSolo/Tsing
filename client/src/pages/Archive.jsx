import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, Palette, Pencil, Plus, Trash2 } from "lucide-react";
import Header from "../components/Header";
import ShirtPreview from "../components/ShirtPreview";
import { ProductCardSkeleton } from "../components/ProductCard";
import { Button } from "../components/ui/button";
import { Badge, Card, EmptyState, ErrorState, PageTitle } from "../components/ui/feedback";
import { ConfirmModal } from "../components/ui/modal";
import { useToast } from "../context/ToastContext";
import api, { getErrorMessage, isCancel } from "../lib/api";
import { formatPrice } from "../lib/format";

export default function Archive() {
  const { toast } = useToast();
  const [projets, setProjets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    // Uniquement les créations du designer connecté ; la liste contient déjà tout.
    api
      .get("/shirts/", { params: { mine: 1 }, signal: controller.signal })
      .then(({ data }) => {
        setProjets(data);
        setError(null);
        setLoading(false);
      })
      .catch((err) => {
        if (isCancel(err)) return;
        setError(getErrorMessage(err, "Échec du chargement des projets."));
        setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`/shirts/${toDelete.id}/`);
      setProjets((prev) => prev.filter((p) => p.id !== toDelete.id));
      toast({ title: "T-shirt supprimé", description: toDelete.name });
      setToDelete(null);
    } catch (err) {
      toast({
        title: "Suppression impossible",
        description: getErrorMessage(err, "Le t-shirt a peut-être déjà été commandé."),
        variant: "error",
        duration: 7000,
      });
    } finally {
      setDeleting(false);
    }
  };

  const createButton = (
    <Button asChild>
      <Link to="/customizer">
        <Plus /> Nouveau t-shirt
      </Link>
    </Button>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-[104px] md:px-8">
        <PageTitle subtitle="Vos designs publiés dans la boutique." actions={createButton}>
          Mes créations
        </PageTitle>

        {error ? (
          <ErrorState description={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : loading ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : projets.length === 0 ? (
          <EmptyState
            icon={Palette}
            title="Aucune création pour le moment"
            description="Lancez le personnaliseur 3D pour créer votre premier t-shirt et le mettre en vente."
            action={createButton}
          />
        ) : (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {projets.map((projet) => (
              <li key={projet.id}>
                <Card className="overflow-hidden">
                  <Link to={`/customizer/${projet.id}`} className="block aspect-square bg-muted" aria-label={`Modifier ${projet.name}`}>
                    <ShirtPreview shirt={projet} className="h-full w-full" />
                  </Link>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="truncate font-display text-lg" title={projet.name}>
                        {projet.name}
                      </h2>
                      <span className="shrink-0 font-display text-lg text-brand-ink">{formatPrice(projet.price)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge tone={projet.stock > 0 ? "success" : "neutral"}>
                        {projet.stock > 0 ? `${projet.stock} en stock` : "Épuisé"}
                      </Badge>
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link to={`/customizer/${projet.id}`}>
                          <Pencil /> Modifier
                        </Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm" aria-label={`Voir ${projet.name} dans la boutique`}>
                        <Link to={`/ecommerce/${projet.id}`}>
                          <Eye />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => setToDelete(projet)}
                        aria-label={`Supprimer ${projet.name}`}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>

      <ConfirmModal
        open={Boolean(toDelete)}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Supprimer ce t-shirt ?"
        description={toDelete ? `« ${toDelete.name} » sera retiré de la boutique. Cette action est définitive.` : undefined}
        confirmLabel="Supprimer"
        destructive
        loading={deleting}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
