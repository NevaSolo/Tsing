/*
 * Calques libres de l'éditeur : traits à main levée, formes et textes.
 * Coordonnées en espace texture (u, v ∈ [0, 1]) ; tailles en pixels de texture (1024 px de côté).
 * Dans un trait, une entrée `null` marque une coupure (couture du patron franchie).
 * Motif : illustration vectorielle recalculée à partir de { motif, color, color2, accent, effects, seed }.
 * Texte : `arc` (facultatif, px) le courbe — > 0 en haut d'un cercle, < 0 en bas.
 */

import { canvasFont } from "./fonts.js";
import { cleanEffects, drawMotifLayer, ICON_MOTIF, layerAspect, MOTIF_IDS } from "../../studio/motifs.js";
import { SAFE_PATH } from "../../studio/illustrations.js";
import { drawTrim, TRIM_PART_IDS, TRIM_STYLE_IDS, TRIM_WIDTH_RANGE } from "./trims.js";
import { arcGeometry } from "../../studio/background.js";

export const SHAPES = [
  { id: "rect", label: "Rectangle" },
  { id: "circle", label: "Cercle" },
  { id: "triangle", label: "Triangle" },
  { id: "star", label: "Étoile" },
  { id: "heart", label: "Cœur" },
];
const SHAPE_IDS = new Set(SHAPES.map((s) => s.id));

/*
 * Coutures du patron : deux points voisins sur le t-shirt 3D peuvent être éloignés dans la texture.
 * On le détecte à la capture en comparant le saut en uv au déplacement réel en 3D (et non en devinant
 * à partir de la seule distance uv, ce qui coupait les traits rapides).
 */
const SEAM_UV_PER_UNIT = 4; // uv parcourus par unité de distance 3D au-delà desquels c'est une couture
const SEAM_MIN_UV = 0.02;

/** true si le passage de `prevUv` à `nextUv` traverse une couture (positions monde three.js). */
export function isSeamJump(prevUv, nextUv, prevWorld, nextWorld) {
  if (!prevUv || !prevWorld || !nextWorld) return false;
  const duv = Math.hypot(nextUv.x - prevUv.x, nextUv.y - prevUv.y);
  if (duv < SEAM_MIN_UV) return false;
  return duv > SEAM_UV_PER_UNIT * prevWorld.distanceTo(nextWorld) + SEAM_MIN_UV;
}

let counter = 0;
export const newLayerId = () => `l${Date.now().toString(36)}${(counter++).toString(36)}`;

const round = (n) => Math.round(n * 10000) / 10000;
export const roundPoint = ([u, v]) => [round(u), round(v)];

export function createShapeLayer(shape, uv, style) {
  return {
    id: newLayerId(),
    type: "shape",
    shape,
    x: round(uv.x),
    y: round(uv.y),
    size: style.size,
    rotation: 0,
    color: style.color,
    filled: style.filled,
    strokeWidth: style.width,
  };
}

export function createTextLayer(uv, style) {
  return {
    id: newLayerId(),
    type: "text",
    text: "Texte",
    x: round(uv.x),
    y: round(uv.y),
    size: Math.max(24, Math.round(style.size / 2)),
    rotation: 0,
    color: style.color,
    font: style.font ?? "Arial",
  };
}

export function createPathLayer(uv, style) {
  return { id: newLayerId(), type: "path", color: style.color, width: style.width, points: [roundPoint([uv.x, uv.y])] };
}

const lastPoint = (points) => {
  for (let i = points.length - 1; i >= 0; i--) if (points[i]) return points[i];
  return null;
};

/** Ajoute un point au trait si le pointeur a assez bougé (allège les données). `seam` insère une coupure. */
export function appendPoint(points, uv, { seam = false, minStep = 0.0015 } = {}) {
  const last = lastPoint(points);
  if (!seam && last && Math.hypot(uv.x - last[0], uv.y - last[1]) < minStep) return points;
  const next = roundPoint([uv.x, uv.y]);
  return seam ? [...points, null, next] : [...points, next];
}

// ---------------------------------------------------------------- Dessin

