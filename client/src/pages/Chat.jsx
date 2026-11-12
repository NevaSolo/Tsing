import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import Header from "../components/Header";
import Composer from "../components/messages/Composer";
import { Button } from "../components/ui/button";
import { Card, EmptyState, ErrorState, PageLoader } from "../components/ui/feedback";
import { useToast } from "../context/ToastContext";
import api, { getErrorMessage, isCancel } from "../lib/api";
import { initials, messagesApi } from "../lib/messages";

/**
 * « Contacter le designer » : /chat/:designerId?shirt=<id>.
 * Conversation déjà ouverte → on y va directement ; sinon, premier message (design joint si on vient d'un t-shirt).
 */
const Chat = () => {
  const { designerId } = useParams();
  const [searchParams] = useSearchParams();
  const shirtId = searchParams.get("shirt");
  const navigate = useNavigate();
  const { toast } = useToast();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState(null);

  useEffect(() => {
    const controller = new AbortController();
    messagesApi
      .contact(designerId, controller.signal)
      .then(setInfo)
      .catch((err) => {
        if (isCancel(err)) return;
        setError(err?.response?.status === 404 ? "Ce designer est introuvable." : getErrorMessage(err, "Impossible d'ouvrir la conversation."));
      });
    return () => controller.abort();
  }, [designerId]);

  useEffect(() => {
    if (!shirtId) return;
    const controller = new AbortController();
    api
      .get(`/shirts/${shirtId}/`, { signal: controller.signal })
      .then(({ data }) => setAttachment(data))
      .catch(() => {});
    return () => controller.abort();
  }, [shirtId]);

  if (info?.conversation) {
    return <Navigate to={`/messages/${info.conversation}${shirtId ? `?shirt=${shirtId}` : ""}`} replace />;
  }

  const send = async ({ body, shirt }) => {
    try {
      const conversation = await messagesApi.start({ designer: Number(designerId), body, ...(shirt ? { shirt } : {}) });
      navigate(`/messages/${conversation.id}`, { replace: true });
    } catch (err) {
      toast({ title: "Message non envoyé", description: getErrorMessage(err, "Réessayez dans un instant."), variant: "error" });
      throw err;
    }
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <main className="mx-auto w-full max-w-2xl px-4 pb-16 pt-[104px]">
        {error ? (
          <ErrorState description={error} onRetry={() => window.location.reload()} />
        ) : !info ? (
          <PageLoader />
        ) : info.self ? (
          <Card>
            <EmptyState
              icon={MessageCircle}
              title="C'est votre propre page"
              description="Vos clients vous écrivent depuis vos créations ; retrouvez leurs messages dans votre messagerie."
              action={
                <Button asChild>
                  <Link to="/messages">Ma messagerie</Link>
                </Button>
              }
            />
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Retour">
                <ArrowLeft />
              </Button>
              <span className="flex size-10 items-center justify-center rounded-full bg-brand font-display text-sm text-white" aria-hidden="true">
                {initials(info.designer.name)}
              </span>
              <div>
                <h1 className="font-medium">Écrire à {info.designer.name}</h1>
                <p className="text-xs text-muted-foreground">Designer · réponse dans sa messagerie Tsing</p>
              </div>
            </header>
            <p className="px-4 py-6 text-sm text-muted-foreground">
              Présentez votre projet : modèle souhaité, couleurs, quantité, délai… {attachment ? "Le design ci-dessous sera joint à votre message." : ""}
            </p>
            <Composer
              onSend={send}
              attachment={attachment}
              onAttachmentChange={setAttachment}
              placeholder={attachment ? `Bonjour, je suis intéressé(e) par « ${attachment.name} »…` : "Bonjour, j'aimerais un t-shirt…"}
              autoFocus
            />
          </Card>
        )}
      </main>
    </div>
  );
};

export default Chat;
