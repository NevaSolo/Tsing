import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Palette, ShoppingBag } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/feedback";
import { Field, Input } from "../components/ui/form";
import Header from "../components/Header";
import { canVisit, dashboardPath, useAuth } from "../context/AuthContext";
import { getErrorMessage } from "../lib/api";
import { cn } from "../lib/utils";

const ROLES = [
  { value: "client", label: "Client", description: "J'achète des t-shirts", icon: ShoppingBag },
  { value: "designer", label: "Designer", description: "Je crée et je vends", icon: Palette },
];

const RoleOption = ({ role, checked, onSelect }) => {
  const Icon = role.icon;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={cn(
        "flex flex-col items-center gap-1 rounded-[var(--radius-control)] border p-4 text-center transition-colors",
        checked ? "border-brand bg-brand-soft text-brand-ink" : "border-input hover:border-brand"
      )}
    >
      <Icon className="size-6" aria-hidden="true" />
      <span className="font-medium">{role.label}</span>
      <span className="text-xs text-muted-foreground">{role.description}</span>
    </button>
  );
};

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user, login, register } = useAuth();
  const presetRole = searchParams.get("role");
  const [isLogin, setIsLogin] = useState(!presetRole);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    role: presetRole === "client" || presetRole === "designer" ? presetRole : "",
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Retour à la page demandée avant la connexion… seulement si ce compte y a accès
  // (sinon : un client créé après une visite de l'espace designer tombait sur « Accès réservé »).
  const redirectAfterAuth = (loggedUser) => {
    const from = location.state?.from;
    const target = from && !from.startsWith("/auth") && canVisit(from, loggedUser) ? from : dashboardPath(loggedUser);
    navigate(target, { replace: true });
  };

  // Déjà connecté : inutile de rester sur cette page.
  useEffect(() => {
    if (user && !submitting) redirectAfterAuth(user);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const update = (field) => (e) => setFormData({ ...formData, [field]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!isLogin && (!formData.name.trim() || !formData.role)) {
      setError(!formData.role ? "Choisissez un type de compte." : "Veuillez indiquer votre nom.");
      return;
    }
    if (!formData.email || !formData.password) {
      setError("Veuillez remplir tous les champs.");
      return;
    }

    setSubmitting(true);
    try {
      const loggedUser = isLogin ? await login(formData.email, formData.password) : await register(formData);
      redirectAfterAuth(loggedUser);
    } catch (err) {
      setError(isLogin && err.response?.status === 401 ? "Email ou mot de passe incorrect." : getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/40">
      <Header />
      <main className="mx-auto flex w-full max-w-md flex-col px-4 pb-16 pt-[112px]">
        <Card className="p-6 sm:p-8">
          <h1 className="text-center font-display text-3xl text-foreground">
            {isLogin ? "Connexion" : "Créer un compte"}
          </h1>
          <p className="mt-1 text-center text-sm text-muted-foreground">
            {isLogin ? "Heureux de vous revoir !" : "Rejoignez Tsing en quelques secondes."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            {!isLogin && (
              <>
                <div>
                  <p id="role-label" className="mb-1.5 text-sm font-medium">
                    Type de compte
                  </p>
                  <div role="radiogroup" aria-labelledby="role-label" className="grid grid-cols-2 gap-3">
                    {ROLES.map((role) => (
                      <RoleOption
                        key={role.value}
                        role={role}
                        checked={formData.role === role.value}
                        onSelect={() => setFormData({ ...formData, role: role.value })}
                      />
                    ))}
                  </div>
                </div>
                <Field label="Nom complet">
                  {(a11y) => <Input {...a11y} autoComplete="name" value={formData.name} onChange={update("name")} />}
                </Field>
              </>
            )}

            <Field label="Email">
              {(a11y) => (
                <Input {...a11y} type="email" autoComplete="email" value={formData.email} onChange={update("email")} />
              )}
            </Field>

            <Field label="Mot de passe" hint={isLogin ? undefined : "8 caractères minimum, pas uniquement des chiffres."}>
              {(a11y) => (
                <Input
                  {...a11y}
                  type="password"
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  value={formData.password}
                  onChange={update("password")}
                />
              )}
            </Field>

            {error && (
              <p className="rounded-[var(--radius-control)] bg-brand-soft p-3 text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button type="submit" size="lg" disabled={submitting} className="w-full">
              {submitting ? "Veuillez patienter..." : isLogin ? "Se connecter" : "Créer mon compte"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isLogin ? "Pas encore de compte ?" : "Déjà un compte ?"}{" "}
            <button
              type="button"
              className="font-medium text-brand-ink hover:underline"
              onClick={() => {
                setIsLogin(!isLogin);
                setError("");
              }}
            >
              {isLogin ? "S'inscrire" : "Se connecter"}
            </button>
          </p>
        </Card>
      </main>
    </div>
  );
};

export default Auth;
