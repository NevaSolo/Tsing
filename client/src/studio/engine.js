/*
 * Moteur du Studio : demande en français → paramètres → calques éditables.
 * Aucune IA ni réseau : analyse par mots-clés + modèles de mise en page.
 * Les paramètres (`DesignParams`) sont aussi ce qu'une IA locale pourra produire plus tard :
 * le même `buildLayers` transformera sa réponse en calques.
 */
import { COLOR_WORDS, GENERIC_THEME, MOODS, PRINT_ZONES, STYLES, THEMES, WRITING_STYLES } from "./catalog.js";
import { bestOnColor, contrastRatio, ensureContrast, hexToHsl, hslToHex, normalizeHex, rotateHue, withLightness } from "./color.js";
import { createRng, hashString } from "./random.js";
import { backgroundsUnder, layerBox, overlapArea, textWidthPx } from "./background.js";
import { cleanEffects, EFFECTS, ICON_MOTIF, layerAspect, MOTIFS, STYLE_EFFECTS } from "./motifs.js";
import { createTrimLayer, TRIM_PART_IDS } from "../canvas/utils/trims.js";

const TEX = 1024; // taille de la texture en px
export const MAX_TEXT_LENGTH = 40;
/** Taille minimale d'un texte généré (px de texture) : ≈ 1,4 cm à l'impression. */
const MIN_TEXT_PX = 14;

// ------------------------------------------------------------------ Analyse de la demande

export const normalizeText = (t = "") => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

const tokenize = (t) => normalizeText(t).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Un mot correspond à un mot-clé : identique, au pluriel/féminin (s, x, e, es), ou — pour les mots-clés
 * d'au moins 5 lettres — un dérivé proche (« randonnee » → « randonnees »). Les mots-clés courts
 * restent stricts pour éviter les faux positifs (« mode » ≠ « moderne »).
 */
const matches = (word, key) =>
  word === key ||
  [`${key}s`, `${key}x`, `${key}e`, `${key}es`].includes(word) ||
  (key.length >= 5 && word.startsWith(key) && word.length - key.length <= 3);

