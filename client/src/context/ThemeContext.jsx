import { createContext, useCallback, useContext, useEffect, useState } from "react";

/*
 * Thème clair / sombre / système.
 * - Le choix est mémorisé (localStorage « theme ») ; « system » suit le réglage de l'appareil, en direct.
 * - La classe `dark` est posée sur <html> ; le script en tête d'index.html l'applique AVANT le rendu
 *   pour éviter un flash blanc au chargement en mode sombre (garder les deux en cohérence).
 */
export const THEME_STORAGE_KEY = "theme";
const MODES = ["light", "dark", "system"];
const THEME_COLORS = { light: "#a40000", dark: "#121214" };

const ThemeContext = createContext(null);

const systemPrefersDark = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches;

const readStoredMode = () => {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return MODES.includes(value) ? value : "system";
  } catch {
    return "system";
  }
};

function applyResolved(resolved) {
  const root = document.documentElement;
  root.classList.toggle("dark", resolved === "dark");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[resolved]);
}

export const ThemeProvider = ({ children }) => {
  const [mode, setModeState] = useState(readStoredMode);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);
  const resolved = mode === "system" ? (systemDark ? "dark" : "light") : mode;

  // Suit le réglage de l'appareil en direct (utile en mode « système »).
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return;
    const onChange = (e) => setSystemDark(e.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => applyResolved(resolved), [resolved]);

  // Synchronise les autres onglets ouverts.
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === THEME_STORAGE_KEY) setModeState(MODES.includes(e.newValue) ? e.newValue : "system");
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setMode = useCallback((next) => {
    if (!MODES.includes(next)) return;
    setModeState(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* stockage indisponible (navigation privée) : le choix vaut pour la session */
    }
  }, []);

  return <ThemeContext.Provider value={{ mode, resolved, setMode }}>{children}</ThemeContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
