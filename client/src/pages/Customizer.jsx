import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ShirtCustomizer from "../canvas/ShirtCustomizer";
import Navbar from "../components/ui/Navbar";
import { ErrorState, PageLoader } from "../components/ui/feedback";
import { ConfirmModal } from "../components/ui/modal";
import api, { getErrorMessage, isCancel } from "../lib/api";

const Customizer = () => {
  // Compteurs : chaque clic déclenche une nouvelle action, même répétée.
  const [saveRequest, setSaveRequest] = useState(0);
  const [exportRequest, setExportRequest] = useState(0);
  const [loadError, setLoadError] = useState("");
  const { id } = useParams();
  const navigate = useNavigate();
  const [newShirt, setNewShirt] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [leaveTo, setLeaveTo] = useState(null);
  // En édition, on attend le t-shirt avant d'afficher l'éditeur (sinon un dessin fait pendant
  // le chargement serait écrasé, et « Enregistrer » créerait un doublon).
  const waitingForShirt = Boolean(id) && String(newShirt?.id) !== String(id);

  useEffect(() => {
    setLoadError("");
    setNewShirt(null);
    if (!id) {
      setNewShirt(null);
      return;
    }
    const controller = new AbortController();
    api
      .get(`/shirts/${id}/`, { signal: controller.signal })
      .then((res) => setNewShirt(res.data))
      .catch((err) => {
        if (!isCancel(err)) setLoadError(getErrorMessage(err, "T-shirt introuvable."));
      });
    return () => controller.abort();
  }, [id]);

  return (
    <div className="flex h-dvh w-full flex-col bg-background">
      <Navbar
        title={id ? `Modifier « ${newShirt?.name ?? "…"} »` : "Nouveau t-shirt"}
        onExport={() => setExportRequest((n) => n + 1)}
        onSave={() => setSaveRequest((n) => n + 1)}
        onLeave={dirty ? setLeaveTo : undefined}
      />
      <main className="min-h-0 flex-1">
        {loadError ? (
          <ErrorState title="Impossible d'ouvrir ce t-shirt" description={loadError} />
        ) : waitingForShirt ? (
          <PageLoader label="Chargement du t-shirt…" />
        ) : (
          <ShirtCustomizer
            key={id ?? "new"}
            saveRequest={saveRequest}
            exportRequest={exportRequest}
            newShirt={newShirt}
            onDirtyChange={setDirty}
          />
        )}
      </main>
      <ConfirmModal
        open={Boolean(leaveTo)}
        onOpenChange={(open) => !open && setLeaveTo(null)}
        title="Quitter sans enregistrer ?"
        description="Vos modifications (dessins, textes, réglages) seront perdues."
        confirmLabel="Quitter"
        destructive
        onConfirm={() => {
          const to = leaveTo;
          setLeaveTo(null);
          setDirty(false);
          navigate(to);
        }}
      />
    </div>
  );
};

export default Customizer;
