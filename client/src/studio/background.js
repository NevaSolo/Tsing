/*
 * Géométrie partagée par le moteur et le vérificateur : largeur des textes, boîtes (avec rotation),
 * fond réel sous un calque. Fonctions pures (le canvas n'est utilisé que s'il existe, sinon estimation).
 */
import { normalizeHex } from "./color.js";
import { canvasFont } from "../canvas/utils/fonts.js";
import { layerAspect } from "./motifs.js";

const TEX = 1024;

// ------------------------------------------------------------------ Largeur des textes

/** Largeur moyenne d'un caractère (fraction de la taille), en gras — utilisée hors navigateur (tests). */
const CHAR_WIDTH = {
  "Bebas Neue": 0.42, Oswald: 0.5, Impact: 0.52, Jaro: 0.55, Helvetica: 0.62, Arial: 0.62,
  "Playfair Display": 0.6, Georgia: 0.6, Pacifico: 0.62, "Permanent Marker": 0.64,
  Lobster: 0.5, "Dancing Script": 0.5, Caveat: 0.46, "Indie Flower": 0.56, "Shadows Into Light": 0.5,
  Merriweather: 0.64, Montserrat: 0.68, Quicksand: 0.6, Raleway: 0.62, Orbitron: 0.78,
};
// Les majuscules sont nettement plus larges que la moyenne (mesuré sur Arial gras : ≈ 0,72 em).
const UPPERCASE_FACTOR = 1.2;

export const charWidth = (font) => CHAR_WIDTH[font] ?? 0.62;

let measureCtx;
function canvasContext() {
  if (measureCtx !== undefined) return measureCtx;
  try {
    measureCtx = typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  } catch {
    measureCtx = null;
  }
  return measureCtx;
}

/** Largeur d'un texte en px de texture : mesure réelle dans le navigateur, estimation sinon. */
export function textWidthPx(text = "", size = 40, font = "Arial") {
  if (!text) return 0;
  const ctx = canvasContext();
  if (ctx) {
    ctx.font = canvasFont(size, font);
    return ctx.measureText(text).width;
  }
  const letters = [...text].filter((c) => /\p{L}/u.test(c));
  const upperShare = letters.length ? letters.filter((c) => c === c.toLocaleUpperCase("fr-FR") && c !== c.toLocaleLowerCase("fr-FR")).length / letters.length : 0;
  const factor = 1 + (UPPERCASE_FACTOR - 1) * upperShare;
  return [...text].length * size * charWidth(font) * factor;
}

// ------------------------------------------------------------------ Boîtes

/** Dimensions (uv) d'un calque forme/texte/motif, sans rotation (texte en arc : boîte approchée). */
export function layerSize(layer) {
  if (layer.type === "text" && layer.arc) {
    const { chord, sag } = arcGeometry(layer);
    return { w: Math.max(chord, layer.size) / TEX, h: (layer.size + 2 * sag) / TEX };
  }
  if (layer.type === "motif") return { w: layer.size / TEX, h: (layer.size * layerAspect(layer)) / TEX };
  const w = (layer.type === "text" ? textWidthPx(layer.text, layer.size, layer.font) : layer.size) / TEX;
  const h = (layer.type === "shape" && layer.shape === "rect" ? layer.size * 0.7 : layer.size) / TEX;
  return { w, h };
}

/**
 * Texte courbé : `arc` = rayon (px). arc > 0 : texte en haut d'un cercle (centre en dessous) ;
 * arc < 0 : texte en bas (centre au-dessus), lisible à l'endroit. (x, y) = milieu du texte.
 */
export function arcGeometry(layer) {
  const r = Math.max(1, Math.abs(layer.arc));
  const theta = Math.min(textWidthPx(layer.text, layer.size, layer.font) / r, Math.PI * 1.9);
  const half = theta / 2;
  return {
    r,
    theta,
    top: layer.arc > 0,
    sag: r * (1 - Math.cos(Math.min(half, Math.PI))),
    chord: half >= Math.PI / 2 ? 2 * r : 2 * r * Math.sin(half),
  };
}

/** Points (uv) le long d'un texte courbé, aux rayons intérieur/extérieur des lettres (rotation comprise). */
function arcPoints(layer, radii) {
  const { r, theta, top } = arcGeometry(layer);
  const t = ((layer.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const pts = [];
  for (const k of [-1, -0.5, 0, 0.5, 1]) {
    const a = top ? -Math.PI / 2 + (k * theta) / 2 : Math.PI / 2 - (k * theta) / 2;
    for (const rr of radii(r)) {
      const dx = Math.cos(a) * rr;
      const dy = (top ? r : -r) + Math.sin(a) * rr;
      pts.push([layer.x + (dx * cos - dy * sin) / TEX, layer.y + (dx * sin + dy * cos) / TEX]);
    }
  }
  return pts;
}

/** Coins (uv) du rectangle w×h centré sur le calque, rotation appliquée (même sens que ctx.rotate). */
export function rotatedCorners(layer, w, h) {
  const t = ((layer.rotation ?? 0) * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sy]) => {
    const dx = (sx * w) / 2;
    const dy = (sy * h) / 2;
    return [layer.x + dx * c - dy * s, layer.y + dx * s + dy * c];
  });
}

