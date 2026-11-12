import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, MessageCircle, Palette } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import Header from "../components/Header";
import Footer from "../layout/Footer";
import ShirtPreview from "../components/ShirtPreview";
import { Button } from "../components/ui/button";
import { Card, EmptyState, ErrorState, PageTitle, Skeleton } from "../components/ui/feedback";
import api, { getErrorMessage, isCancel } from "../lib/api";
import { formatPrice } from "../lib/format";

const initials = (name) =>
  name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

/** Designers déduits des t-shirts publiés (aucune donnée fictive). */
const Designers = () => {
  const { user } = useAuth();
  const [shirts, setShirts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    api
      .get("/shirts/", { signal: controller.signal })
      .then(({ data }) => {
        setShirts(data);
        setError("");
        setLoading(false);
      })
      .catch((err) => {
        if (isCancel(err)) return;
        setError(getErrorMessage(err, "Impossible de charger les designers."));
        setLoading(false);
      });
    return () => controller.abort();
  }, [reloadKey]);

  const designers = useMemo(() => {
    const byId = new Map();
    for (const shirt of shirts) {
      if (!shirt.designer) continue;
      const entry = byId.get(shirt.designer) ?? { id: shirt.designer, name: shirt.designer_name ?? "Designer", shirts: [] };
      entry.shirts.push(shirt);
      byId.set(shirt.designer, entry);
    }
    return [...byId.values()].sort((a, b) => b.shirts.length - a.shirts.length);
  }, [shirts]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 pb-16 pt-[104px] md:px-8">
        <PageTitle
          subtitle="Les créateurs qui publient leurs t-shirts sur Tsing."
          actions={
            <Button asChild variant="outline-brand">
              <Link to="/auth?role=designer">Devenir designer</Link>
            </Button>
          }
        >
          Nos designers
        </PageTitle>

        {error ? (
          <ErrorState description={error} onRetry={() => setReloadKey((k) => k + 1)} />
        ) : loading ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
        ) : designers.length === 0 ? (
          <EmptyState
            icon={Palette}
            title="Aucun designer pour le moment"
            description="Soyez le premier à publier vos créations sur Tsing."
            action={
              <Button asChild>
                <Link to="/auth?role=designer">Devenir designer</Link>
              </Button>
            }
          />
        ) : (
          <ul className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {designers.map((designer) => {
              const prices = designer.shirts.map((s) => Number(s.price));
              return (
                <li key={designer.id}>
                  <Card className="flex h-full flex-col p-6">
                    <div className="flex items-center gap-4">
                      <span
                        className="flex size-14 shrink-0 items-center justify-center rounded-full bg-brand font-display text-xl text-white"
                        aria-hidden="true"
                      >
                        {initials(designer.name)}
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate font-display text-xl">{designer.name}</h2>
                        <p className="text-sm text-muted-foreground">
                          {designer.shirts.length} création{designer.shirts.length > 1 ? "s" : ""} · dès{" "}
                          {formatPrice(Math.min(...prices))}
                        </p>
                      </div>
                    </div>
                    <ul className="mt-5 grid grid-cols-3 gap-2" aria-label={`Créations de ${designer.name}`}>
                      {designer.shirts.slice(0, 3).map((shirt) => (
                        <li key={shirt.id}>
                          <Link
                            to={`/ecommerce/${shirt.id}`}
                            className="block aspect-square overflow-hidden rounded-[var(--radius-control)] bg-muted"
                          >
                            <ShirtPreview shirt={shirt} className="h-full w-full" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-5 grid gap-2 sm:grid-cols-2">
                      <Button asChild variant="outline">
                        <Link to={`/ecommerce?designer=${designer.id}`}>
                          Ses créations <ArrowRight />
                        </Link>
                      </Button>
                      {user?.id !== designer.id && (
                        <Button asChild>
                          <Link to={`/chat/${designer.id}`} aria-label={`Contacter ${designer.name}`}>
                            <MessageCircle /> Contacter
                          </Link>
                        </Button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Designers;
