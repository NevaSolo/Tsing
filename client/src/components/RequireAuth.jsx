import { Link, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Button } from "./ui/button";
import BrandLoader from "./BrandLoader";

/** Protège une route : redirige vers /auth si non connecté, ou si le rôle ne correspond pas. */
const RequireAuth = ({ role, children }) => {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <BrandLoader />
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (role && user.role !== role) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4 px-4 text-center">
        <p className="font-display text-2xl">Accès réservé</p>
        <p className="text-muted-foreground">Cette page est réservée aux comptes « {role} ».</p>
        <Button asChild variant="outline">
          <Link to="/">Retour à l'accueil</Link>
        </Button>
      </div>
    );
  }

  return children;
};

export default RequireAuth;