/** Points caractéristiques d'un calque (uv) : centre + coins tournés, ou points du trait. */
export function layerSamplePoints(layer) {
  if (layer.type === "path") return layer.points.filter(Boolean).map(([u, v]) => [u, v]);
  if (layer.type === "trim") return [];
  if (layer.type === "text" && layer.arc) return [[layer.x, layer.y], ...arcPoints(layer, (r) => [r - layer.size / 2, r + layer.size / 2])];
  const { w, h } = layerSize(layer);
  return [[layer.x, layer.y], ...rotatedCorners(layer, w, h)];
}

/** Boîte englobante (uv) d'un calque, rotation comprise : { u0, v0, u1, v1 }. */
export function layerBox(layer) {
  const pts = layerSamplePoints(layer);
  if (!pts.length) return { u0: 0, v0: 0, u1: 0, v1: 0 }; // bordure : aucune emprise dans la zone
  const pad = layer.type === "path" ? layer.width / 2 / TEX : 0;
  return {
    u0: Math.min(...pts.map((p) => p[0])) - pad,
    v0: Math.min(...pts.map((p) => p[1])) - pad,
    u1: Math.max(...pts.map((p) => p[0])) + pad,
    v1: Math.max(...pts.map((p) => p[1])) + pad,
  };
}

/** Aire de l'intersection de deux boîtes (uv²). */
export function overlapArea(a, b) {
  const w = Math.min(a.u1, b.u1) - Math.max(a.u0, b.u0);
  const h = Math.min(a.v1, b.v1) - Math.max(a.v0, b.v0);
  return w > 0 && h > 0 ? w * h : 0;
}

export const boxArea = (b) => Math.max(0, b.u1 - b.u0) * Math.max(0, b.v1 - b.v0);

// ------------------------------------------------------------------ Fond réel

/** true si le point (u, v) est couvert par la forme pleine `shape` (rotation prise en compte). */
function shapeCovers(shape, u, v) {
  const theta = -((shape.rotation ?? 0) * Math.PI) / 180;
  const dx = (u - shape.x) * TEX;
  const dy = (v - shape.y) * TEX;
  const lx = dx * Math.cos(theta) - dy * Math.sin(theta);
  const ly = dx * Math.sin(theta) + dy * Math.cos(theta);
  const halfW = shape.size / 2;
  const halfH = (shape.shape === "rect" ? shape.size * 0.7 : shape.size) / 2;
  // Pour un cercle, on reste dans le disque inscrit.
  if (shape.shape === "circle") return Math.hypot(lx, ly) <= halfW * 0.92;
  return Math.abs(lx) <= halfW * 0.8 && Math.abs(ly) <= halfH * 0.8;
}

/** Couleur sous le point (u, v) pour un calque situé à l'index `index` (formes pleines en dessous, sinon t-shirt). */
function colorBelow(layers, index, u, v, shirt) {
  for (let i = index - 1; i >= 0; i--) {
    const below = layers[i];
    if (below.type === "shape" && below.filled && shapeCovers(below, u, v)) return normalizeHex(below.color) ?? shirt;
  }
  return shirt;
}

/** Points de contrôle du fond : centre (forme), centre + extrémités (texte), barycentre (trait). */
function backgroundProbes(layer) {
  if (layer.type === "path") {
    const pts = layer.points.filter(Boolean);
    if (!pts.length) return [];
    return [[pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length]];
  }
  if (layer.type === "trim") return [];
  if (layer.type !== "text") return [[layer.x, layer.y]];
  if (layer.arc) return arcPoints(layer, (r) => [r]).filter((_, i) => i % 2 === 0);
  const { w } = layerSize(layer);
  const t = ((layer.rotation ?? 0) * Math.PI) / 180;
  const ex = (w / 2) * 0.9 * Math.cos(t);
  const ey = (w / 2) * 0.9 * Math.sin(t);
  return [[layer.x, layer.y], [layer.x - ex, layer.y - ey], [layer.x + ex, layer.y + ey]];
}

/** Tous les fonds (distincts) sous le calque `index` — un texte peut déborder d'un disque sur le t-shirt. */
export function backgroundsUnder(layers, index, shirt) {
  const probes = backgroundProbes(layers[index]);
  if (!probes.length) return [shirt];
  return [...new Set(probes.map(([u, v]) => colorBelow(layers, index, u, v, shirt)))];
}

/** Fond principal (au centre) du calque `index`. */
export function backgroundAt(layers, index, shirt) {
  return backgroundsUnder(layers, index, shirt)[0];
}
