/*
 * « Brief » produit par l'IA locale : une réponse COURTE (≈ 120 tokens) que le moteur du Studio
 * transforme en propositions. Le modèle ne dessine rien : il choisit dans nos listes et écrit des slogans.
 * Module pur (aucune dépendance au navigateur) : testé avec node --test.
 */
import { GENERIC_THEME, STYLES, THEMES } from "../studio/catalog.js";
import { normalizeHex } from "../studio/color.js";
import { MAX_TEXT_LENGTH } from "../studio/engine.js";
import { cleanEffects, EFFECT_IDS, MAX_EFFECTS, MOTIF_IDS } from "../studio/motifs.js";

export const THEME_IDS = [...THEMES.map((t) => t.id), GENERIC_THEME.id];
export const STYLE_IDS = STYLES.map((s) => s.id);

const HEX = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };
const SLOGAN_MAX = 28;

/** Schéma JSON imposé au modèle (génération contrainte par WebLLM / XGrammar). */
export const BRIEF_SCHEMA = {
  type: "object",
  properties: {
    theme: { type: "string", enum: THEME_IDS },
    style: { type: "string", enum: STYLE_IDS },
    shirt_color: HEX,
    main_color: HEX,
    second_color: HEX,
    // Pas de maxLength ici : la grammaire fermerait le slogan en plein mot. La longueur est guidée par
    // la consigne (2 à 4 mots), et les slogans trop longs sont écartés à la normalisation.
    slogans: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 },
    summary: { type: "string", maxLength: 80 },
    // Illustration principale (dessinée par le moteur) et effets : listes fermées.
    // Dessin principal décrit en 1 à 4 mots-clés ANGLAIS (sujet d'abord) : on cherche ensuite
    // l'illustration correspondante dans la bibliothèque (illustrations.js).
    illustration: { type: "array", items: { type: "string", pattern: "^[a-z]{2,15}$" }, minItems: 1, maxItems: 4 },
    effects: { type: "array", items: { type: "string", enum: EFFECT_IDS }, maxItems: MAX_EFFECTS },
  },
  // L'emplacement (poitrine / dos) n'est PAS demandé au modèle : il le devinait mal (mesuré) ;
  // les mots-clés (« dos », « back ») le détectent de façon fiable.
  required: ["theme", "style", "shirt_color", "main_color", "second_color", "slogans", "summary", "illustration", "effects"],
  additionalProperties: false,
};

/**
 * Messages envoyés au modèle. VOLONTAIREMENT COURTS : sur une carte graphique intégrée, la lecture de la
 * consigne coûte ≈ 0,12 s par token (mesuré : 480 tokens = 55 s avant le premier mot). Le schéma JSON
 * n'est PAS recopié ici : la génération contrainte (grammaire) impose déjà la structure exacte.
 */
export function buildBriefMessages(prompt, { text } = {}) {
  const system =
    "Directeur artistique de t-shirts. Réponds en JSON : " +
    `theme (${THEME_IDS.join(", ")}), ` +
    "style (minimal, vintage, bold, playful), " +
    "shirt_color, main_color, second_color (#rrggbb, lisibles sur le tissu), " +
    "slogans (3, liés au sujet de la demande, en bon français, 2 à 4 mots), " +
    "summary (phrase courte), illustration (dessin voulu : 1 à 4 mots-clés anglais, sujet d'abord, ex. woman, silhouette), " +
    "effects (0 à 2 : frost, rays, distressed, glow, sparkles).";
  const user = text ? `${prompt}
Texte imposé : ${text}` : prompt;
  return [
    { role: "system", content: system },
    { role: "user", content: user },
  ];
}

const cleanSlogan = (s) =>
  Array.from(
    String(s ?? "")
      .replace(/^["«“'\s]+|["»”'\s]+$/g, "")
      .replace(/[,;:]+$/, "") // ponctuation pendante (« Ma Chère, »)
      .replace(/\s+/g, " ")
      .trim()
  )
    .slice(0, MAX_TEXT_LENGTH)
    .join("")
    .trim();

// Écriture latine uniquement : le petit modèle laisse parfois échapper un caractère chinois (mesuré).
const FOREIGN_SCRIPT = /[^\p{Script=Latin}\p{N}\s'’!?.,;&:%«»"()/+#@*…–—-]/u;
// Mots déplacés sur un t-shirt (le modèle a produit « Le Gouffre de la Mort » pour un cadeau).
const UNWANTED = /\b(mort|morts|mourir|meurt|mauvais|mauvaise|haine|tuer|tue|guerre|danger|dangereux|gouffre|sang|nul|nulle|triste|deces|cadavre|suicide|drogue|arme|armes)\b/;
const normalizeWords = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Un slogan est retenu s'il est lisible, en écriture latine et sans mot déplacé. */
// Mots-outils anglais : le modèle glisse parfois des slogans en anglais (mesuré : « Stress Free »).
const ENGLISH = /\b(the|to|of|and|with|your|you|my|is|are|for|from|be|free|stress|get|let|it|its|our|this|that|just)\b/;

const COPIED_EXAMPLES = new Set(["esprit vague", "cap sur la mer"]);
// Instructions techniques recopiées par le modèle (mesuré : « no_think » parmi les slogans).
const ARTIFACT = /think|_/i;

export const isAcceptableSlogan = (s) =>
  Array.from(s).length <= SLOGAN_MAX &&
  !COPIED_EXAMPLES.has(normalizeWords(s).trim()) &&
  !ARTIFACT.test(s) &&
  !ENGLISH.test(normalizeWords(s)) &&
  (s.match(/\p{L}/gu) ?? []).length >= 2 &&
  !FOREIGN_SCRIPT.test(s) &&
  !UNWANTED.test(normalizeWords(s));

/** Résumé affiché à l'utilisateur : mêmes filtres que les slogans, coupé proprement (sans couper un emoji). */
const cleanSummary = (s) => {
  if (typeof s !== "string") return "";
  const text = Array.from(s.replace(/\s+/g, " ").trim()).slice(0, 80).join("");
  return text && !FOREIGN_SCRIPT.test(text) && !UNWANTED.test(normalizeWords(text)) ? text : "";
};

/**
 * Valide et répare un brief (la contrainte de schéma limite déjà les écarts, mais on ne fait jamais
 * confiance à une sortie de modèle). Renvoie null si le brief est inutilisable.
 */
export function normalizeBrief(raw) {
  let data = raw;
  if (typeof data === "string") {
    try {
      data = JSON.parse(data);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const seen = new Set();
  const slogans = (Array.isArray(data.slogans) ? data.slogans : [])
    .map(cleanSlogan)
    .filter(isAcceptableSlogan)
    .filter((s) => {
      const key = normalizeWords(s).replace(/[^\p{L}\p{N}]+/gu, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const colors = [data.main_color, data.second_color].map(normalizeHex).filter(Boolean);
  if (!slogans.length && !colors.length) return null;
  return {
    theme: THEME_IDS.includes(data.theme) ? data.theme : GENERIC_THEME.id,
    style: STYLE_IDS.includes(data.style) ? data.style : null,
    shirtColor: normalizeHex(data.shirt_color),
    colors,
    slogans: slogans.slice(0, 3),
    summary: cleanSummary(data.summary),
    motif: MOTIF_IDS.includes(data.motif) ? data.motif : null,
    illustration: [...new Set((Array.isArray(data.illustration) ? data.illustration : [])
      .map((k) => String(k).toLowerCase().replace(/[^a-z]/g, ""))
      .filter((k) => k.length >= 2 && k.length <= 15))].slice(0, 4),
    effects: cleanEffects(data.effects),
  };
}
