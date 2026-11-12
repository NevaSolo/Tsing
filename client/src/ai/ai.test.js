/* Tests du pont IA → Studio, avec des réponses de modèle SIMULÉES (aucun modèle requis). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BRIEF_SCHEMA, buildBriefMessages, isAcceptableSlogan, normalizeBrief, STYLE_IDS, THEME_IDS } from "./brief.js";
import { proposalsFromBrief } from "./fromBrief.js";
import { checkDesign } from "../studio/checker.js";
import { sanitizeLayers } from "../canvas/utils/layers.js";

// Sorties réelles du modèle Qwen3.5-2B mesurées sur la machine de développement (filtrées ou conservées).
test("filtre des slogans : sorties réelles du modèle", () => {
  const raw = {
    theme: "animals", style: "playful", shirt_color: "#4a4a4a", main_color: "#ffffff", second_color: "#e3e3e3",
    slogans: ["Biscotte! Ça marche!", "Ma Chère,", "Biscotte, ça vous a fait la差"], summary: "",
  };
  assert.deepEqual(normalizeBrief(raw).slogans, ["Biscotte! Ça marche!", "Ma Chère"]);
  assert.equal(isAcceptableSlogan("Le Gouffre de la Mort"), false);
  assert.equal(isAcceptableSlogan("Couleur Mauvaise"), false);
  assert.equal(isAcceptableSlogan("Nuit des Jeux"), true);
  assert.equal(isAcceptableSlogan("Vive la Vague"), true);
  assert.equal(isAcceptableSlogan("Un slogan bien trop long pour un t-shirt"), false);
  // Mots entiers seulement : pas de faux positifs
  for (const ok of ["Une statue de sel", "Tout le charme", "Annuler le lundi", "Sang-froid royal".replace("Sang-froid", "Garde")]) {
    assert.equal(isAcceptableSlogan(ok), true, ok);
  }
});

const VALID = {
  theme: "surf",
  style: "vintage",
  placement: "front",
  shirt_color: "#FDF6EC",
  main_color: "#e4572e",
  second_color: "#17bebb",
  slogans: ["Vague après vague", "« Sel sur la peau »", "Cap à l'ouest"],
  summary: "Un logo rétro pour un club de surf, tons chauds.",
};

test("schéma : listes fermées alignées sur le catalogue, tout est requis", () => {
  assert.deepEqual(BRIEF_SCHEMA.properties.theme.enum, THEME_IDS);
  assert.deepEqual(BRIEF_SCHEMA.properties.style.enum, STYLE_IDS);
  assert.deepEqual([...BRIEF_SCHEMA.required].sort(), Object.keys(BRIEF_SCHEMA.properties).sort());
  assert.equal(BRIEF_SCHEMA.additionalProperties, false);
});

test("messages : consignes + demande ; le texte imposé est transmis tel quel", () => {
  const [system, user] = buildBriefMessages("surf rétro", { text: "Les Vagues" });
  assert.equal(system.role, "system");
  assert.ok(THEME_IDS.every((id) => system.content.includes(id)), "tous les thèmes sont proposés");
  assert.ok(!system.content.includes('"properties"'), "le schéma n'est pas recopié (coût de lecture)");
  assert.ok(system.content.length < 600, `consigne courte (${system.content.length} car.)`);
  assert.ok(user.content.includes("surf rétro") && user.content.includes("Les Vagues"));
});

test("normalisation : brief valide (JSON texte), guillemets retirés, couleurs normalisées", () => {
  const b = normalizeBrief(JSON.stringify(VALID));
  assert.equal(b.theme, "surf");
  assert.equal(b.shirtColor, "#fdf6ec");
  assert.deepEqual(b.colors, ["#e4572e", "#17bebb"]);
  assert.deepEqual(b.slogans, ["Vague après vague", "Sel sur la peau", "Cap à l'ouest"]);
});

test("normalisation : sorties de modèle défectueuses", () => {
  assert.equal(normalizeBrief("pas du json {"), null);
  assert.equal(normalizeBrief(null), null);
  assert.equal(normalizeBrief({}), null, "ni slogan ni couleur → inutilisable");
  const b = normalizeBrief({
    theme: "licornes",
    style: "baroque",
    placement: "côté",
    shirt_color: "bleu",
    main_color: "#zzz",
    second_color: "#123",
    slogans: ["", "x", "Un slogan beaucoup trop long qui dépasse largement la limite permise ici", "Un slogan beaucoup trop long qui dépasse largement la limite permise ici"],
  });
  assert.equal(b.theme, "generic");
  assert.equal(b.style, null);
  assert.equal(b.shirtColor, null);
  assert.deepEqual(b.colors, ["#112233"]);
  assert.deepEqual(b.slogans, [], "vides, trop courts, trop longs et doublons écartés (les couleurs restent utiles)");
});

const BRIEFS = [
  VALID,
  { ...VALID, theme: "gaming", style: "bold", shirt_color: "#111111", main_color: "#39ff14", second_color: "#ff2fd1", slogans: ["Respawn illimité", "Manette en main", "Zéro lag"] },
  // Couleurs illisibles sur le tissu : le moteur doit les corriger
  { ...VALID, shirt_color: "#ffffff", main_color: "#fefefe", second_color: "#ffff66" },
  { ...VALID, theme: "generic", style: "playful", slogans: ["Joyeux anniversaire à notre super papa adoré", "Le roi du barbecue", "Papa poule"] },
  // Brief minimal : un seul slogan, pas de couleur du tissu
  { theme: "love", style: "minimal", placement: "front", shirt_color: "nope", main_color: "#d00000", second_color: "", slogans: ["Toi et moi"], summary: "" },
];

test("propositions issues de l'IA : valides, lisibles, dans la zone, sans aucun point à vérifier", () => {
  let n = 0;
  for (const raw of BRIEFS) {
    const brief = normalizeBrief(raw);
    assert.ok(brief);
    for (const styleId of [null, ...STYLE_IDS]) {
      for (const text of ["", "Les Vagues", "Joyeux anniversaire à notre super papa !"]) {
        for (let seed = 1; seed <= 4; seed++) {
          for (const p of proposalsFromBrief(brief, { prompt: "test", text, styleId, seed })) {
            n++;
            const ctx = `${raw.theme}/${styleId}/${text}/${seed} ${p.title}`;
            assert.equal(p.source, "ai");
            assert.deepEqual(sanitizeLayers(p.layers), p.layers, ctx);
            const issues = checkDesign({ shirtColor: p.shirtColor, layers: p.layers }).filter((i) => i.level !== "info");
            assert.deepEqual(issues, [], ctx);
          }
        }
      }
    }
  }
  assert.equal(n, 900, `${n} propositions`);
});

test("propositions : les slogans de l'IA sont utilisés, le texte imposé est prioritaire", () => {
  const brief = normalizeBrief(VALID);
  const props = proposalsFromBrief(brief, { prompt: "surf", styleId: "vintage", seed: 1 });
  const printed = props.flatMap((p) => p.layers.filter((l) => l.type === "text").map((l) => l.text)).join(" | ");
  assert.ok(brief.slogans.some((s) => printed.includes(s)), printed);
  const withText = proposalsFromBrief(brief, { prompt: "surf", text: "Les Vagues", styleId: "vintage", seed: 1 });
  assert.ok(withText.every((p) => p.layers.some((l) => l.type === "text" && l.text === "Les Vagues")));
});

test("emplacement : déduit de la demande, pas du modèle", () => {
  const brief = normalizeBrief({ ...VALID, placement: "back" });
  assert.ok(proposalsFromBrief(brief, { prompt: "club de surf", seed: 1 }).every((p) => p.params.placement === "front"));
  assert.ok(proposalsFromBrief(brief, { prompt: "streetwear dans le dos", seed: 1 }).every((p) => p.params.placement === "back"));
  assert.ok(proposalsFromBrief(brief, { prompt: "dans le dos", placement: "front", seed: 1 }).every((p) => p.params.placement === "front"), "choix explicite prioritaire");
});

test("la demande explicite prime sur le modèle : texte cité, couleurs nommées, style", () => {
  const brief = normalizeBrief({ ...VALID, shirt_color: "#ffffff", style: "playful" });
  const props = proposalsFromBrief(brief, { prompt: "t-shirt noir surf « Ride free » texte rouge, style vintage", seed: 1 });
  for (const p of props) {
    assert.equal(p.shirtColor, "#111111", "t-shirt noir demandé");
    assert.ok(p.layers.some((l) => l.type === "text" && l.text === "Ride free"), "texte cité");
    assert.ok(p.title.endsWith("Vintage"), p.title);
  }
});

test("texte imposé trop long : coupé entre deux mots (comme le générateur)", () => {
  const brief = normalizeBrief(VALID);
  const [p] = proposalsFromBrief(brief, { text: "Joyeux anniversaire à notre super papa Bernard", seed: 1 });
  const printed = p.layers.filter((l) => l.type === "text").map((l) => l.text).join(" ");
  assert.ok(!printed.includes("papa B"), printed); // ni « papa B » coupé, ni « papa Bernard » entier
});

test("slogans : doublons insensibles à la casse, sans lettres, typographie, résumé filtré", () => {
  const b = normalizeBrief({ ...VALID, slogans: ["Belle vague", "BELLE VAGUE", "belle-vague !"], summary: "一个 t-shirt de mort" });
  assert.deepEqual(b.slogans, ["Belle vague"]);
  assert.equal(isAcceptableSlogan("Esprit vague"), false, "exemple recopié de l'ancienne consigne");
  assert.equal(b.summary, "");
  assert.deepEqual(normalizeBrief({ ...VALID, slogans: ["!!", "--", "..."] }).slogans, []);
  for (const ok of ["Café…", "Rock / Roll", "Surf + soleil", "Été – 2026"]) assert.equal(isAcceptableSlogan(ok), true, ok);
});

test("propositions : couleur du tissu choisie par l'IA respectée", () => {
  const brief = normalizeBrief({ ...VALID, shirt_color: "#0b3954" });
  for (const p of proposalsFromBrief(brief, { seed: 2 })) assert.equal(p.shirtColor, "#0b3954");
});

test("progression de WebLLM traduite en français", async () => {
  const { describeProgress } = await import("./localAI.js");
  assert.equal(describeProgress("Start to fetch params"), "Téléchargement du modèle : premier bloc en cours…");
  assert.equal(
    describeProgress("Fetching param cache[3/31]: 300MB fetched. 28% completed, 600 secs elapsed. It can take a while"),
    "Téléchargement : 300 Mo reçus (fichier 3 sur 31)"
  );
  assert.equal(describeProgress("Loading model from cache[5/31]: 400MB loaded."), "Chargement en mémoire graphique (5/31)");
  assert.equal(describeProgress("autre"), "autre");
});

test("consigne exportée pour le serveur (ai_spec.json) : identique à celle du navigateur", async () => {
  const { readFileSync } = await import("node:fs");
  const { buildAiSpec } = await import("./spec.js");
  const file = JSON.parse(readFileSync(new URL("../../../ecommerce_backend/store/ai_spec.json", import.meta.url), "utf8"));
  assert.deepEqual(file, buildAiSpec(), "relancez « npm run ai:spec » après avoir modifié brief.js");
});
