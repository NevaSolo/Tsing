import { useEffect, useMemo, useState } from "react";
import ShirtScene from "../ShirtScene";
import ViewToggle from "../ViewToggle";
import api, { isCancel } from "../../lib/api";
import { normalizeShirt } from "../../lib/format";
import { shirtToDesign } from "../utils/shirtTexture";
import { Spinner } from "../../components/ui/feedback";

/**
 * Aperçu 3D interactif d'un t-shirt (page produit).
 * Passer `shirt` (données déjà chargées) évite une requête ; sinon `id` déclenche le chargement.
 * Pour les listes, utiliser ShirtPreview (image) : un seul contexte WebGL pour toute la page.
 */
const ShirtCanvas = ({ id, shirt, showViewToggle = true }) => {
  const [data, setData] = useState(() => normalizeShirt(shirt) ?? null);
  const [image, setImage] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [view, setView] = useState("front");
  const design = useMemo(() => (data ? { ...shirtToDesign(data), image } : null), [data, image]);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    let objectUrl = null;

    const load = async () => {
      try {
        let shirtData = normalizeShirt(shirt);
        if (!shirtData) {
          if (!id) return;
          const res = await api.get(`/shirts/${id}/`, { signal });
          shirtData = normalizeShirt(res.data);
        }
        setData(shirtData);

        // L'image est chargée en blob pour éviter un canvas « tainted » (cross-origin).
        if (shirtData.image) {
          const response = await fetch(shirtData.image, { signal });
          objectUrl = URL.createObjectURL(await response.blob());
          setImage(objectUrl);
        }
        setIsReady(true);
      } catch (err) {
        if (!isCancel(err) && err.name !== "AbortError") {
          console.error("Erreur de chargement du t-shirt :", err);
          setFailed(true);
        }
      }
    };

    load();
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [id, shirt]);

  if (failed) {
    return <p className="p-4 text-center text-sm text-muted-foreground">Aperçu indisponible</p>;
  }

  if (!isReady || !data) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Chargement du t-shirt" />
      </div>
    );
  }

  return (
    <div className="relative h-full w-full">
      <ShirtScene design={design} view={view} cameraZ={1.5} className="h-full w-full" />
      {showViewToggle && (
        <ViewToggle value={view} onChange={setView} className="absolute bottom-3 left-1/2 -translate-x-1/2" />
      )}
    </div>
  );
};

export default ShirtCanvas;
