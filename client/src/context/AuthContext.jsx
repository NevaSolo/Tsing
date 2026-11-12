import { createContext, useCallback, useContext, useEffect, useState } from "react";
import api, { tokens } from "../lib/api";

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  // true tant que l'on vérifie un éventuel jeton existant au démarrage.
  const [loading, setLoading] = useState(Boolean(tokens.access));

  const fetchMe = useCallback(async () => {
    const { data } = await api.get("/me/");
    setUser(data);
    return data;
  }, []);

  useEffect(() => {
    if (tokens.access) {
      fetchMe()
        .catch(() => tokens.clear())
        .finally(() => setLoading(false));
    }
    const onLogout = () => setUser(null);
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, [fetchMe]);

  const login = useCallback(
    async (email, password) => {
      const { data } = await api.post("/token/", {
        username: email.trim().toLowerCase(),
        password,
      });
      tokens.set(data);
      return fetchMe();
    },
    [fetchMe]
  );

  const register = useCallback(
    async ({ name, email, password, role }) => {
      await api.post("/register/", { name, email, password, role });
      return login(email, password);
    },
    [login]
  );

  const logout = useCallback(() => {
    tokens.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};

export const dashboardPath = (user) =>
  user?.role === "designer" ? "/dashboard/designer" : "/dashboard/client";

/** Pages réservées à un type de compte (mêmes règles que les <RequireAuth role=…> de App.jsx). */
const ROLE_ONLY = [
  ["/dashboard/designer", "designer"],
  ["/customizer", "designer"],
  ["/archive", "designer"],
  ["/dashboard/client", "client"],
];

/** Ce compte peut-il ouvrir cette page ? (sert à ne pas renvoyer un designer vers l'espace client, et inversement) */
export const canVisit = (path, user) => {
  const rule = ROLE_ONLY.find(([prefix]) => path === prefix || path.startsWith(`${prefix}/`));
  return !rule || user?.role === rule[1];
};
