import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CreditCard, Info, Lock, ShoppingBag } from "lucide-react";
import { useCart } from "../context/CartContext";
import { dashboardPath, useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { Button } from "../components/ui/button";
import { Card, EmptyState, PageTitle } from "../components/ui/feedback";
import { Field, Input } from "../components/ui/form";
import Header from "../components/Header";
import api, { getErrorMessage } from "../lib/api";
import { formatPrice } from "../lib/format";
import { goToPayment, paymentsApi, pendingOrder } from "../lib/payments";

const FIELDS = [
  { name: "fullName", label: "Nom complet", autoComplete: "name", span: 2 },
  { name: "email", label: "Email", autoComplete: "email", type: "email", span: 2 },
  { name: "address", label: "Adresse", autoComplete: "street-address", span: 2 },
  { name: "postalCode", label: "Code postal", autoComplete: "postal-code", span: 1 },
  { name: "city", label: "Ville", autoComplete: "address-level2", span: 1 },
  { name: "country", label: "Pays", autoComplete: "country-name", span: 2 },
];

const Checkout = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { cart, getTotalPrice, clearCart } = useCart();
  const [formData, setFormData] = useState({
    email: user?.email ?? "",
    fullName: user?.name ?? "",
    address: "",
    city: "",
    postalCode: "",
    country: "France",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  // « stripe » : paiement par carte sur la page sécurisée de Stripe ; « demo » : paiement simulé (aucune clé).
  const [payment, setPayment] = useState(null);
  useEffect(() => {
    paymentsApi.config().then(setPayment).catch(() => setPayment({ mode: "demo", test_mode: false }));
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // Retour depuis Stripe sans avoir payé, même panier : on reprend la commande déjà réservée.
      const pendingId = payment?.mode === "stripe" ? pendingOrder.get(cart) : null;
      if (pendingId) {
        try {
          await goToPayment(pendingId);
          return;
        } catch (err) {
          // Seulement si elle n'est plus payable (payée, annulée, introuvable) : nouvelle commande.
          // Toute autre erreur (Stripe indisponible…) est affichée, sans réserver le stock une 2e fois.
          if (![404, 409].includes(err?.response?.status)) throw err;
          pendingOrder.clear();
        }
      }
      const { data: order } = await api.post("/orders/", {
        customer_name: formData.fullName,
        email: formData.email,
        address: formData.address,
        city: formData.city,
        postal_code: formData.postalCode,
        country: formData.country,
        items: cart.map((item) => ({ shirt: item.shirtId, quantity: item.quantity, size: item.size })),
      });
      if (order.status === "pending") {
        // Paiement Stripe : le panier n'est vidé qu'une fois le paiement confirmé (page de retour).
        pendingOrder.set(order.id, cart);
        await goToPayment(order.id);
        return;
      }
      clearCart();
      toast({ title: `Commande n°${order.id} confirmée`, description: `Total : ${formatPrice(order.total)}` });
      navigate(dashboardPath(user), {
        state: { message: `Commande n°${order.id} confirmée (${formatPrice(order.total)}).` },
      });
    } catch (err) {
      setError(getErrorMessage(err, "La commande n'a pas pu être enregistrée."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-[104px] md:px-8">
        <PageTitle>Finaliser la commande</PageTitle>

        {cart.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="Votre panier est vide"
            description="Ajoutez des t-shirts depuis la boutique pour passer commande."
            action={
              <Button asChild>
                <Link to="/ecommerce">Retourner à la boutique</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
            <Card className="p-6">
              <h2 className="mb-6 font-display text-2xl">Livraison</h2>
              <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                {FIELDS.map((f) => (
                  <Field key={f.name} label={f.label} className={f.span === 2 ? "col-span-2" : "col-span-2 sm:col-span-1"}>
                    {(a11y) => (
                      <Input
                        {...a11y}
                        name={f.name}
                        type={f.type ?? "text"}
                        autoComplete={f.autoComplete}
                        value={formData[f.name]}
                        onChange={handleInputChange}
                        required
                      />
                    )}
                  </Field>
                ))}

                {payment?.mode === "stripe" ? (
                  <div className="col-span-2 space-y-2 rounded-[var(--radius-control)] bg-muted p-3 text-sm">
                    <p className="flex gap-2">
                      <Lock className="mt-0.5 size-4 shrink-0 text-success" aria-hidden="true" />
                      <span>
                        Paiement par carte sur la page sécurisée de <strong>Stripe</strong> : vos données bancaires ne
                        passent pas par Tsing. Vous revenez ici une fois le paiement effectué.
                      </span>
                    </p>
                    {payment.test_mode && (
                      <p className="flex gap-2 text-info">
                        <CreditCard className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                        <span>
                          Mode test : utilisez la carte <span className="font-mono">4242 4242 4242 4242</span>, une date future
                          et n'importe quel code (aucun débit réel).
                        </span>
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="col-span-2 flex gap-2 rounded-[var(--radius-control)] bg-info-soft p-3 text-sm text-info">
                    <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    Le paiement en ligne n'est pas encore activé : la commande est enregistrée et considérée
                    comme payée (mode démonstration).
                  </p>
                )}

                {error && (
                  <p className="col-span-2 rounded-[var(--radius-control)] bg-brand-soft p-3 text-sm text-destructive" role="alert">
                    {error}
                  </p>
                )}

                <Button type="submit" size="lg" disabled={submitting || !payment} className="col-span-2">
                  {payment?.mode === "stripe" && <Lock />}
                  {submitting
                    ? payment?.mode === "stripe"
                      ? "Redirection vers le paiement…"
                      : "Validation en cours..."
                    : payment?.mode === "stripe"
                      ? `Payer ${formatPrice(getTotalPrice())}`
                      : `Valider la commande · ${formatPrice(getTotalPrice())}`}
                </Button>
              </form>
            </Card>

            <Card as="aside" className="h-fit bg-muted/40 p-6" aria-label="Résumé de la commande">
              <h2 className="mb-4 font-display text-2xl">Résumé</h2>
              <ul className="divide-y divide-border">
                {cart.map((item) => (
                  <li key={item.key} className="flex items-center gap-4 py-3">
                    <span
                      className="size-10 shrink-0 rounded-full border border-border"
                      style={{ backgroundColor: item.color }}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{item.name}</p>
                      <p className="text-sm text-muted-foreground">
                        Taille {item.size} · Qté {item.quantity}
                      </p>
                    </div>
                    <span className="font-medium tabular-nums">{formatPrice(item.price * item.quantity)}</span>
                  </li>
                ))}
              </ul>
              <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Sous-total</dt>
                  <dd className="tabular-nums">{formatPrice(getTotalPrice())}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Livraison</dt>
                  <dd>Gratuite</dd>
                </div>
                <div className="flex justify-between border-t border-border pt-2 text-lg font-semibold">
                  <dt>Total</dt>
                  <dd className="tabular-nums">{formatPrice(getTotalPrice())}</dd>
                </div>
              </dl>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};

export default Checkout;
