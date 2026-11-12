/*
 * Polices web utilisées sur le t-shirt (chargées dans index.html, avec ces graisses exactes).
 * Un canvas 2D ne redessine pas tout seul quand une police arrive : il faut attendre
 * qu'elle soit chargée avant de générer la texture, sinon le texte part en police par défaut.
 */

/** Graisse chargée pour chaque police web (demander une autre graisse = faux gras synthétisé). */
export const WEB_FONT_WEIGHTS = {
  Jaro: 400,
  "Bebas Neue": 400,
  Pacifico: 400,
  "Permanent Marker": 400,
  Lobster: 400,
  "Shadows Into Light": 400,
  "Indie Flower": 400,
  "Architects Daughter": 400,
  Oswald: 600,
  "Playfair Display": 700,
  "Dancing Script": 700,
  Raleway: 700,
  Roboto: 700,
  Montserrat: 700,
  Merriweather: 700,
  Quicksand: 700,
  Caveat: 700,
  Orbitron: 700,
};
export const WEB_FONTS = Object.keys(WEB_FONT_WEIGHTS);

/** Police CSS pour le canvas (nom entre guillemets : obligatoire pour les noms à espaces/chiffres). */
export const canvasFont = (size, family = "Arial") => {
  const name = String(family).replace(/"/g, "");
  return `${WEB_FONT_WEIGHTS[name] ?? "bold"} ${size}px "${name}", sans-serif`;
};

/** Polices utilisées par un design (calques + texte principal). */
export function fontsOf(layers = [], extra = []) {
  const set = new Set(extra.filter(Boolean));
  for (const l of layers ?? []) if (l.type === "text" && l.font) set.add(l.font);
  return [...set];
}

/** true si toutes les polices web demandées sont déjà disponibles. */
export function fontsReady(families) {
  if (typeof document === "undefined" || !document.fonts) return true;
  return families.filter((f) => f in WEB_FONT_WEIGHTS).every((f) => document.fonts.check(canvasFont(40, f)));
}

/** Attend le chargement des polices web demandées (les polices système sont ignorées). */
export function ensureFonts(families) {
  if (typeof document === "undefined" || !document.fonts) return Promise.resolve();
  const wanted = families.filter((f) => f in WEB_FONT_WEIGHTS);
  return Promise.all(wanted.map((f) => document.fonts.load(canvasFont(40, f)).catch(() => []))).then(() => undefined);
}
