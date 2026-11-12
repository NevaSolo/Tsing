import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Clock, CreditCard, ShoppingBag, XCircle } from "lucide-react";
import Header from "../components/Header";
import { Button } from "../components/ui/button";
import { Card, PageLoader } from "../components/ui/feedback";
import { dashboardPath, useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useToast } from "../context/ToastContext";
import { getErrorMessage } from "../lib/api";
import { formatPrice } from "../lib/format";
import { goToPayment, paymentsApi, pendingOrder } from "../lib/payments";

const Panel = ({ icon, tone, title, children }) => {
  const Icon = icon;
  return (
    <Card className="p-8 text-center">
      <Icon className={`mx-auto size-14 ${tone}`} aria-hidden="true" />
      <h1 className="mt-4 font-display text-3xl">{title}</h1>
      <div className="mt-3 space-y-4 text-muted-foreground">{children}</div>
    </Card>
  );
};

/**
 * Retour de Stripe Checkout.
 * - /checkout/success?order=<id> : on fait confirmer le paiement par le serveur (qui interroge Stripe).
 * - /checkout/cancel?order=<id>  : paiement abandonné → reprendre, modifier le panier ou annuler.
 */
const CheckoutReturn = ({ outcome }) => {
  const [params] = useSearchParams();
  const orderId = params.get("order");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { clearCart, setIsCartOpen } = useCart();
  const { toast } = useToast();
  const [order, setOrder] = useState(null);
  const [state, setState] = useState("loading"); // loading | paid | processing | pending | cancelled | error
  const [busy, setBusy] = useState(false);
  const cleared = useRef(false);

  useEffect(() => {
    if (!orderId) {
      setState("error");
      return undefined;
    }
    let stopped = false;
    let attempts = 0;
    const check = async () => {
      try {
        const data = await paymentsApi.confirm(orderId);
        if (stopped) return;
        setOrder(data);
        if (data.status === "pending" && outcome === "success" && attempts++ < 10) {
          // Paiement validé chez Stripe mais pas encore confirmé (quelques secondes) : on revérifie.
          setState("processing");
          setTimeout(check, 2000);
          return;
        }
        setState(data.status === "pending" ? (outcome === "success" ? "processing" : "pending") : data.status === "cancelled" ? "cancelled" : "paid");
      } catch (err) {
        if (!stopped) setState(err?.response?.status === 404 ? "error" : "error");
      }
    };
    check();
    return () => {
      stopped = true;
    };
  }, [orderId, outcome]);

  // Paiement confirmé : le panier est vidé (une seule fois).
  useEffect(() => {
    if (state === "paid" && !cleared.current) {
      cleared.current = true;
      clearCart();
      pendingOrder.clear();
    }
  }, [state, clearCart]);

  const run = (fn) => async () => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast({ title: "Action impossible", description: getErrorMessage(err), variant: "error" });
    } finally {
      setBusy(false);
    }
  };
  const retry = run(() => goToPayment(orderId));
  const cancelOrder = run(async () => {
    await paymentsApi.cancel(orderId);
    pendingOrder.clear();
    toast({ title: `Commande n°${orderId} annulée`, description: "Les articles sont toujours dans votre panier." });
    navigate("/ecommerce");
  });
  const editCart = run(async () => {
    // Modifier le panier = nouvelle commande : on libère celle-ci (son stock était réservé).
    await paymentsApi.cancel(orderId);
    pendingOrder.clear();
    navigate("/ecommerce");
    setIsCartOpen(true);
  });

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <main className="mx-auto w-full max-w-xl px-4 pb-16 pt-[112px]" aria-live="polite">
        {state === "loading" ? (
          <PageLoader label="Vérification du paiement…" />
        ) : state === "paid" ? (
          <Panel icon={CheckCircle2} tone="text-success" title="Paiement confirmé">
            <p>
              Merci ! Votre commande n°{order.id} ({formatPrice(order.total)}) est payée. Un récapitulatif est disponible dans votre
              espace.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Button asChild>
                <Link to={dashboardPath(user)}>Voir mes commandes</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/ecommerce">Continuer mes achats</Link>
              </Button>
            </div>
          </Panel>
        ) : state === "processing" ? (
          <Panel icon={Clock} tone="text-info" title="Paiement en cours de validation">
            <p>
              Stripe finalise votre paiement. Votre commande n°{orderId} passera automatiquement à « Payée » d'ici quelques instants.
            </p>
            <Button asChild variant="outline">
              <Link to={dashboardPath(user)}>Suivre ma commande</Link>
            </Button>
          </Panel>
        ) : state === "pending" ? (
          <Panel icon={CreditCard} tone="text-warning" title="Paiement non effectué">
            <p>
              Votre commande n°{orderId} ({formatPrice(order.total)}) est réservée mais pas encore payée. Vous pouvez reprendre le paiement
              tant qu'elle n'a pas expiré.
            </p>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button onClick={retry} disabled={busy}>
                <CreditCard /> Reprendre le paiement
              </Button>
              <Button variant="outline" onClick={editCart} disabled={busy}>
                <ShoppingBag /> Modifier mon panier
              </Button>
            </div>
            <Button variant="ghost" className="text-destructive" onClick={cancelOrder} disabled={busy}>
              Annuler la commande
            </Button>
          </Panel>
        ) : state === "cancelled" ? (
          <Panel icon={XCircle} tone="text-destructive" title="Commande annulée">
            <p>Le délai de paiement est dépassé ou la commande a été annulée. Les articles restent dans votre panier.</p>
            <Button asChild>
              <Link to="/checkout">Repasser commande</Link>
            </Button>
          </Panel>
        ) : (
          <Panel icon={XCircle} tone="text-destructive" title="Commande introuvable">
            <p>Ce lien de paiement ne correspond à aucune de vos commandes.</p>
            <Button asChild variant="outline">
              <Link to="/ecommerce">Retour à la boutique</Link>
            </Button>
          </Panel>
        )}
      </main>
    </div>
  );
};

export default CheckoutReturn;
