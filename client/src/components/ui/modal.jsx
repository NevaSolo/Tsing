import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

/**
 * Fenêtre modale accessible : focus piégé, Échap et clic extérieur pour fermer,
 * focus rendu à l'élément déclencheur à la fermeture.
 */
export const Modal = ({ open, onOpenChange, title, description, children, className }) => (
  <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] dark:bg-black/60" />
      <Dialog.Content
        data-lenis-prevent
        className={cn(
          "fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2",
          "max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-[var(--radius-card)] border border-border bg-card p-6 shadow-[var(--shadow-card-hover)]",
          "animate-toast-in focus:outline-none",
          className
        )}
        {...(description ? {} : { "aria-describedby": undefined })}
      >
        <Dialog.Title className="font-display text-xl text-foreground pr-8">{title}</Dialog.Title>
        {description && (
          <Dialog.Description className="mt-1 text-sm text-muted-foreground">{description}</Dialog.Description>
        )}
        <div className="mt-5">{children}</div>
        <Dialog.Close asChild>
          <Button variant="ghost" size="icon" className="absolute right-3 top-3" aria-label="Fermer">
            <X />
          </Button>
        </Dialog.Close>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>
);

/** Confirmation (remplace window.confirm). */
export const ConfirmModal = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmer",
  destructive = false,
  loading = false,
  onConfirm,
}) => (
  <Modal open={open} onOpenChange={onOpenChange} title={title} description={description}>
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
      <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
        Annuler
      </Button>
      <Button variant={destructive ? "destructive" : "default"} onClick={onConfirm} disabled={loading}>
        {loading ? "Patientez..." : confirmLabel}
      </Button>
    </div>
  </Modal>
);
