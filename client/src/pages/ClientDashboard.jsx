import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, CreditCard, LogOut, Package, ShoppingBag, Users } from "lucide-react";
import Header from "../components/Header";
import RecentConversations from "../components/messages/RecentConversations";
import OrdersTable, { orderColumns } from "../components/OrdersTable";
import { Button } from "../components/ui/button";
import { Card, EmptyState, ErrorState, PageTitle } from "../components/ui/feedback";
import { useAuth } from "../context/AuthContext";
import api, { getErrorMessage, isCancel } from "../lib/api";
import { useToast } from "../context/ToastContext";
import { goToPayment, paymentsApi } from "../lib/payments";

const COLUMNS = [
  { key: "id", header: "Commande", render: (o) => `n°${o.id}` },
  {
    key: "items",
    header: "Articles",
    render: (o) => (
      <ul className="space-y-0.5">
        {o.items.map((item) => (
          <li key={item.id}>
            {item.quantity} × {item.shirt_name} <span className="text-muted-foreground">({item.size})</span>
          </li>
        ))}
      </ul>
    ),
  },
  orderColumns.date,
  orderColumns.status,
  orderColumns.total("total", "Total", "total"),
];

const ClientDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const { toast } = useToast();
  const [busyOrder, setBusyOrder] = useState(null);

  // Commande en attente de paiement : la payer (Stripe) ou l'annuler (stock libéré).
  const orderAction = (order, kind) => async () => {
    setBusyOrder(order.id);
    try {
      if (kind === "pay") await goToPayment(order.id);
      else {
        await paymentsApi.cancel(order.id);
        toast({ title: `Commande n°${order.id} annulée` });
        setReloadKey((k) => k + 1);
      }
    } catch (err) {
      toast({ title: "Action impossible", description: getErrorMessage(err), variant: "error" });
      setReloadKey((k) => k + 1);
    } finally {
      setBusyOrder(null);
    }
  };
  const columns = useMemo(
    () => [
      ...COLUMNS,
      {
        key: "actions",
        header: <span className="sr-only">Actions</span>,
        align: "right",
        render: (o) =>
          o.status === "pending" ? (
            <span className="inline-flex gap-1.5">
              <Button size="sm" onClick={orderAction(o, "pay")} disabled={busyOrder === o.id}>
                <CreditCard /> Payer
              </Button>
              <Button size="sm" variant="ghost" onClick={orderAction(o, "cancel")} disabled={busyOrder === o.id} aria-label={`Annuler la commande n°${o.id}`}>
                Annuler
              </Button>
            </span>
          ) : null,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [busyOrder]
  );

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .get("/orders/", { signal: controller.signal })
      .then(({ data }) => {
        setOrders(data);
        setError("");
        setLoading(false);
      })
      .catch((err) => {
        if (isCancel(err)) return;
        setError(getErrorMessage(err, "Impossible de charger vos commandes."));
        setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const handleLogout = () => {
    navigate("/auth", { replace: true, state: null });
    logout();
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-[104px] md:px-8">
        <PageTitle
          subtitle="Votre espace client"
          actions={
            <Button variant="outline" onClick={handleLogout}>
              <LogOut /> Déconnexion
            </Button>
          }
        >
          Bonjour {user?.name || user?.email}
        </PageTitle>

        {location.state?.message && (
          <p className="mb-8 flex items-center gap-2 rounded-[var(--radius-card)] bg-success-soft p-4 text-success" role="status">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
            {location.state.message}
          </p>
        )}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[
            { to: "/ecommerce", icon: ShoppingBag, title: "Boutique", text: "Découvrir les nouveaux t-shirts" },
            { to: "/designers", icon: Users, title: "Designers", text: "Explorer les créateurs" },
          ].map(({ to, icon, title, text }) => {
            const Icon = icon;
            return (
              <Card key={to} className="transition-shadow hover:shadow-[var(--shadow-card-hover)]">
                <Link to={to} className="flex items-center gap-4 p-5">
                  <span className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
                    <Icon className="size-6" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-display text-lg">{title}</span>
                    <span className="text-sm text-muted-foreground">{text}</span>
                  </span>
                </Link>
              </Card>
            );
          })}
        </div>

        <div className="mb-8">
          <RecentConversations emptyText="Écrivez à un designer depuis sa page ou un t-shirt pour une demande sur mesure." />
        </div>

        <Card className="p-6">
          <h2 className="mb-4 font-display text-2xl">Mes commandes</h2>
          {error ? (
            <ErrorState description={error} onRetry={() => setReloadKey((k) => k + 1)} />
          ) : (
            <OrdersTable
              caption="Mes commandes"
              rows={orders}
              columns={columns}
              loading={loading}
              empty={
                <EmptyState
                  icon={Package}
                  title="Aucune commande pour le moment"
                  description="Vos commandes apparaîtront ici dès votre premier achat."
                  action={
                    <Button asChild>
                      <Link to="/ecommerce">Voir la boutique</Link>
                    </Button>
                  }
                />
              }
            />
          )}
        </Card>
      </main>
    </div>
  );
};

export default ClientDashboard;
