import { useEffect, useState } from "react";
import { Cpu, Download, Loader2, Trash2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/feedback";
import { ConfirmModal } from "../components/ui/modal";
import {
  cancelLoad,
  deleteModel,
  loadModel,
  MODEL_LABEL,
  MODEL_VRAM_MB,
  unloadModel,
} from "./localAI";
import useLocalAI from "./useLocalAI";

const gb = (mb) => `${(mb / 1024).toFixed(1).replace(".", ",")} Go`;

/**
 * Carte d'état de l'IA locale : indisponible / à activer / téléchargement / active / erreur.
 * `enabled` / `onEnabledChange` : utiliser ou non l'IA pour les prochaines générations.
 */
const LocalAICard = ({ enabled, onEnabledChange }) => {
  const ai = useLocalAI();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pct = Math.round(ai.progress * 100);
  const server = ai.engine === "server";
  // Temps écoulé pendant le chargement : la barre n'avance qu'à la fin de chaque fichier de ≈ 250 Mo.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (ai.status !== "loading") return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ai.status]);
  const elapsed = ai.loadStartedAt
    ? Math.max(0, Math.round((now - ai.loadStartedAt) / 1000))
    : 0;
  const elapsedLabel =
    elapsed >= 60
      ? `${Math.floor(elapsed / 60)} min ${String(elapsed % 60).padStart(2, "0")} s`
      : `${elapsed} s`;
  const firstFileSlow = ai.status === "loading" && pct === 0 && elapsed >= 60;
  // Annonce vocale : seulement les changements d'état, pas chaque ligne de progression.
  const announce =
    {
      checking: "Vérification de votre appareil.",
      loading: "Chargement de l'IA en cours.",
      ready: `${server ? "IA Tsing" : "IA locale"} ${enabled ? "active" : "en pause"}.`,
      deleting: "Suppression du modèle.",
      available: ai.cached
        ? "IA locale prête à être activée."
        : "IA locale disponible au téléchargement.",
    }[ai.status] ?? "";

  const removeModel = async () => {
    setConfirmDelete(false);
    onEnabledChange(false);
    await deleteModel(); // en cas d'échec, l'erreur est affichée par la carte (état « available » + error)
  };

  const activate = () => {
    onEnabledChange(true);
    loadModel().catch(() => onEnabledChange(false));
  };

  return (
    <section
      aria-label="IA locale"
      className="rounded-[var(--radius-card)] border border-border bg-card p-4"
      aria-busy={
        ai.status === "loading" ||
        ai.status === "checking" ||
        ai.status === "deleting"
      }
    >
      <p className="sr-only" role="status">
        {announce}
      </p>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
          <Cpu className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-medium">{server ? "IA Tsing" : "IA locale"}</h3>
            {ai.status === "ready" || ai.status === "generating" ? (
              <Badge tone={enabled ? "success" : "neutral"}>
                {enabled ? "Active" : "En pause"}
              </Badge>
            ) : ai.status === "unsupported" ? (
              <Badge tone="neutral">Indisponible</Badge>
            ) : (
              <Badge tone="info">Gratuite</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {server
              ? `L'IA de Tsing (${ai.serverModel}) imagine vos designs sur nos serveurs : rien à télécharger, aucun coût. Comptez 20 à 40 secondes par demande.`
              : `${MODEL_LABEL} s'exécute dans votre navigateur : aucun compte, aucun coût, vos idées ne quittent pas votre appareil. Comptez environ une minute par demande sur une carte graphique intégrée (plus rapide sur une carte dédiée).`}
          </p>
        </div>
      </div>

      {ai.status === "checking" && (
        <p className="mt-3 text-sm text-muted-foreground">
          Vérification de votre appareil…
        </p>
      )}

      {ai.status === "deleting" && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />{" "}
          Suppression du modèle…
        </p>
      )}

      {ai.status === "unsupported" && (
        <p className="mt-3 text-sm text-muted-foreground">
          {ai.error} Le générateur intégré reste disponible.
        </p>
      )}

      {ai.status === "available" && (
        <div className="mt-3 space-y-2">
          {ai.error && (
            <p className="text-sm text-destructive" role="alert">
              {ai.error}
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {ai.cached
              ? "Le modèle est déjà sur cet appareil : activation en quelques secondes."
              : ai.bundled
                ? `Le modèle est fourni par le site : rien à télécharger depuis Internet, activation en moins d'une minute (mémoire graphique requise : ${gb(MODEL_VRAM_MB)}).`
                : `Premier lancement : téléchargement unique du modèle (de quelques minutes à une demi-heure selon la connexion ; mémoire graphique requise : ${gb(MODEL_VRAM_MB)}). Il reste ensuite sur l'appareil.`}
          </p>
          <Button onClick={activate} className="w-full">
            <Download />{" "}
            {ai.cached || ai.bundled
              ? "Activer l'IA locale"
              : "Télécharger et activer l'IA"}
          </Button>
        </div>
      )}

      {ai.status === "loading" && (
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />{" "}
              Chargement de l'IA
            </span>
            <span className="tabular-nums" aria-hidden="true">
              {pct} %
            </span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Chargement de l'IA"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
          >
            <div
              className="h-full rounded-full bg-brand transition-[width]"
              style={{ width: `${pct}%` }}
            />
          </div>
          <p
            className="mt-1.5 truncate text-xs text-muted-foreground"
            title={ai.detail}
          >
            {ai.detail}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="tabular-nums">{elapsedLabel}</span> ·{" "}
            {ai.bundled
              ? "Copie du modèle depuis le site vers le navigateur (la première fois), puis préparation de la carte graphique."
              : "Le premier fichier pèse 250 Mo : la barre reste à 0 % jusqu'à ce qu'il soit reçu, puis avance régulièrement."}{" "}
            Vous pouvez continuer à utiliser le Studio pendant ce temps.
          </p>
          {firstFileSlow && !ai.bundled && (
            <p className="mt-2 rounded-[var(--radius-control)] bg-muted p-2 text-xs text-muted-foreground">
              Toujours à 0 % ? C'est normal si la connexion est lente (plusieurs
              minutes par fichier). Si un gestionnaire de téléchargement (IDM,
              Free Download Manager…) a ouvert une fenêtre pour un fichier «
              params_shard…bin », fermez-la, désactivez-le pour ce site, puis
              annulez et relancez.
            </p>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={cancelLoad}
          >
            Annuler le chargement
          </Button>
        </div>
      )}

      {(ai.status === "ready" || ai.status === "generating") && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label className="flex flex-1 cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => onEnabledChange(e.target.checked)}
              className="size-4 accent-[var(--color-brand)]"
            />
            Utiliser l'IA pour les propositions
          </label>
          {!server && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => unloadModel().then(() => onEnabledChange(false))}
                disabled={ai.status === "generating"}
              >
                Libérer la mémoire
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
                disabled={ai.status === "generating"}
                aria-label="Supprimer le modèle de cet appareil"
                title="Supprimer le modèle de cet appareil"
              >
                <Trash2 />
              </Button>
            </>
          )}
        </div>
      )}

      {ai.status === "error" && (
        <div className="mt-3 space-y-2" role="alert">
          <p className="text-sm text-destructive">
            {ai.error} Le générateur intégré reste disponible.
          </p>
          <Button variant="outline" size="sm" onClick={activate}>
            Réessayer
          </Button>
        </div>
      )}

      <ConfirmModal
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Supprimer le modèle de cet appareil ?"
        description={`Le modèle libère environ 1 Go d'espace disque. Pour réutiliser l'IA, il faudra le retélécharger.`}
        confirmLabel="Supprimer"
        destructive
        onConfirm={removeModel}
      />
    </section>
  );
};

export default LocalAICard;