function shapePath(ctx, shape, r) {
  ctx.beginPath();
  switch (shape) {
    case "circle":
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      break;
    case "triangle":
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.94, r * 0.7);
      ctx.lineTo(-r * 0.94, r * 0.7);
      ctx.closePath();
      break;
    case "star":
      for (let i = 0; i < 10; i++) {
        const radius = i % 2 === 0 ? r : r * 0.45;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        ctx[i === 0 ? "moveTo" : "lineTo"](Math.cos(a) * radius, Math.sin(a) * radius);
      }
      ctx.closePath();
      break;
    case "heart":
      ctx.moveTo(0, r * 0.9);
      ctx.bezierCurveTo(-r * 1.4, -r * 0.1, -r * 0.6, -r * 1.1, 0, -r * 0.45);
      ctx.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.4, -r * 0.1, 0, r * 0.9);
      ctx.closePath();
      break;
    default: // rect
      ctx.rect(-r, -r * 0.7, r * 2, r * 1.4);
  }
}

/** Découpe un tracé en segments continus (séparés par les coupures `null`). */
function splitRuns(points) {
  const runs = [[]];
  for (const p of points) {
    if (p) runs[runs.length - 1].push(p);
    else runs.push([]);
  }
  return runs.filter((r) => r.length);
}

