/*
 * Bordures du t-shirt (col, manches, bas) : un calque { type: "trim", parts, color, color2, style, width }.
 * La géométrie vient du modèle 3D (trimGeometry.js, généré par scripts/extract-trims.mjs) :
 *   - col : la bande de col (pièce séparée du patron) est entièrement colorée ;
 *   - manches / bas : bande le long du bord ouvert (poignet, ourlet), découpée au contour de la pièce.
 */
import GEOMETRY from "./trimGeometry.js";

export const TRIM_PARTS = [
  { id: "collar", label: "Col" },
  { id: "sleeves", label: "Manches" },
  { id: "hem", label: "Bas" },
];
export const TRIM_PART_IDS = TRIM_PARTS.map((p) => p.id);

export const TRIM_STYLES = [
  { id: "solid", label: "Uni" },
  { id: "double", label: "Liseré deux tons" },
  { id: "stripes", label: "Rayures sport" },
];
export const TRIM_STYLE_IDS = TRIM_STYLES.map((s) => s.id);

export const DEFAULT_TRIM_WIDTH = 26;
export const TRIM_WIDTH_RANGE = [8, 60];

/** Calque bordure par défaut. */
export const createTrimLayer = ({ id = "trim", parts = TRIM_PART_IDS, color = "#a40000", color2 = "#ffffff", style = "solid", width = DEFAULT_TRIM_WIDTH } = {}) => ({
  id,
  type: "trim",
  parts: TRIM_PART_IDS.filter((p) => parts.includes(p)),
  color,
  color2,
  style: TRIM_STYLE_IDS.includes(style) ? style : "solid",
  width,
});

/** Triangles (même orientation) → une forme pleine (règle « nonzero » : leur union). */
const triPath = (tris, W, H) => {
  const path = new Path2D();
  for (const [a, b, c, d, e, f] of tris) {
    path.moveTo(a * W, b * H);
    path.lineTo(c * W, d * H);
    path.lineTo(e * W, f * H);
    path.closePath();
  }
  return path;
};
const segPath = (segs, W, H) => {
  const path = new Path2D();
  for (const [u1, v1, u2, v2] of segs) {
    path.moveTo(u1 * W, v1 * H);
    path.lineTo(u2 * W, v2 * H);
  }
  return path;
};

const cache = new Map();
const paths = (W, H) => {
  const key = `${W}x${H}`;
  if (!cache.has(key)) {
    cache.set(key, {
      collar: { fill: triPath(GEOMETRY.collar.tris, W, H), edge: segPath(GEOMETRY.collar.edges, W, H) },
      sleeves: { clip: triPath(GEOMETRY.sleeves.tris, W, H), edge: segPath(GEOMETRY.sleeves.edges, W, H) },
      hem: { clip: triPath(GEOMETRY.hem.tris, W, H), edge: segPath(GEOMETRY.hem.edges, W, H) },
    });
  }
  return cache.get(key);
};

/**
 * Bandes successives depuis le bord (fraction de la largeur, couleur) :
 * uni = une bande ; deux tons = liseré au bord puis bande ; rayures = trois bandes alternées.
 */
const BANDS = {
  solid: (c) => [[1, c.color]],
  double: (c) => [[1, c.color], [0.4, c.color2]],
  stripes: (c) => [[1, c.color], [0.66, c.color2], [0.33, c.color]],
};

/** Dessine les bordures demandées sur la texture (avant les autres calques). */
export function drawTrim(ctx, layer, W, H) {
  if (typeof Path2D === "undefined" || !layer.parts?.length) return;
  const p = paths(W, H);
  const width = Math.max(TRIM_WIDTH_RANGE[0], Math.min(TRIM_WIDTH_RANGE[1], layer.width ?? DEFAULT_TRIM_WIDTH)) * (W / 1024);
  const bands = (BANDS[layer.style] ?? BANDS.solid)(layer);
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const part of layer.parts) {
    const geo = p[part];
    if (!geo) continue;
    ctx.save();
    if (part === "collar") {
      // Bande de col entière, avec liseré(s) sur son pourtour selon le style.
      ctx.fillStyle = layer.color;
      ctx.fill(geo.fill);
      ctx.clip(geo.fill);
      for (const [f, color] of bands.slice(1)) {
        ctx.strokeStyle = color;
        ctx.lineWidth = width * 0.5 * f;
        ctx.stroke(geo.edge);
      }
    } else {
      // Trait centré sur le bord ouvert, découpé à la pièce : seule la moitié intérieure reste.
      ctx.clip(geo.clip);
      for (const [f, color] of bands) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 * width * f;
        ctx.stroke(geo.edge);
      }
    }
    ctx.restore();
  }
  ctx.restore();
}
