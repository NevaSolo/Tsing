import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, Euro, LogOut, MessageCircle, Package, Palette, Plus, Users } from "lucide-react";
import Header from "../components/Header";
import RecentConversations from "../components/messages/RecentConversations";
import OrdersTable, { orderColumns } from "../components/OrdersTable";
import { Button } from "../components/ui/button";
import { Badge, Card, EmptyState, ErrorState, PageTitle, Skeleton } from "../components/ui/feedback";
import { useAuth } from "../context/AuthContext";
import api, { getErrorMessage, isCancel } from "../lib/api";
import { formatPrice } from "../lib/format";

const COLUMNS = [
  { key: "customer", header: "Client", render: (s) => s.customer_name },
  {
    key: "product",
    header: "Produit",
    render: (s) => (
      <>
        {s.quantity} × {s.shirt_name} <span className="text-muted-foreground">({s.size})</span>
      </>
    ),
  },
  orderColumns.date,
  orderColumns.status,
  orderColumns.total("amount", "Montant", "line_total"),
];

const StatCard = ({ icon, label, value, loading }) => {
  const Icon = icon;
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-brand-soft text-brand-ink">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-sm text-muted-foreground">{label}</p>
        {loading ? <Skeleton className="mt-1 h-7 w-16" /> : <p className="font-display text-2xl">{value}</p>}
      </div>
    </Card>
  );
};

const DesignerDashboard = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sales, setSales] = useState([]);
  const [shirtCount, setShirtCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    setLoading(true);
    Promise.all([api.get("/orders/sales/", { signal }), api.get("/shirts/", { params: { mine: 1 }, signal })])
      .then(([salesRes, shirtsRes]) => {
        setSales(salesRes.data);
        setShirtCount(shirtsRes.data.length);
        setError("");
        setLoading(false);
      })
      .catch((err) => {
        if (isCancel(err)) return;
        setError(getErrorMessage(err, "Impossible de charger vos ventes."));
        setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const stats = useMemo(
    () => ({
      inProgress: sales.filter((s) => ["paid", "shipped"].includes(s.status)).length,
      revenue: sales.filter((s) => s.status !== "cancelled").reduce((sum, s) => sum + Number(s.line_total), 0),
      customers: new Set(sales.map((s) => s.customer_name)).size,
    }),
    [sales]
  );

  const handleLogout = () => {
    navigate("/auth", { replace: true, state: null });
    logout();
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <main className="mx-auto w-full max-w-[1280px] px-4 pb-16 pt-[104px] md:px-8">
        <PageTitle
          subtitle={`Espace designer · ${user?.name || user?.email}`}
          actions={
            <>
              <Button asChild>
                <Link to="/customizer">
                  <Plus /> Nouveau t-shirt
                </Link>
              </Button>
              <Button variant="outline" onClick={handleLogout}>
                <LogOut /> Déconnexion
              </Button>
            </>
          }
        >
          Tableau de bord
        </PageTitle>

        {location.state?.message && (
          <p className="mb-8 flex items-center gap-2 rounded-[var(--radius-card)] bg-success-soft p-4 text-success" role="status">
            <CheckCircle2 className="size-5 shrink-0" aria-hidden="true" />
            {location.state.message}
          </p>
        )}

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Palette} label="Créations publiées" value={shirtCount} loading={loading} />
          <StatCard icon={Package} label="Ventes en cours" value={stats.inProgress} loading={loading} />
          <StatCard icon={Euro} label="Chiffre d'affaires" value={formatPrice(stats.revenue)} loading={loading} />
          <StatCard icon={Users} label="Clients" value={stats.customers} loading={loading} />
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <Card className="p-6 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="font-display text-2xl">Ventes récentes</h2>
              <Button asChild variant="link" className="px-0">
                <Link to="/archive">Mes créations ({shirtCount})</Link>
              </Button>
            </div>
            {error ? (
              <ErrorState description={error} onRetry={() => setReloadKey((k) => k + 1)} />
            ) : (
              <OrdersTable
                caption="Ventes récentes"
                rows={sales}
                columns={COLUMNS}
                loading={loading}
                empty={
                  <EmptyState
                    icon={Package}
                    title="Aucune vente pour le moment"
                    description="Publiez des créations : vos ventes apparaîtront ici."
                  />
                }
              />
            )}
          </Card>

          <RecentConversations emptyText="Vos clients pourront vous écrire depuis vos créations et la page Designers." />
        </div>
      </main>
    </div>
  );
};

export default DesignerDashboard;