function drawPath(ctx, layer, W, H) {
  ctx.save();
  ctx.strokeStyle = layer.color;
  ctx.fillStyle = layer.color;
  ctx.lineWidth = layer.width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const run of splitRuns(layer.points)) {
    ctx.beginPath();
    if (run.length === 1) {
      ctx.arc(run[0][0] * W, run[0][1] * H, layer.width / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.moveTo(run[0][0] * W, run[0][1] * H);
    for (let i = 1; i < run.length; i++) ctx.lineTo(run[i][0] * W, run[i][1] * H);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShape(ctx, layer, W, H) {
  ctx.save();
  ctx.translate(layer.x * W, layer.y * H);
  ctx.rotate(((layer.rotation ?? 0) * Math.PI) / 180);
  shapePath(ctx, layer.shape, layer.size / 2);
  if (layer.filled) {
    ctx.fillStyle = layer.color;
    ctx.fill();
  } else {
    ctx.strokeStyle = layer.color;
    ctx.lineWidth = layer.strokeWidth ?? 6;
    ctx.lineJoin = "round";
    ctx.stroke();
  }
  ctx.restore();
}

function drawText(ctx, layer, W, H) {
  if (!layer.text) return;
  ctx.save();
  ctx.translate(layer.x * W, layer.y * H);
  ctx.rotate(((layer.rotation ?? 0) * Math.PI) / 180);
  ctx.fillStyle = layer.color;
  ctx.font = canvasFont(layer.size, layer.font ?? "Arial");
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (layer.arc) drawArcText(ctx, layer);
  else ctx.fillText(layer.text, 0, 0);
  ctx.restore();
}

/** Texte le long d'un cercle, lettre par lettre (repère : milieu du texte). */
function drawArcText(ctx, layer) {
  const r = Math.max(1, Math.abs(layer.arc));
  const top = layer.arc > 0;
  const chars = Array.from(layer.text);
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  ctx.translate(0, top ? r : -r); // centre du cercle
  let a = top ? -Math.PI / 2 - total / r / 2 : Math.PI / 2 + total / r / 2;
  chars.forEach((ch, i) => {
    const step = widths[i] / r;
    const mid = top ? a + step / 2 : a - step / 2;
    ctx.save();
    ctx.translate(Math.cos(mid) * r, Math.sin(mid) * r);
    ctx.rotate(top ? mid + Math.PI / 2 : mid - Math.PI / 2);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    a = top ? a + step : a - step;
  });
}

let measureCtx = null;
const textWidth = (layer) => {
  measureCtx ??= typeof document !== "undefined" ? document.createElement("canvas").getContext("2d") : null;
  if (!measureCtx) return layer.size * 0.6 * (layer.text?.length ?? 1);
  measureCtx.font = canvasFont(layer.size, layer.font ?? "Arial");
  return measureCtx.measureText(layer.text ?? "").width;
};

/**
 * Boîte englobante (px de texture). Pour une forme ou un texte, la boîte est centrée sur (x, y)
 * et exprimée SANS rotation (le cadre et le test de clic l'appliquent dans le repère tourné).
 */
export function layerBounds(layer, W, H) {
  if (layer.type === "path") {
    const pts = layer.points.filter(Boolean);
    const xs = pts.map((p) => p[0] * W);
    const ys = pts.map((p) => p[1] * H);
    const pad = layer.width / 2;
    return {
      x: Math.min(...xs) - pad,
      y: Math.min(...ys) - pad,
      w: Math.max(...xs) - Math.min(...xs) + pad * 2,
      h: Math.max(...ys) - Math.min(...ys) + pad * 2,
    };
  }
  if (layer.type === "text" && layer.arc) {
    const { chord, sag } = arcGeometry(layer);
    const w = Math.max(chord, layer.size);
    const h = layer.size + 2 * sag;
    return { x: layer.x * W - w / 2, y: layer.y * H - h / 2, w, h };
  }
  const w = layer.type === "text" ? Math.max(textWidth(layer), layer.size * 0.5) : layer.size;
  const h = layer.type === "motif" ? layer.size * layerAspect(layer) : layer.size;
  return { x: layer.x * W - w / 2, y: layer.y * H - h / 2, w, h };
}

/** Dessine les calques ; `selectedId` ajoute un cadre de sélection (éditeur uniquement). */
export function drawLayers(ctx, layers, { selectedId } = {}) {
  if (!layers?.length) return;
  const W = ctx.canvas.width;
  const H = ctx.canvas.height;
  // Bordures d'abord : elles font partie du vêtement, les autres éléments passent par-dessus.
  for (const layer of layers) if (layer.type === "trim") drawTrim(ctx, layer, W, H);
  for (const layer of layers) {
    if (layer.type === "path") drawPath(ctx, layer, W, H);
    else if (layer.type === "shape") drawShape(ctx, layer, W, H);
    else if (layer.type === "text") drawText(ctx, layer, W, H);
    else if (layer.type === "motif") drawMotifLayer(ctx, layer, W, H);
  }
  const selected = selectedId && layers.find((l) => l.id === selectedId);
  if (selected && selected.type !== "trim") {
    const b = layerBounds(selected, W, H);
    ctx.save();
    ctx.setLineDash([10, 6]);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#a40000";
    if (selected.type === "path") {
      ctx.strokeRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16);
    } else {
      // Cadre dans le repère tourné de l'élément.
      ctx.translate(selected.x * W, selected.y * H);
      ctx.rotate(((selected.rotation ?? 0) * Math.PI) / 180);
      ctx.strokeRect(-b.w / 2 - 8, -b.h / 2 - 8, b.w + 16, b.h + 16);
    }
    ctx.restore();
  }
}

// ---------------------------------------------------------------- Sélection

function distanceToSegment(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Renvoie le calque le plus haut situé sous le point (u, v), ou null. */
export function hitTest(layers, uv, W = 1024, H = 1024) {
  const px = uv.x * W;
  const py = uv.y * H;
  for (let i = layers.length - 1; i >= 0; i--) {
    const layer = layers[i];
    if (layer.type === "trim") continue; // se modifie dans le panneau, pas à la souris
    if (layer.type === "path") {
      const tol = layer.width / 2 + 10;
      for (const run of splitRuns(layer.points)) {
        const pts = run.map(([u, v]) => [u * W, v * H]);
        if (pts.length === 1 && Math.hypot(px - pts[0][0], py - pts[0][1]) <= tol) return layer;
        for (let j = 1; j < pts.length; j++) {
          if (distanceToSegment(px, py, pts[j - 1], pts[j]) <= tol) return layer;
        }
      }
    } else {
      // Test dans le repère tourné de l'élément (la zone cliquable suit la rotation).
      const theta = -((layer.rotation ?? 0) * Math.PI) / 180;
      const dx = px - layer.x * W;
      const dy = py - layer.y * H;
      const lx = dx * Math.cos(theta) - dy * Math.sin(theta);
      const ly = dx * Math.sin(theta) + dy * Math.cos(theta);
      const b = layerBounds(layer, W, H);
      if (Math.abs(lx) <= b.w / 2 + 8 && Math.abs(ly) <= b.h / 2 + 8) return layer;
    }
  }
  return null;
}

/** Déplace un calque d'un vecteur (du, dv) en espace texture. */
export function translateLayer(layer, du, dv) {
  if (layer.type === "trim") return layer;
  if (layer.type === "path") {
    return { ...layer, points: layer.points.map((p) => (p ? roundPoint([p[0] + du, p[1] + dv]) : null)) };
  }
  return { ...layer, x: round(layer.x + du), y: round(layer.y + dv) };
}

// ---------------------------------------------------------------- Données externes

const finite = (n, fallback) => (Number.isFinite(n) ? n : fallback);
const clampSize = (n, fallback, max) => Math.min(max, Math.max(1, finite(n, fallback)));
const isPoint = (p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);
const safeColor = (c) => (typeof c === "string" && c.length <= 32 ? c : "#000000");

/** Répare un calque (valeurs manquantes ou aberrantes) ou le rejette : les données ne doivent jamais faire planter le rendu. */
function sanitizeLayer(l, index) {
  if (!l || typeof l !== "object") return null;
  // Identifiant de secours déterministe (sinon la clé de cache des aperçus changerait à chaque appel).
  const id = typeof l.id === "string" && l.id ? l.id : `layer-${index}`;
  if (l.type === "path") {
    if (!Array.isArray(l.points)) return null;
    const points = l.points.map((p) => (isPoint(p) ? [p[0], p[1]] : null));
    if (!points.some(Boolean)) return null;
    return { id, type: "path", color: safeColor(l.color), width: clampSize(l.width, 8, 200), points };
  }
  if (l.type === "trim") {
    const parts = Array.isArray(l.parts) ? TRIM_PART_IDS.filter((p) => l.parts.includes(p)) : [];
    if (!parts.length) return null;
    return {
      id,
      type: "trim",
      parts,
      color: safeColor(l.color),
      color2: safeColor(l.color2 ?? "#ffffff"),
      style: TRIM_STYLE_IDS.includes(l.style) ? l.style : "solid",
      width: Math.min(TRIM_WIDTH_RANGE[1], Math.max(TRIM_WIDTH_RANGE[0], finite(l.width, 26))),
    };
  }
  if (l.type !== "shape" && l.type !== "text" && l.type !== "motif") return null;
  if (!Number.isFinite(l.x) || !Number.isFinite(l.y)) return null;
  const base = { id, type: l.type, x: l.x, y: l.y, rotation: finite(l.rotation, 0), color: safeColor(l.color) };
  if (l.type === "motif") {
    let icon = {};
    if (l.motif === ICON_MOTIF) {
      // Illustration : tracés SVG uniquement (caractères de tracé, taille bornée), boîte valide.
      const paths = Array.isArray(l.paths) ? l.paths.filter((d) => typeof d === "string" && SAFE_PATH.test(d)) : [];
      const vb = Array.isArray(l.vb) && l.vb.length === 2 && l.vb.every((n) => Number.isFinite(n) && n > 0 && n <= 4096) ? l.vb : null;
      if (!paths.length || paths.length > 20 || paths.join("").length > 60000 || !vb) return null;
      icon = {
        icon: typeof l.icon === "string" ? l.icon.slice(0, 80) : "",
        paths,
        vb: [vb[0], vb[1]],
        ...(typeof l.credit === "string" ? { credit: l.credit.slice(0, 80) } : {}),
      };
    } else if (!MOTIF_IDS.includes(l.motif)) {
      return null; // motif inconnu (version plus récente) : ignoré
    }
    return {
      ...icon,
      ...base,
      motif: l.motif,
      size: clampSize(l.size, 160, 1000),
      color2: safeColor(l.color2 ?? l.color),
      accent: safeColor(l.accent ?? l.color2 ?? l.color),
      effects: cleanEffects(l.effects),
      seed: Number.isInteger(l.seed) ? l.seed : 1,
    };
  }
  if (l.type === "shape") {
    return {
      ...base,
      shape: SHAPE_IDS.has(l.shape) ? l.shape : "rect",
      size: clampSize(l.size, 120, 1000),
      filled: l.filled !== false,
      strokeWidth: clampSize(l.strokeWidth, 6, 200),
    };
  }
  return {
    ...base,
    text: typeof l.text === "string" ? l.text.slice(0, 200) : "",
    size: clampSize(l.size, 40, 1000),
    font: typeof l.font === "string" ? l.font.slice(0, 100) : "Arial",
    ...(Number.isFinite(l.arc) && Math.abs(l.arc) >= 10 ? { arc: Math.max(-2000, Math.min(2000, l.arc)) } : {}),
  };
}

/** Nettoie des calques venant de l'API (champ absent, chaîne JSON, entrées invalides). */
export function sanitizeLayers(raw) {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) return [];
  return value.map((l, i) => sanitizeLayer(l, i)).filter(Boolean);
}
