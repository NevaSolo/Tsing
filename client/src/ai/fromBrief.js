/*
 * Brief de l'IA → propositions du Studio, avec le même moteur de mise en page que le générateur
 * par mots-clés (contraste garanti, textes découpés, zone imprimable respectée).
 */
import { GENERIC_THEME, STYLES, THEMES } from "../studio/catalog.js";
import { buildLayers, buildPalette, clipText, LAYOUTS, layoutOf, parsePrompt, trimLayerFor } from "../studio/engine.js";
import { cleanEffects, STYLE_EFFECTS } from "../studio/motifs.js";
import { motifFromIllustration } from "../studio/illustrations.js";
import { createRng, hashString } from "../studio/random.js";

const pickDistinct = (rng, list, count) => {
  const shuffled = rng.shuffle(list);
  return Array.from({ length: count }, (_, i) => shuffled[i % shuffled.length]);
};


/**
 * @param {ReturnType<import("./brief.js").normalizeBrief>} brief
 * @param {{ prompt?: string, text?: string, styleId?: string|null, placement?: "front"|"back"|null, seed?: number, count?: number, year?: number }} options
 */
export function proposalsFromBrief(brief, { prompt = "", text = "", styleId = null, placement = null, seed = 1, count = 3, year = 2026 } = {}) {
  const rng = createRng(hashString(`ai|${prompt}|${seed}`));
  // Ce que l'utilisateur a écrit EXPLICITEMENT prime sur l'interprétation du modèle :
  // texte entre guillemets, couleur du t-shirt, couleurs nommées, style nommé, « dans le dos ».
  const explicit = parsePrompt(prompt);
  const theme = THEMES.find((t) => t.id === brief.theme) ?? GENERIC_THEME;
  const themeLabel = theme.id === GENERIC_THEME.id ? null : theme.label;
  const forced = STYLES.find((s) => s.id === styleId) ?? explicit.style ?? STYLES.find((s) => s.id === brief.style) ?? null;
  const styles = forced ? Array(count).fill(forced) : pickDistinct(rng, STYLES, count);
  const palettes = pickDistinct(rng, theme.palettes, count);
  // Emplacement : choix explicite, sinon déduit de la demande (« dans le dos »), jamais du modèle.
  const where = placement ?? explicit.placement;
  const userText = (text ?? "").trim() ? clipText(text).text : explicit.text ?? "";
  const colorHints = {
    colors: explicit.colors.length ? explicit.colors : brief.colors,
    shirtColor: explicit.shirtColor ?? brief.shirtColor,
  };
  // Slogans de l'IA d'abord (réutilisés s'il y en a peu) ; ceux du thème seulement si elle n'en a donné aucun
  // (mesuré : « Team chat » du thème Animaux sous un loup qui hurle à la lune).
  const aiSlogans = brief.slogans;
  const slogans = aiSlogans.length ? aiSlogans : rng.shuffle(theme.slogans);
  const usedLayouts = new Set();
  // Illustration : celles trouvées pour la description de l'IA (brief.illustrations, voir StudioPanel),
  // précédées du motif que l'utilisateur nomme en français ; à défaut, les motifs du thème.
  // Elles tournent d'une proposition à l'autre, et à chaque « Nouvelles variantes » (graine).
  const motifRng = createRng(hashString(`ai|${prompt}|motif|${seed}`));
  const found = (brief.illustrations ?? []).map(motifFromIllustration);
  // Les illustrations trouvées pour l'IA priment : le mot français repéré dans la demande (« feu ») n'est
  // qu'un indice — sinon « un dragon qui crache du feu » donnait des flammes au lieu du dragon.
  const pool = found.length ? found : explicit.motif ? [{ id: explicit.motif }] : [];
  const fallback = brief.motif ? [{ id: brief.motif }] : null;
  const motifs = pool.length
    ? Array.from({ length: count }, (_, i) => pool[(i + (seed - 1) * count) % pool.length])
    : fallback
      ? Array(count).fill(fallback[0])
      : pickDistinct(motifRng, theme.motifs ?? GENERIC_THEME.motifs, count).map((id) => ({ id }));
  // Le givre seulement si la demande évoque le froid (mesuré : l'IA givrait un dragon qui crache du feu).
  const askedEffects = [...explicit.effects, ...(brief.effects ?? []).filter((e) => e !== "frost" || explicit.effects.includes("frost"))];

  return Array.from({ length: count }, (_, i) => {
    const style = styles[i];
    const candidates = rng.shuffle(style.layouts.filter((l) => where !== "back" || l !== "back"));
    const layout = candidates.find((l) => !usedLayouts.has(l)) ?? candidates[0];
    usedLayouts.add(layout);
    const palette = buildPalette(palettes[i], colorHints, rng);
    const headline = userText || slogans[i % slogans.length];
    const subline =
      layout === "minimal"
        ? null
        : userText
          ? aiSlogans[i % Math.max(1, aiSlogans.length)]
          : rng.pick([themeLabel, `Édition ${year}`, aiSlogans.length > 1 ? aiSlogans[(i + 1) % aiSlogans.length] : null].filter(Boolean));
    const params = {
      layout,
      palette,
      font: explicit.writing ? explicit.writing.fonts[i % explicit.writing.fonts.length] : style.fonts[i % style.fonts.length],
      uppercase: explicit.writing ? explicit.writing.uppercase : style.uppercase,
      headline,
      subline: subline === headline ? null : subline,
      shapes: rng.shuffle(theme.shapes),
      placement: where,
      noText: explicit.noText && !userText,
      artVariant: i,
      motif: { ...motifs[i], effects: cleanEffects([...askedEffects, ...(STYLE_EFFECTS[style.id] ?? [])]), seed: motifRng.int(1, 9999) },
    };
    const id = `ai${seed}-${i}`;
    const layers = buildLayers(params, id);
    // Bordures demandées dans la phrase (« liseré blanc au col ») : même règle qu'en mode mots-clés.
    const trim = trimLayerFor(explicit.trims, palette, `${id}-trim`);
    if (trim) layers.unshift(trim);
    const actualLayout = layoutOf(layout, layers);
    return {
      id,
      source: "ai",
      title: `${LAYOUTS[actualLayout]} · ${style.label}`,
      themeLabel: theme.label,
      shirtColor: palette.shirt,
      view: where === "back" || actualLayout === "back" ? "back" : "front",
      params: { ...params, layout: actualLayout },
      layers,
    };
  });
}
