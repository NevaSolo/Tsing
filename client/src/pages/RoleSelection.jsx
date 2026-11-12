import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Palette, ShoppingBag } from "lucide-react";
import Header from "../components/Header";
import { Card, PageTitle } from "../components/ui/feedback";
import { dashboardPath, useAuth } from "../context/AuthContext";

const ROLES = [
  {
    role: "client",
    title: "Je suis client",
    text: "Découvrez des t-shirts uniques, commandez dans votre taille et suivez vos commandes.",
    icon: ShoppingBag,
  },
  {
    role: "designer",
    title: "Je suis designer",
    text: "Créez vos t-shirts en 3D, publiez-les dans la boutique et suivez vos ventes.",
    icon: Palette,
  },
];

const RoleCard = ({ role, title, text, icon }) => {
  const Icon = icon;
  return (
    <Card className="group transition-shadow hover:shadow-[var(--shadow-card-hover)]">
      <Link to={`/auth?role=${role}`} className="flex h-full flex-col items-center p-8 text-center">
        <span className="mb-6 flex size-16 items-center justify-center rounded-full bg-brand text-white">
          <Icon className="size-8" aria-hidden="true" />
        </span>
        <h2 className="font-display text-2xl">{title}</h2>
        <p className="mt-2 text-muted-foreground">{text}</p>
        <span className="mt-6 inline-flex items-center gap-2 font-medium text-brand-ink">
          Créer mon compte <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </Link>
    </Card>
  );
};

const RoleSelection = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    // Utilisateur déjà connecté : direction son tableau de bord.
    if (user) navigate(dashboardPath(user), { replace: true });
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="mx-auto w-full max-w-4xl px-4 pb-16 pt-[112px]">
        <PageTitle className="text-center sm:justify-center">Choisissez votre profil</PageTitle>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {ROLES.map((r) => (
            <RoleCard key={r.role} {...r} />
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Déjà inscrit ?{" "}
          <Link to="/auth" className="font-medium text-brand-ink hover:underline">
            Se connecter
          </Link>
        </p>
      </main>
    </div>
  );
};

export default RoleSelection;