const SHIRT_WORDS = new Set(["shirt", "tshirt", "tee", "fond", "teeshirt"]);
/** « pas de texte », « sans slogan », « juste le dessin », « uniquement l'illustration »… */
const NO_TEXT = [
  /\b(pas|sans|aucun|aucune|zero|ni)\s+(de\s+|d['’]\s*)?(texte|textes|text|slogan|slogans|ecriture|ecritures|inscription|inscriptions|mot|mots|lettre|lettres|phrase|titre)\b/,
  /\b(juste|seulement|uniquement|que)\s+(le|la|l['’]|un|une|du)?\s*(dessin|logo|illustration|motif|image|visuel|graphisme)\b/,
  /\bno\s+text\b/,
];
const BACK_WORDS = new Set(["dos", "back", "arriere"]);

/** Coupe proprement un texte trop long (entre deux mots, sans couper un emoji). */
export function clipText(raw) {
  const chars = Array.from(raw.trim());
  if (chars.length <= MAX_TEXT_LENGTH) return { text: chars.join(""), truncated: false };
  const cut = chars.slice(0, MAX_TEXT_LENGTH).join("");
  const space = cut.lastIndexOf(" ");
  return { text: (space > MAX_TEXT_LENGTH / 2 ? cut.slice(0, space) : cut).trim(), truncated: true };
}

/**
 * Extrait de la demande : thème, style, couleurs, ambiance, texte imposé, emplacement.
 * Le texte imposé (entre guillemets ou après « texte : ») n'influence ni le thème, ni le style, ni l'emplacement.
 */
export function parsePrompt(prompt = "") {
  const quoted = prompt.match(/["«“]\s*([^"»”]+?)\s*["»”]/);
  const labelled = prompt.match(/(?:texte|slogan|nom|écrire|ecrire)\s*:\s*([^,;\n]+)/i);
  const textMatch = quoted ?? labelled;
  const clipped = textMatch ? clipText(textMatch[1]) : { text: "", truncated: false };

  // Bordures (« bordures rouges au col et aux manches ») : lues à part, leurs couleurs ne colorent pas le motif.
  const trimInfo = findTrims(textMatch ? prompt.replace(textMatch[0], " ") : prompt);
  const words = tokenize(trimInfo.rest);
  // Paires de mots accolées (« old school » → « oldschool », « road trip » → « roadtrip »).
  const withPairs = [...words, ...words.slice(1).map((w, i) => words[i] + w)];

  const score = (list) => list.map((item) => ({ item, n: withPairs.filter((w) => item.keywords.some((k) => matches(w, k))).length }));
  const bestOf = (list) => score(list).reduce((best, cur) => (cur.n > best.n ? cur : best), { item: null, n: 0 });
  const themeHit = bestOf(THEMES);
  const styleHit = bestOf(STYLES);
  // Style d'écriture : seulement s'il est introduit par « écriture », « police », « typo », « lettres »…
  // (« classique » seul désigne le style graphique, pas la police).
  const writing = findWritingStyle(textMatch ? prompt.replace(textMatch[0], " ") : prompt);
  // Illustration demandée (« montagne », « fusée »…) et effets (« givrée », « néon »…).
  const motifHit = bestOf(MOTIFS);
  const effects = EFFECTS.filter((e) => withPairs.some((w) => e.keywords.some((k) => matches(w, k)))).map((e) => e.id);

  const colors = [];
  let shirtColor = null;
  let mood = null;
  const colorKeyOf = (w) => w && Object.keys(COLOR_WORDS).find((k) => matches(w, k));
  for (let i = 0; i < words.length; i++) {
    const key = colorKeyOf(words[i]);
    if (key) {
      // « bleu marine », « rouge bordeaux » : le second mot précise le premier.
      const nextKey = colorKeyOf(words[i + 1]);
      const color = COLOR_WORDS[nextKey ?? key];
      const forShirt = SHIRT_WORDS.has(words[i - 1]) || (words[i - 1] === "shirt" && words[i - 2] === "t");
      if (forShirt) shirtColor = color;
      else if (!colors.includes(color)) colors.push(color);
      if (nextKey) i++;
      continue;
    }
    const moodKey = Object.keys(MOODS).find((k) => matches(words[i], k));
    if (moodKey) mood = moodKey;
  }

  return {
    theme: themeHit.item ?? GENERIC_THEME,
    themeDetected: Boolean(themeHit.item),
    style: styleHit.item,
    colors,
    shirtColor,
    mood,
    text: clipped.text || null,
    textTruncated: clipped.truncated,
    // Le texte entre guillemets l'emporte : « pas de slogan, juste « Paris » » garde « Paris ».
    noText: !clipped.text && NO_TEXT.some((re) => re.test(normalizeText(prompt))),
    placement: words.some((w) => BACK_WORDS.has(w)) ? "back" : "front",
    motif: motifHit.item?.id ?? null,
    writing,
    trims: trimInfo.trims,
    effects: cleanEffects(effects),
  };
}

const TRIM_CUES = ["bordure", "bordures", "lisere", "liseres", "liseret", "finition", "finitions", "contour", "ourlet", "poignet", "poignets", "rayure", "rayures", "bande", "bandes"];
const TRIM_PART_WORDS = { collar: ["col", "encolure", "cou"], sleeves: ["manche", "manches", "poignet", "poignets"], hem: ["bas", "ourlet", "taille"] };

/**
 * Bordures demandées : partie de phrase avec un mot de bordure (« liseré », « bordures »…), ou une partie
 * du vêtement suivie d'une couleur (« col blanc », « manches rouges »).
 * @returns {{ trims: null | { parts, color, color2, style, width }, rest: string }} rest = demande sans ces parties
 */
function findTrims(prompt) {
  const clauses = prompt.split(/([,.;\n]+)/);
  let trims = null;
  const kept = [];
  for (const clause of clauses) {
    const words = tokenize(clause);
    const hasCue = words.some((w) => TRIM_CUES.includes(w));
    const parts = TRIM_PART_IDS.filter((p) => words.some((w) => TRIM_PART_WORDS[p].includes(w)));
    const colors = words.map((w) => Object.keys(COLOR_WORDS).find((k) => matches(w, k))).filter(Boolean).map((k) => COLOR_WORDS[k]);
    // « manches courtes » ne demande pas de bordure : il faut un mot de bordure ou une couleur.
    if (!hasCue && !(parts.length && colors.length)) {
      kept.push(clause);
      continue;
    }
    trims ??= { parts: [], color: null, color2: null, style: "solid", width: 26 };
    trims.parts = [...new Set([...trims.parts, ...(parts.length ? parts : TRIM_PART_IDS)])];
    trims.color ??= colors[0] ?? null;
    trims.color2 ??= colors[1] ?? null;
    if (words.some((w) => ["rayure", "rayures", "raye", "rayee", "rayees", "sport", "stripes"].includes(w))) trims.style = "stripes";
    else if (trims.style === "solid" && (colors.length > 1 || words.some((w) => ["bicolore", "double", "lisere", "liseres", "liseret"].includes(w)))) trims.style = "double";
    if (words.some((w) => ["fin", "fine", "fines", "fins", "discret", "discrete"].includes(w))) trims.width = 14;
    if (words.some((w) => ["large", "larges", "epais", "epaisse", "epaisses", "grosse", "grosses"].includes(w))) trims.width = 42;
    kept.push(" ");
  }
  return { trims, rest: kept.join("") };
}

/** Calque bordure lisible sur le t-shirt, à partir de la demande et de la palette. */
function trimLayerFor(trims, palette, id) {
  if (!trims) return null;
  const color = ensureContrast(trims.color ?? palette.secondary, palette.shirt, 3);
  const color2 = trims.color2 ?? (contrastRatio(palette.shirt, color) >= 3 ? palette.shirt : bestOnColor(color));
  return createTrimLayer({ id, parts: trims.parts, color, color2, style: trims.style, width: trims.width });
}

const WRITING_CUES = /\b(ecriture|ecrit|ecrite|police|polices|typo|typographie|lettrage|lettres|caracteres|font|calligraphie)\b/;
const FONT_NAMES = new Map(WRITING_STYLES.flatMap((w) => w.fonts.map((f) => [normalizeText(f).replace(/\s+/g, ""), w])));

/** Style d'écriture demandé : nom de police cité, ou mot-clé dans la partie de phrase qui parle d'écriture. */
function findWritingStyle(prompt) {
  const text = normalizeText(prompt);
  for (const [name, w] of FONT_NAMES) if (text.replace(/\s+/g, "").includes(name)) return w;
  // Chaque partie de phrase (virgules, points) est lue séparément : « style vintage, écriture manuscrite ».
  for (const clause of text.split(/[,.;:!?\n]+/)) {
    const cue = clause.match(WRITING_CUES);
    if (!cue) continue;
    const words = clause.slice(cue.index).split(/[^a-z0-9]+/).filter(Boolean);
    const hit = WRITING_STYLES.find((w) => words.some((word) => w.keywords.some((k) => matches(word, k))));
    if (hit) return hit;
    // « écriture à la main », « écrit à la main »
    if (/\ba la main\b/.test(clause)) return WRITING_STYLES.find((w) => w.id === "hand");
  }
  return null;
}

// ------------------------------------------------------------------ Palettes

/** Construit une palette lisible à partir d'une palette de thème et des souhaits de couleur. */
export function buildPalette(base, { colors = [], shirtColor = null, mood = null } = {}, rng = createRng(1)) {
  let { shirt, primary, secondary, accent } = base;
  if (colors.length) {
    primary = colors[0];
    secondary = colors[1] ?? rotateHue(primary, rng.pick([150, 180, 210]));
    accent = colors[2] ?? withLightness(primary, 0.85);
    if (!shirtColor) shirt = contrastRatio("#ffffff", primary) >= contrastRatio("#111111", primary) ? "#ffffff" : "#111111";
  }
  if (mood) {
    const { lightness, saturation } = MOODS[mood];
    const tune = (hex) => hslToHex([hexToHsl(hex)[0], saturation, lightness]);
    primary = tune(primary);
    secondary = tune(secondary);
    accent = tune(accent);
    if (!shirtColor) shirt = lightness >= 0.6 ? "#2b2d42" : lightness <= 0.3 ? "#f8f9fa" : shirt;
  }
  if (shirtColor) shirt = shirtColor;
  shirt = normalizeHex(shirt) ?? "#ffffff";
  return {
    shirt,
    primary: ensureContrast(primary, shirt, 3),
    secondary: ensureContrast(secondary, shirt, 3),
    // Éléments graphiques : 3:1 comme le texte (critère WCAG 1.4.11 « contraste du non-textuel »).
    accent: ensureContrast(accent, shirt, 3),
  };
}

// ------------------------------------------------------------------ Typographie

export const estimateTextWidth = (text, size, font) => textWidthPx(text, size, font);

/** Taille (px de texture) pour que `text` tienne dans `maxWidth`, bornée par [minSize, maxSize]. Arrondi par défaut. */
export function fitTextSize(text, font, maxWidth, maxSize, minSize = 18) {
  const per100 = textWidthPx(text || " ", 100, font) / 100;
  const ideal = per100 > 0 ? maxWidth / per100 : maxSize;
  return Math.floor(Math.max(minSize, Math.min(maxSize, ideal)));
}

/**
 * Répartit des mots sur `count` lignes en minimisant la ligne la plus longue (coupures entre mots uniquement).
 * Renvoie null si le texte n'a pas assez de mots.
 */
function splitLines(text, count) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (count <= 1) return [words.join(" ")];
  if (words.length < count) return null;
  let best = null;
  const choose = (start, remaining, acc) => {
    if (remaining === 1) {
      const lines = [...acc, words.slice(start).join(" ")];
      const longest = Math.max(...lines.map((l) => l.length));
      if (!best || longest < best.longest) best = { lines, longest };
      return;
    }
    for (let end = start + 1; end <= words.length - remaining + 1; end++) {
      choose(end, remaining - 1, [...acc, words.slice(start, end).join(" ")]);
    }
  };
  choose(0, count, []);
  return best.lines;
}

/** Coupe un mot unique trop long en morceaux (dernier recours, uniquement sans espace). */
const chunkWord = (text, count) => {
  const chars = Array.from(text.trim());
  const size = Math.ceil(chars.length / count);
  return Array.from({ length: count }, (_, i) => chars.slice(i * size, (i + 1) * size).join("")).filter(Boolean);
};

/**
 * Bloc de titre : une à trois lignes, taille la plus grande possible qui tient dans `maxWidth`.
 * @returns {{ lines: string[], size: number, height: number }} height en px de texture
 */
export function fitHeadline(text, font, maxWidth, maxSize, minSize = 20) {
  const widest = (lines, size) => Math.max(...lines.map((l) => textWidthPx(l, size, font)));
  const attempt = (lines, cap) => {
    const size = Math.max(MIN_TEXT_PX, Math.min(cap, ...lines.map((l) => fitTextSize(l, font, maxWidth, cap, MIN_TEXT_PX))));
    return { lines, size, overflow: Math.max(0, widest(lines, size) - maxWidth) };
  };
  const singleWord = !/\s/.test(text.trim());
  const candidates = [];
  for (let count = 1; count <= 3; count++) {
    const lines = count === 1 ? [text.trim()] : singleWord ? chunkWord(text, count) : splitLines(text, count);
    if (!lines || lines.length !== count) continue;
    const res = attempt(lines, count === 1 ? maxSize : Math.round(maxSize * 0.75));
    candidates.push(res);
    // Le moins de lignes possible, dès que la taille reste confortable.
    if (res.overflow === 0 && res.size >= minSize) {
      return { lines: res.lines, size: res.size, height: res.lines.length * res.size * 1.12 };
    }
  }
  // Sinon : la proposition qui tient (ou déborde le moins), puis la plus grande taille.
  candidates.sort((a, b) => a.overflow - b.overflow || b.size - a.size);
  const best = candidates[0];
  return { lines: best.lines, size: best.size, height: best.lines.length * best.size * 1.12 };
}

// ------------------------------------------------------------------ Mises en page

export const LAYOUTS = {
  stack: "Empilé",
  badge: "Badge",
  emblem: "Emblème",
  frame: "Cadre",
  minimal: "Minimal",
  back: "Face & dos",
  crest: "Écusson",
  art: "Illustration",
};

const zoneCenter = (zone) => {
  const z = PRINT_ZONES[zone];
  return { u: (z.u0 + z.u1) / 2, width: (z.u1 - z.u0) * TEX, top: z.v0, bottom: z.v1 };
};

const r4 = (n) => Math.round(n * 10000) / 10000;

/**
 * Transforme des paramètres de design en calques.
 * @param {object} p { layout, palette, font, uppercase, headline, subline, shapes, placement, motif?, noText?, artVariant? }
 *   noText : illustration seule (aucun texte) — artVariant 0 grand dessin, 1 dans un disque, 2 dans un anneau.
 *   motif : { id, effects, seed } — illustration vectorielle (voir motifs.js), facultative.
 * @param {string} idPrefix préfixe des identifiants de calques
 */
export function buildLayers(p, idPrefix = "s") {
  let n = 0;
  const id = () => `${idPrefix}-${n++}`;
  const zone = p.placement === "back" ? "back" : "front";
  const { u: cu, width: zoneW, top } = zoneCenter(zone);
  const maxW = zoneW * 0.86;
  const up = (s) => (s && p.uppercase ? s.toLocaleUpperCase("fr-FR") : s);
  const headline = up(p.headline || "Tsing");
  const subline = up(p.subline || "");
  const { primary, secondary, accent, shirt } = p.palette;
  const font = p.font;
  const shape = p.shapes?.[0] ?? "star";
  const px = (value) => value / TEX;

  const text = (t, v, size, color, u = cu) => ({ id: id(), type: "text", text: t, x: r4(u), y: r4(v), size, rotation: 0, color, font });
  const shapeL = (kind, v, size, color, filled = true, strokeWidth = 8, u = cu) => ({
    id: id(), type: "shape", shape: kind, x: r4(u), y: r4(v), size, rotation: 0, color, filled, strokeWidth,
  });
  const line = (v, halfWidthPx, color, width = 6, du = 0) => ({
    id: id(), type: "path", color, width,
    points: [[r4(cu + du - halfWidthPx / TEX), r4(v)], [r4(cu + du + halfWidthPx / TEX), r4(v)]],
  });
  /** Lignes d'un bloc de titre, à partir du haut `vTop` ; renvoie le bas du bloc (uv). */
  const pushBlock = (block, vTop, color, u = cu) => {
    const lineH = block.size * 1.12;
    block.lines.forEach((l, i) => layers.push(text(l, vTop + px(lineH * i + lineH / 2), block.size, color, u)));
    return vTop + px(block.height);
  };

  const layers = [];
  let layout = p.noText && p.motif?.id ? "art" : p.layout;
  const zoneH = (PRINT_ZONES[zone].v1 - PRINT_ZONES[zone].v0) * TEX;

  // Motif : couleurs de la palette ; le givre impose un bleu glacé (lisible sur le t-shirt).
  const motif = p.motif && p.motif.id ? p.motif : null;
  const motifAccent = motif?.effects?.includes("frost") ? ensureContrast("#cfe9ff", shirt, 3) : accent;
  const aspect = motif ? layerAspect(motif) : 1;
  // Illustration de bibliothèque : ses tracés voyagent avec le calque.
  const iconFields = motif?.id === ICON_MOTIF ? { icon: motif.icon, paths: motif.paths, vb: motif.vb, credit: motif.credit } : {};
  /** Taille (largeur px) du motif pour tenir dans maxH × maxW. */
  const motifSize = (maxH, maxW) => Math.floor(Math.min(maxW, maxH / aspect));
  const motifL = (v, size, u = cu, effects = motif.effects ?? [], colors = {}) => ({
    id: id(), type: "motif", motif: motif.id, ...iconFields, x: r4(u), y: r4(v), size, rotation: 0,
    color: primary, color2: secondary, accent: motifAccent, ...colors, effects: cleanEffects(effects), seed: motif.seed ?? 1,
  });

  // Écusson : anneau, motif au centre, titre courbé en haut, sous-titre courbé en bas.
  let crest = null;
  if (layout === "crest") {
    const D = Math.min(250, zoneW * 0.86);
    const R = D / 2;
    const rIn = R * 0.6;
    const band = R - 4.5 - (rIn + 1.5);
    const rT = (R - 4.5 + rIn + 1.5) / 2;
    const maxArc = rT * ((140 * Math.PI) / 180);
    const headSize = fitTextSize(headline, font, maxArc, Math.min(36, Math.floor(band * 0.78)), MIN_TEXT_PX);
    if (headSize >= 16 && textWidthPx(headline, headSize, font) <= maxArc) {
      let sub = null;
      if (subline) {
        const size = fitTextSize(subline, font, maxArc * 0.9, Math.min(24, Math.floor(band * 0.6)), MIN_TEXT_PX);
        if (textWidthPx(subline, size, font) <= maxArc * 0.9) sub = { text: subline, size };
      }
      crest = { D, rIn, rT, head: { text: headline, size: headSize }, sub };
    } else {
      layout = "emblem"; // titre trop long pour l'anneau
    }
  }

  // Badge : le titre doit tenir DANS le disque (sinon il déborderait dans la couleur du t-shirt).
  let badge = null;
  if (layout === "badge") {
    for (const D of [Math.min(230, zoneW * 0.78), zoneW * 0.92]) {
      // Avec un motif : il se place DANS le disque, au-dessus du titre.
      const mh = motif ? Math.min(64, D * 0.28) : 0;
      const block = fitHeadline(headline, font, D * 0.74, motif ? 42 : 64, 22);
      const height = block.height + (motif ? mh + 8 : 0);
      if (height <= D * 0.7 && Math.max(...block.lines.map((l) => textWidthPx(l, block.size, font))) <= D * 0.74) {
        badge = { D, block, mh, height };
        break;
      }
    }
    if (!badge) layout = "stack";
  }

  // Cadre : il s'agrandit avec le contenu ; s'il ne tient plus dans la zone, on empile simplement.
  let frame = null;
  if (layout === "frame") {
    const W = Math.min(260, maxW);
    const block = fitHeadline(headline, font, W * 0.8, 64);
    const sb = subline ? fitHeadline(subline, font, W * 0.75, 24, 14) : null;
    // Motif dans le cadre, au-dessus du titre.
    const ms = motif ? motifSize(70, W * 0.5) : 0;
    const mh = ms * aspect;
    const content = (motif ? mh + 10 : 0) + block.height + (sb ? 8 + sb.height : 0);
    const H = Math.max(W * 0.7, content + 50);
    const size = Math.max(W, H / 0.7);
    if (size <= zoneW * 0.92) frame = { block, sb, content, H, size, ms, mh };
    else layout = "stack";
  }

  switch (layout) {
    case "art": {
      const variant = (p.artVariant ?? 0) % 3;
      if (variant === 0) {
        // Grand dessin, seul, en haut de la zone.
        const ms = motifSize(Math.min(300, zoneH * 0.72), zoneW * 0.86);
        layers.push(motifL(top + px(26 + (ms * aspect) / 2), ms));
      } else {
        const D = Math.min(250, zoneW * 0.84);
        const cv = top + px(26 + D / 2);
        const fx = (motif.effects ?? []).filter((e) => e !== "rays" && e !== "glow");
        if (variant === 1) {
          // Dans un disque plein : couleurs du dessin lisibles sur le disque.
          const onDisc = contrastRatio(shirt, primary) >= 3 ? shirt : bestOnColor(primary);
          layers.push(shapeL("circle", cv, D, primary));
          const ms = Math.floor((D * 0.62) / Math.hypot(1, aspect));
          layers.push(motifL(cv, ms, cu, fx, { color: onDisc, color2: ensureContrast(secondary, primary, 3), accent: ensureContrast(motifAccent, primary, 3) }));
        } else {
          // Dans un double anneau, façon écusson sans texte.
          const rIn = (D / 2) * 0.82;
          layers.push(shapeL("circle", cv, D, primary, false, 9));
          layers.push(shapeL("circle", cv, Math.round(rIn * 2), secondary, false, 3));
          const ms = Math.floor(((rIn - 8) * 2) / Math.hypot(1, aspect));
          layers.push(motifL(cv, ms, cu, fx));
        }
      }
      break;
    }
    case "badge": {
      const { D, block, mh, height } = badge;
      const cv = top + px(24 + D / 2);
      const onBadge = contrastRatio(shirt, primary) >= 3 ? shirt : bestOnColor(primary);
      layers.push(shapeL("circle", cv, D, primary));
      let vTop = cv - px(height / 2);
      if (motif) {
        // Couleurs du motif lisibles sur le disque (et non sur le t-shirt).
        const ms = motifSize(mh, D * 0.5);
        layers.push(
          motifL(vTop + px((ms * aspect) / 2), ms, cu, (motif.effects ?? []).filter((e) => e !== "rays" && e !== "glow"), {
            color: onBadge,
            color2: ensureContrast(secondary, primary, 3),
            accent: ensureContrast(motifAccent, primary, 3),
          })
        );
        vTop += px(ms * aspect + 8);
      }
      pushBlock(block, vTop, onBadge);
      if (subline) {
        const sb = fitHeadline(subline, font, maxW, 30, 16);
        pushBlock(sb, cv + px(D / 2 + 14), secondary);
      }
      break;
    }
    case "crest": {
      const { D, rIn, rT, head, sub } = crest;
      const cv = top + px(22 + D / 2);
      layers.push(shapeL("circle", cv, D, primary, false, 9));
      layers.push(shapeL("circle", cv, Math.round(rIn * 2), secondary, false, 3));
      if (motif) {
        // Le motif tient dans l'anneau intérieur (diagonale de sa boîte) ; pas de rayons qui déborderaient.
        const ms = Math.floor(((rIn - 5) * 2) / Math.hypot(1, aspect));
        layers.push(motifL(cv, ms, cu, (motif.effects ?? []).filter((e) => e !== "rays")));
      } else {
        layers.push(shapeL(shape, cv, Math.round(rIn), secondary));
      }
      layers.push({ ...text(head.text, cv - px(rT), head.size, primary), arc: Math.round(rT) });
      if (sub) layers.push({ ...text(sub.text, cv + px(rT), sub.size, secondary), arc: -Math.round(rT) });
      for (const side of [-1, 1]) layers.push(shapeL("star", cv, 14, accent, true, 4, cu + side * px(rT)));
      break;
    }
    case "emblem": {
      let vTop;
      if (motif) {
        const ms = motifSize(100, maxW * 0.8);
        const mh = ms * aspect;
        layers.push(motifL(top + px(30 + mh / 2), ms));
        vTop = top + px(30 + mh + 16);
      } else {
        const s = 96;
        layers.push(shapeL(shape, top + px(36 + s / 2), s, secondary));
        vTop = top + px(36 + s + 18);
      }
      const block = fitHeadline(headline, font, maxW, 72);
      let v = pushBlock(block, vTop, primary);
      if (subline) {
        const sb = fitHeadline(subline, font, maxW * 0.62, 26, 14);
        v += px(12);
        const bottom = pushBlock(sb, v, secondary);
        if (sb.lines.length === 1) {
          const sw = textWidthPx(sb.lines[0], sb.size, font) / 2;
          const gap = sw + 18;
          const remaining = maxW / 2 - gap;
          const lineV = (v + bottom) / 2;
          if (remaining > 14) {
            layers.push(line(lineV, remaining / 2, accent, 4, px(gap + remaining / 2)));
            layers.push(line(lineV, remaining / 2, accent, 4, -px(gap + remaining / 2)));
          }
        }
      }
      break;
    }
    case "frame": {
      // Rectangle : hauteur = 0,7 × taille ; il s'allonge si le contenu est sur plusieurs lignes.
      const { block, sb, content, H, size, ms, mh } = frame;
      const cv = top + px(30 + H / 2);
      layers.push(shapeL("rect", cv, size, primary, false, 8));
      let v = cv - px(content / 2);
      if (ms) {
        layers.push(motifL(v + px(mh / 2), ms, cu, (motif.effects ?? []).filter((e) => e !== "rays")));
        v += px(mh + 10);
      }
      v = pushBlock(block, v, primary);
      if (sb) pushBlock(sb, v + px(8), secondary);
      break;
    }
    case "minimal": {
      const block = fitHeadline(headline, font, maxW * 0.6, 44, 20);
      if (motif) {
        // Illustration sobre (sans effet) mais bien visible au-dessus du titre.
        const ms = motifSize(64, maxW * 0.4);
        const mh = ms * aspect;
        layers.push(motifL(top + px(28 + mh / 2), ms, cu, []));
        pushBlock(block, top + px(28 + mh + 12), primary);
      } else {
        layers.push(shapeL(shape, top + px(40), 28, secondary));
        pushBlock(block, top + px(66), primary);
      }
      break;
    }
    case "back": {
      // Petit rappel sur la poitrine, grand visuel dans le dos.
      const front = zoneCenter("front");
      const small = fitHeadline(headline, font, front.width * 0.5, 30, 16);
      pushBlock(small, front.top + px(50), primary, front.u);
      const back = zoneCenter("back");
      const big = fitHeadline(headline, font, back.width * 0.88, 120);
      const backSub = subline ? fitHeadline(subline, font, back.width * 0.8, 34, 16) : null;
      const backH = (PRINT_ZONES.back.v1 - PRINT_ZONES.back.v0) * TEX;
      let v;
      // Grand motif dans le dos, s'il reste de la place au-dessus du titre.
      const room = backH - 40 - big.height - (backSub ? backSub.height + 20 : 0) - 30;
      if (motif && room >= 70) {
        const ms = motifSize(Math.min(150, room), back.width * 0.75);
        const mh = ms * aspect;
        layers.push(motifL(back.top + px(30 + mh / 2), ms, back.u));
        v = pushBlock(big, back.top + px(30 + mh + 20), primary, back.u);
      } else {
        const shapeV = back.top + px(60);
        layers.push(shapeL(shape, shapeV, 60, accent, true, 8, back.u));
        v = pushBlock(big, shapeV + px(30 + 22), primary, back.u);
      }
      if (backSub) pushBlock(backSub, v + px(20), secondary, back.u);
      break;
    }
    default: {
      // stack
      const block = fitHeadline(headline, font, maxW, 92);
      let start = 40;
      // Motif au-dessus du titre s'il reste de la place.
      const room = zoneH - 40 - block.height - 16 - (subline ? 50 : 0) - 30;
      if (motif && room >= 60) {
        const ms = motifSize(Math.min(90, room), maxW * 0.6);
        const mh = ms * aspect;
        layers.push(motifL(top + px(28 + mh / 2), ms));
        start = 28 + mh + 14;
      }
      let v = pushBlock(block, top + px(start), primary);
      const widest = Math.max(...block.lines.map((l) => textWidthPx(l, block.size, font)));
      v += px(16);
      layers.push(line(v, Math.min(maxW, widest) * 0.35, secondary, 8));
      if (subline) pushBlock(fitHeadline(subline, font, maxW, 32, 14), v + px(18), secondary);
    }
  }
  return layers;
}

// ------------------------------------------------------------------ Propositions

const pickDistinct = (rng, list, count) => {
  const shuffled = rng.shuffle(list);
  return Array.from({ length: count }, (_, i) => shuffled[i % shuffled.length]);
};

/**
 * Génère des propositions de design.
 * @param {{ prompt?: string, styleId?: string|null, placement?: "front"|"back"|null, text?: string }} input
 * @param {{ seed?: number, count?: number, year?: number }} options
 */
export function generateProposals(input = {}, { seed = 1, count = 3, year = 2026 } = {}) {
  const parsed = parsePrompt(input.prompt ?? "");
  const rng = createRng(hashString(`${input.prompt ?? ""}|${seed}`));
  const theme = parsed.theme;
  const forcedStyle = STYLES.find((s) => s.id === input.styleId) ?? parsed.style;
  const userText = (input.text ?? "").trim() ? clipText(input.text).text : parsed.text;
  const placement = input.placement ?? parsed.placement;
  // Le libellé du thème n'est imprimé que s'il a vraiment été reconnu (jamais « Libre »).
  const themeLabel = parsed.themeDetected ? theme.label : null;

  const styles = forcedStyle ? Array(count).fill(forcedStyle) : pickDistinct(rng, STYLES, count);
  const palettes = pickDistinct(rng, theme.palettes, count);
  const slogans = pickDistinct(rng, theme.slogans, count * 2);
  const usedLayouts = new Set();
  // Motifs : générateur séparé (les propositions existantes restent identiques pour une même demande).
  const motifRng = createRng(hashString(`${input.prompt ?? ""}|motif|${seed}`));
  const motifIds = parsed.motif ? Array(count).fill(parsed.motif) : pickDistinct(motifRng, theme.motifs ?? GENERIC_THEME.motifs, count);

  return Array.from({ length: count }, (_, i) => {
    const style = styles[i];
    const candidates = rng.shuffle(style.layouts.filter((l) => placement !== "back" || l !== "back"));
    const layout = candidates.find((l) => !usedLayouts.has(l)) ?? candidates[0];
    usedLayouts.add(layout);
    const palette = buildPalette(palettes[i], parsed, rng);
    const headline = userText || slogans[i];
    const sublineChoices = userText ? [slogans[i + count], themeLabel, `Édition ${year}`] : [themeLabel, `Édition ${year}`, null];
    const subline = layout === "minimal" ? null : rng.pick(sublineChoices.filter((s) => s !== undefined));
    const params = {
      layout,
      palette,
      // Écriture demandée dans le prompt : elle prime sur la police du style graphique.
      font: parsed.writing ? parsed.writing.fonts[i % parsed.writing.fonts.length] : style.fonts[i % style.fonts.length],
      uppercase: parsed.writing ? parsed.writing.uppercase : style.uppercase,
      headline,
      subline,
      shapes: rng.shuffle(theme.shapes),
      placement,
      noText: parsed.noText && !userText,
      artVariant: i,
      motif: { id: motifIds[i], effects: cleanEffects([...parsed.effects, ...(STYLE_EFFECTS[style.id] ?? [])]), seed: motifRng.int(1, 9999) },
    };
    const proposalId = `p${seed}-${i}`;
    const layers = buildLayers(params, proposalId);
    const trim = trimLayerFor(parsed.trims, palette, `${proposalId}-trim`);
    if (trim) layers.unshift(trim);
    const actualLayout = layoutOf(layout, layers);
    return {
      id: proposalId,
      title: `${LAYOUTS[actualLayout]} · ${style.label}`,
      themeLabel: theme.label,
      shirtColor: palette.shirt,
      view: placement === "back" || actualLayout === "back" ? "back" : "front",
      params: { ...params, layout: actualLayout },
      layers,
    };
  });
}

/**
 * Mise en page réellement obtenue : le badge, le cadre ou l'écusson se replient si le titre est trop long
 * (on l'affiche honnêtement dans le titre de la proposition).
 */
export { trimLayerFor };

export function layoutOf(layout, layers) {
  if (!layers.some((l) => l.type === "text") && layers.some((l) => l.type === "motif")) return "art";
  const hasShape = (kind) => layers.some((l) => l.type === "shape" && l.shape === kind && (kind !== "rect" || !l.filled));
  if (layout === "crest" && !layers.some((l) => l.arc)) return "emblem";
  if ((layout === "badge" && !hasShape("circle")) || (layout === "frame" && !hasShape("rect"))) return "stack";
  return layout;
}

/** Slogans suggérés pour une demande (thème détecté, sinon génériques). */
export function suggestSlogans(prompt = "", { seed = 1, count = 6 } = {}) {
  const { theme } = parsePrompt(prompt);
  const rng = createRng(hashString(`${prompt}|slogans|${seed}`));
  const pool = theme.id === GENERIC_THEME.id ? THEMES.flatMap((t) => t.slogans) : [...theme.slogans, ...GENERIC_THEME.slogans];
  return rng.shuffle([...new Set(pool)]).slice(0, count);
}

// ------------------------------------------------------------------ Variantes de couleurs

const colorsOf = (layers) => {
  const freq = new Map();
  for (const l of layers) if (l.color) freq.set(l.color.toLowerCase(), (freq.get(l.color.toLowerCase()) ?? 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
};

/** Recolore de bas en haut : chaque calque est rendu lisible sur TOUS ses fonds réels (déjà recolorés). */
const recolor = (layers, map, shirt) => {
  const out = [];
  layers.forEach((l, index) => {
    const target = map(l.color?.toLowerCase()) ?? l.color;
    out.push({ ...l });
    const bgs = backgroundsUnder(out, index, shirt);
    let color = target;
    if (bgs.some((bg) => contrastRatio(color, bg) < 1.5)) {
      // Quasi invisible : noir ou blanc net plutôt qu'un gris éclairci peu esthétique.
      color = ["#111111", "#ffffff"].sort((a, b) => Math.min(...bgs.map((bg) => contrastRatio(b, bg))) - Math.min(...bgs.map((bg) => contrastRatio(a, bg))))[0];
    } else {
      for (const bg of bgs) color = ensureContrast(color, bg, 3);
    }
    out[index].color = color;
    if (l.type === "trim") out[index].color2 = l.color2 ? ensureContrast(map(l.color2.toLowerCase()) ?? l.color2, shirt, 1.5) : l.color2;
    if (l.type === "motif") {
      // Couleurs 2 et 3 du motif : même transformation, lisibles sur le t-shirt.
      for (const key of ["color2", "accent"]) {
        const c = map(l[key]?.toLowerCase()) ?? l[key];
        out[index][key] = c ? ensureContrast(c, shirt, 3) : c;
      }
    }
  });
  return out;
};

const signature = (shirtColor, layers) =>
  `${shirtColor}|${layers.map((l) => [l.color, l.color2, l.accent].filter(Boolean).join("/")).join(",")}`;

/**
 * Déclinaisons de couleurs du design courant (t-shirt + calques). Les variantes identiques
 * au design courant ou entre elles sont écartées.
 * @returns {{ id, label, shirtColor, layers }[]}
 */
export function colorVariants({ shirtColor = "#ffffff", layers = [] } = {}) {
  const shirt = normalizeHex(shirtColor) ?? "#ffffff";
  const colors = colorsOf(layers);
  const main = colors[0] ?? bestOnColor(shirt);
  const [mainHue, mainSat] = hexToHsl(main);
  const darkShirt = contrastRatio(shirt, "#ffffff") > contrastRatio(shirt, "#111111");
  // Design en noir/blanc/gris : la rotation de teinte n'aurait aucun effet → on introduit une couleur.
  const achromatic = mainSat < 0.12;
  const shift = (deg, fallbackHue) => (c) => {
    if (!c) return c;
    const [, s, l] = hexToHsl(c);
    return s < 0.12 ? hslToHex([fallbackHue, 0.7, Math.min(0.6, Math.max(0.35, l))]) : rotateHue(c, deg);
  };
  const monoLadder = [0.3, 0.5, 0.7];
  const monoHue = achromatic ? 0 : mainHue;

  const variants = [
    { id: "inverted", label: "Inversée", shirtColor: main, map: (c) => (c === main ? shirt : c) },
    { id: "complementary", label: "Complémentaire", shirtColor: shirt, map: shift(180, 0) },
    { id: "analogous", label: "Analogue", shirtColor: shirt, map: shift(40, 215) },
    {
      id: "mono",
      label: "Monochrome",
      shirtColor: shirt,
      map: (c) => hslToHex([monoHue, 0.65, monoLadder[Math.max(0, colors.indexOf(c)) % monoLadder.length]]),
    },
    {
      id: "bw",
      label: darkShirt ? "Blanc sur fond sombre" : "Noir & blanc",
      shirtColor: darkShirt ? shirt : "#ffffff",
      map: (c) => {
        const rank = Math.max(0, colors.indexOf(c));
        return darkShirt ? ["#ffffff", "#bdbdbd", "#8a8a8a"][rank % 3] : ["#111111", "#555555", "#9e9e9e"][rank % 3];
      },
    },
  ];

  const seen = new Set([signature(shirt, layers)]);
  const out = [];
  for (const v of variants) {
    const recolored = recolor(layers, v.map, v.shirtColor);
    const sig = signature(v.shirtColor, recolored);
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ id: v.id, label: v.label, shirtColor: v.shirtColor, layers: recolored });
  }
  return out;
}

// ------------------------------------------------------------------ Calque de texte isolé (slogans)

/**
 * Calque de texte prêt à poser dans la zone (poitrine ou dos), lisible et sans recouvrir l'existant.
 * @param {string} text
 * @param {{ shirtColor?, placement?, font?, color?, id?, existing?: object[] }} options
 *   `existing` : calques (et éventuel texte principal) à ne pas recouvrir.
 */
export function textLayerFor(
  text,
  { shirtColor = "#ffffff", placement = "front", font = "Bebas Neue", color, id = "slogan", existing = [] } = {}
) {
  const shirt = normalizeHex(shirtColor) ?? "#ffffff";
  const zoneId = placement === "back" ? "back" : "front";
  const zone = PRINT_ZONES[zoneId];
  const { u, width, top } = zoneCenter(zoneId);
  const ink = ensureContrast(color ?? (contrastRatio("#a40000", shirt) >= 3 ? "#a40000" : bestOnColor(shirt)), shirt, 3);
  const make = (v, s) => ({ id, type: "text", text, x: r4(u), y: r4(v), size: s, rotation: 0, color: ink, font });
  const base = fitTextSize(text, font, width * 0.86, 72, MIN_TEXT_PX);

  // Cherche, de haut en bas, la première bande libre de la zone (pas de chevauchement avec l'existant).
  const others = existing.map(layerBox);
  for (const s of [base, Math.round(base * 0.75), Math.round(base * 0.55)]) {
    if (s < MIN_TEXT_PX) break;
    for (let v = top + (30 + s / 2) / TEX; v + s / 2 / TEX <= zone.v1; v += 8 / TEX) {
      const candidate = make(v, s);
      const box = layerBox(candidate);
      if (others.every((o) => overlapArea(box, o) === 0)) return candidate;
    }
  }
  // Aucune place libre : en bas de la zone.
  const size = Math.max(MIN_TEXT_PX, Math.round(base * 0.55));
  return make(zone.v1 - (10 + size / 2) / TEX, size);
}
