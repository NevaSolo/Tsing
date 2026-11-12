/*
 * Vérificateur de design : règles mesurables, sans IA.
 * - contraste WCAG entre chaque élément et son fond réel (t-shirt ou forme pleine dessous)
 * - taille réelle des textes à l'impression
 * - éléments hors de la zone imprimable (coutures, manches), rotation comprise
 * - textes qui se chevauchent
 */
import { PRINT_WIDTH_CM, PRINT_ZONES } from "./catalog.js";
import { contrastRatio, normalizeHex } from "./color.js";
import { backgroundAt, backgroundsUnder, boxArea, layerBox, layerSamplePoints, overlapArea } from "./background.js";
import { motifInfo } from "./motifs.js";

export { backgroundAt, backgroundsUnder };

const TEX = 1024;
const ZONE_WIDTH_PX = (PRINT_ZONES.front.u1 - PRINT_ZONES.front.u0) * TEX;
/** Centimètres réels pour 1 px de texture (approximation : zone imprimable ≈ 30 cm de large). */
export const CM_PER_PX = PRINT_WIDTH_CM / ZONE_WIDTH_PX;

export const MIN_TEXT_CM = 1.2;
const MARGIN = 0.008; // tolérance en uv
const MAIN_TEXT_ID = "__main-text";

const SHAPE_NAMES = { rect: "Rectangle", circle: "Cercle", triangle: "Triangle", star: "Étoile", heart: "Cœur" };
export const describeLayer = (l) =>
  l.id === MAIN_TEXT_ID
    ? "Le texte principal"
    : l.type === "text"
      ? `Texte « ${l.text || "…"} »`
      : l.type === "shape"
        ? SHAPE_NAMES[l.shape] ?? "Forme"
        : l.type === "trim"
          ? "La bordure"
          : l.type === "motif"
          ? l.motif === "icon"
            ? "L'illustration"
            : `Le motif « ${motifInfo(l.motif)?.label ?? "Illustration"} »`
          : "Trait";

const formatCm = (cm) => `${cm.toFixed(1).replace(".", ",")} cm`;

const zoneContaining = (u, v) =>
  Object.entries(PRINT_ZONES).find(
    ([, z]) => u >= z.u0 - MARGIN && u <= z.u1 + MARGIN && v >= z.v0 - MARGIN && v <= z.v1 + MARGIN
  )?.[0] ?? null;

function placementIssue(layer) {
  const pts = layerSamplePoints(layer);
  if (!pts.length) return null;
  const outside = pts.filter(([u, v]) => !zoneContaining(u, v)).length;
  if (outside === pts.length) {
    return { level: "error", message: `${describeLayer(layer)} est hors de la zone imprimable (manche ou couture) : il risque de ne pas être imprimé.` };
  }
  if (outside / pts.length > 0.2) return { level: "warning", message: `${describeLayer(layer)} déborde de la zone imprimable.` };
  return null;
}

/** Contraste avec le pire des fonds sous l'élément (un texte peut déborder d'un disque sur le t-shirt). */
function contrastIssue(color, backgrounds, label) {
  const hex = normalizeHex(color);
  if (!hex) return null;
  const ratio = Math.min(...backgrounds.map((bg) => contrastRatio(hex, bg)));
  if (ratio < 1.5) return { level: "error", message: `${label} est quasi invisible sur son fond (contraste ${ratio.toFixed(1)}:1).` };
  if (ratio < 3) return { level: "warning", message: `${label} manque de contraste avec son fond (${ratio.toFixed(1)}:1, 3:1 recommandé).` };
  return null;
}

/**
 * @param {{ shirtColor: string, layers?: object[], mainText?: {text, color, size, position, font}, hasImage?: boolean, imagePosition?: {x,y} }} design
 * @returns {{ level: "error"|"warning"|"info", message: string, layerId?: string }[]}
 */
export function checkDesign({ shirtColor = "#ffffff", layers = [], mainText, hasImage = false, imagePosition } = {}) {
  const shirt = normalizeHex(shirtColor) ?? "#ffffff";
  const issues = [];
  const push = (issue, layerId) => issue && issues.push(layerId && layerId !== MAIN_TEXT_ID ? { ...issue, layerId } : issue);

  const hasMainText = Boolean(mainText?.text?.trim());
  if (!layers.length && !hasMainText && !hasImage) {
    issues.push({ level: "info", message: "Le design est vide : ajoutez un texte, une image, un dessin ou générez une proposition." });
    return issues;
  }

  // Le texte principal (onglet Texte) est traité comme un calque placé sous les autres.
  const mainLayer =
    hasMainText && mainText.position
      ? {
          id: MAIN_TEXT_ID, type: "text", text: mainText.text, size: mainText.size ?? 48, font: mainText.font,
          color: mainText.color, x: mainText.position.x, y: mainText.position.y, rotation: mainText.rotation ?? 0,
        }
      : null;
  const all = mainLayer ? [mainLayer, ...layers] : layers;

  if (hasImage && imagePosition && !zoneContaining(imagePosition.x, imagePosition.y)) {
    issues.push({ level: "warning", message: "Le centre de l'image est hors de la zone imprimable." });
  }

  all.forEach((layer, index) => {
    const label = describeLayer(layer);
    push(contrastIssue(layer.color, backgroundsUnder(all, index, shirt), label), layer.id);
    if (layer.type === "text") {
      const cm = layer.size * CM_PER_PX;
      if (cm < MIN_TEXT_CM) {
        push({ level: "warning", message: `${label} mesurera environ ${formatCm(cm)} de haut : difficile à lire une fois imprimé.` }, layer.id);
      }
    }
    push(placementIssue(layer), layer.id);
  });

  // Textes superposés : illisibles (un texte posé sur une forme pleine, lui, est voulu).
  const texts = all.filter((l) => l.type === "text" && l.text);
  for (let i = 0; i < texts.length; i++) {
    for (let j = i + 1; j < texts.length; j++) {
      const a = layerBox(texts[i]);
      const b = layerBox(texts[j]);
      const ratio = overlapArea(a, b) / Math.max(1e-9, Math.min(boxArea(a), boxArea(b)));
      if (ratio > 0.15) {
        push(
          { level: "warning", message: `${describeLayer(texts[j])} chevauche ${describeLayer(texts[i]).replace(/^Le /, "le ")} : déplacez l'un des deux.` },
          texts[j].id
        );
      }
    }
  }

  if (layers.length > 60) {
    issues.push({ level: "info", message: `${layers.length} éléments : un design chargé peut perdre en lisibilité.` });
  }

  const order = { error: 0, warning: 1, info: 2 };
  return issues.sort((a, b) => order[a.level] - order[b.level]);
}
