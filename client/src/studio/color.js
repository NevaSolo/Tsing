/* Utilitaires de couleur : conversions, contraste WCAG, harmonies. Fonctions pures (testées avec node --test). */

export function normalizeHex(hex) {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "").toLowerCase();
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return /^[0-9a-f]{6}$/.test(h) ? `#${h}` : null;
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex) ?? "#000000";
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

export function rgbToHex([r, g, b]) {
  return `#${[r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("")}`;
}

export function rgbToHsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

export function hslToRgb([h, s, l]) {
  h = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return [l * 255, l * 255, l * 255];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [hue(h + 1 / 3) * 255, hue(h) * 255, hue(h - 1 / 3) * 255];
}

export const hexToHsl = (hex) => rgbToHsl(hexToRgb(hex));
export const hslToHex = (hsl) => rgbToHex(hslToRgb(hsl));

/** Luminance relative WCAG 2.x. */
export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Ratio de contraste WCAG (1 à 21). */
export function contrastRatio(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Noir ou blanc, celui qui contraste le mieux avec le fond. */
export const bestOnColor = (bg) => (contrastRatio("#111111", bg) >= contrastRatio("#ffffff", bg) ? "#111111" : "#ffffff");

/**
 * Ajuste la luminosité de `color` jusqu'à atteindre `min` de contraste avec `bg`
 * (garde la teinte ; à défaut renvoie noir ou blanc).
 */
export function ensureContrast(color, bg, min = 3) {
  if (contrastRatio(color, bg) >= min) return normalizeHex(color);
  const [h, s, l] = hexToHsl(color);
  const goDark = luminance(bg) > 0.4;
  for (let step = 1; step <= 20; step++) {
    const nl = goDark ? l - (l * step) / 20 : l + ((1 - l) * step) / 20;
    const candidate = hslToHex([h, s, nl]);
    if (contrastRatio(candidate, bg) >= min) return candidate;
  }
  return bestOnColor(bg);
}

export const rotateHue = (hex, deg) => {
  const [h, s, l] = hexToHsl(hex);
  return hslToHex([h + deg, s, l]);
};

export const withLightness = (hex, l) => {
  const [h, s] = hexToHsl(hex);
  return hslToHex([h, s, l]);
};
