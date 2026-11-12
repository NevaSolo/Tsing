import { useEffect, useState } from "react";
import { Shirt as ShirtIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { Skeleton } from "./ui/feedback";

/**
 * Image d'aperçu d'un t-shirt, générée à la demande par le moteur 3D partagé.
 * Le moteur (three.js) n'est téléchargé qu'au premier aperçu affiché.
 */
const ShirtPreview = ({ shirt, view = "front", className }) => {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    import("../canvas/previewRenderer")
      .then(({ getShirtPreview }) => getShirtPreview(shirt, view))
      .then((url) => {
        if (!cancelled) setSrc(url);
      })
      .catch((err) => {
        console.error("Aperçu impossible :", err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [shirt, view]);

  if (failed) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", className)}>
        <ShirtIcon className="size-12" aria-hidden="true" />
        <span className="sr-only">Aperçu indisponible</span>
      </div>
    );
  }

  if (!src) return <Skeleton className={cn("rounded-none", className)} />;

  return (
    <img
      src={src}
      alt={`Aperçu du t-shirt « ${shirt.name} »`}
      className={cn("object-contain", className)}
      draggable={false}
    />
  );
};

export default ShirtPreview;
