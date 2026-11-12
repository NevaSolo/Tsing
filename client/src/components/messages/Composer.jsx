import { useEffect, useRef, useState } from "react";
import { Paperclip, SendHorizontal } from "lucide-react";
import { Button } from "../ui/button";
import { Select, Textarea } from "../ui/form";
import ShirtAttachment from "./ShirtAttachment";
import { MESSAGE_MAX_LENGTH } from "../../lib/messages";
import { cn } from "../../lib/utils";

/**
 * Zone de saisie d'un message. Entrée envoie, Maj+Entrée va à la ligne.
 * `attachment` / `onAttachmentChange` : design joint (t-shirt) ; `attachable` : t-shirts proposés à joindre.
 * `onSend({ body, shirt })` renvoie une promesse : le texte n'est effacé qu'après un envoi réussi.
 */
const Composer = ({ onSend, attachment, onAttachmentChange, attachable = [], placeholder = "Votre message…", autoFocus = false }) => {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [picking, setPicking] = useState(false);
  const textRef = useRef(null);

  useEffect(() => {
    if (autoFocus) textRef.current?.focus();
  }, [autoFocus]);

  const trimmed = body.trim();
  const tooLong = body.length > MESSAGE_MAX_LENGTH;
  const canSend = !sending && !tooLong && (trimmed.length > 0 || Boolean(attachment));

  const submit = async (e) => {
    e?.preventDefault();
    if (!canSend) return;
    setSending(true);
    try {
      await onSend({ body: trimmed, shirt: attachment?.id ?? null });
      setBody("");
      onAttachmentChange?.(null);
      setPicking(false);
    } catch {
      /* l'erreur est affichée par l'appelant ; le texte reste pour réessayer */
    } finally {
      setSending(false);
      textRef.current?.focus();
    }
  };

  return (
    <form onSubmit={submit} className="space-y-2 border-t border-border bg-background p-3">
      {attachment && <ShirtAttachment shirt={attachment} onRemove={() => onAttachmentChange?.(null)} />}
      {picking && attachable.length > 0 && !attachment && (
        <Select
          aria-label="Choisir un design à joindre"
          defaultValue=""
          onChange={(e) => {
            const shirt = attachable.find((s) => String(s.id) === e.target.value);
            if (shirt) onAttachmentChange?.(shirt);
          }}
        >
          <option value="" disabled>
            Choisir une de vos créations…
          </option>
          {attachable.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      )}
      <div className="flex items-end gap-2">
        {attachable.length > 0 && onAttachmentChange && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-pressed={picking}
            onClick={() => setPicking((p) => !p)}
            aria-label="Joindre un design"
            title="Joindre un design"
          >
            <Paperclip />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <Textarea
            ref={textRef}
            rows={2}
            value={body}
            placeholder={placeholder}
            aria-label="Votre message"
            aria-invalid={tooLong || undefined}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) submit(e);
            }}
            className="max-h-40 resize-none"
          />
          <p className={cn("mt-1 text-right text-[11px]", tooLong ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
            {tooLong ? `Message trop long (${body.length}/${MESSAGE_MAX_LENGTH})` : body.length > MESSAGE_MAX_LENGTH * 0.8 ? `${body.length}/${MESSAGE_MAX_LENGTH}` : "Entrée pour envoyer · Maj+Entrée pour aller à la ligne"}
          </p>
        </div>
        <Button type="submit" className="mb-5 shrink-0" disabled={!canSend} aria-label="Envoyer">
          <SendHorizontal /> <span className="hidden sm:inline">{sending ? "Envoi…" : "Envoyer"}</span>
        </Button>
      </div>
    </form>
  );
};

export default Composer;
