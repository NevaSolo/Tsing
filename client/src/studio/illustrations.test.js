// Illustrations de bibliothèque choisies d'après la description de l'IA (node --test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { iconPaths, searchIllustrations } from "./illustrations.js";
import { checkDesign } from "./checker.js";
import { colorVariants } from "./engine.js";
import { sanitizeLayers } from "../canvas/utils/layers.js";
import { normalizeBrief } from "../ai/brief.js";
import { proposalsFromBrief } from "../ai/fromBrief.js";

const read = (set) => JSON.parse(readFileSync(new URL(`../../node_modules/@iconify-json/${set}/icons.json`, import.meta.url), "utf8"));
const loader = async () => ({ "game-icons": read("game-icons"), mdi: read("mdi") });
const search = (keywords, limit = 6) => searchIllustrations(keywords, { limit, loader });
const problems = (p) => checkDesign({ shirtColor: p.shirtColor, layers: p.layers }).filter((i) => i.level !== "info").map((i) => i.message);

test("recherche : le sujet d'abord, nos motifs dessinés quand ils correspondent", async () => {
  const woman = await search(["woman", "silhouette"]);
  assert.ok(woman.length >= 3);
  assert.match(woman[0].icon, /female|woman/, JSON.stringify(woman.map((w) => w.icon)));
  assert.equal((await search(["guitar", "rock"]))[0].icon, "game-icons:guitar");
  const mountain = await search(["mountain", "snow"]);
  assert.deepEqual([mountain[0].kind, mountain[0].id], ["motif", "mountains"]);
  assert.match((await search(["wolf", "howl"]))[0].icon, /wolf/);
  assert.deepEqual(await search([]), []);
  assert.deepEqual(await search(["zzzzqqq"]), []);
});

test("recherche : uniquement des tracés pleins et sûrs, crédit de licence joint", async () => {
  for (const r of await search(["dragon", "fire"], 12)) {
    if (r.kind !== "icon") continue;
    assert.ok(r.paths.length > 0 && r.vb[0] > 0, r.icon);
    assert.ok(r.credit, r.icon);
  }
  assert.equal(iconPaths('<path stroke="currentColor" d="M0 0L1 1"/>'), null);
  assert.equal(iconPaths('<g transform="x"><path d="M0 0"/></g>'), null);
  assert.equal(iconPaths('<path d="M0 0&quot;onload"/>'), null);
  assert.deepEqual(iconPaths('<path fill="currentColor" d="M0 0L1 1Z"/>'), ["M0 0L1 1Z"]);
});

test("exemple « silhouette de femme » : l'illustration est dans chaque proposition, prête à imprimer", async () => {
  const raw = normalizeBrief({
    theme: "love", style: "minimal", shirt_color: "#111111", main_color: "#ff6fa5", second_color: "#ffffff",
    slogans: ["Femme fatale", "Élégance pure", "Sans complexe"], summary: "Silhouette féminine élégante.",
    illustration: ["woman", "silhouette", "female"], effects: [],
  });
  assert.deepEqual(raw.illustration, ["woman", "silhouette", "female"]);
  const brief = { ...raw, illustrations: await search(raw.illustration) };
  const prompt = "T-shirt sexy avec un logo de silhouette d'une femme";
  const seen = new Set();
  for (let seed = 1; seed <= 3; seed++) {
    for (const p of proposalsFromBrief(brief, { prompt, seed })) {
      const m = p.layers.find((l) => l.type === "motif");
      assert.equal(m.motif, "icon", p.title);
      assert.match(m.icon, /female|woman/, m.icon);
      seen.add(m.icon);
      assert.deepEqual(problems(p), [], p.title);
      // Enregistré puis rechargé à l'identique ; variantes de couleurs lisibles.
      assert.deepEqual(sanitizeLayers(JSON.stringify(p.layers)), p.layers);
      for (const v of colorVariants({ shirtColor: p.shirtColor, layers: p.layers })) assert.deepEqual(problems(v), [], v.label);
    }
  }
  assert.ok(seen.size >= 3, `les variantes font tourner les illustrations : ${[...seen]}`);
});

test("sans illustration trouvée : motifs du thème (jamais de proposition vide)", async () => {
  const brief = { ...normalizeBrief({ theme: "surf", style: "bold", shirt_color: "#ffffff", main_color: "#0081a7", second_color: "#f07167", slogans: ["Esprit vague"], summary: "", illustration: ["zzzzqqq"], effects: [] }), illustrations: [] };
  for (const p of proposalsFromBrief(brief, { prompt: "surf", seed: 1 })) {
    assert.ok(p.layers.some((l) => l.type === "motif"), p.title);
    assert.deepEqual(problems(p), [], p.title);
  }
});

test("calque illustration : tracés dangereux ou incomplets rejetés au chargement", () => {
  const base = { id: "i", type: "motif", motif: "icon", x: 0.26, y: 0.3, size: 100, color: "#000" };
  assert.equal(sanitizeLayers([{ ...base, paths: ["<script>alert(1)</script>"], vb: [24, 24] }]).length, 0);
  assert.equal(sanitizeLayers([{ ...base, paths: ["M0 0Z"], vb: [0, 24] }]).length, 0);
  assert.equal(sanitizeLayers([{ ...base, vb: [24, 24] }]).length, 0);
  assert.equal(sanitizeLayers([{ ...base, paths: ["M0 0L24 24Z"], vb: [24, 24] }]).length, 1);
});

test("« pas de texte » : illustration seule (3 présentations), lisible, devant comme dans le dos", async () => {
  const raw = normalizeBrief({
    theme: "space", style: "bold", shirt_color: "#111111", main_color: "#d62828", second_color: "#f77f00",
    slogans: ["Dragon de feu"], summary: "", illustration: ["dragon", "fire"], effects: [],
  });
  const brief = { ...raw, illustrations: await search(raw.illustration) };
  for (const prompt of [
    "Un dragon qui crache du feu, t-shirt noir, style percutant, rouge et orange, effet flammes pas de texte",
    "dragon sans slogan, juste le dessin, dans le dos",
  ]) {
    const props = proposalsFromBrief(brief, { prompt, seed: 1 });
    assert.equal(new Set(props.map((p) => p.layers.filter((l) => l.type === "shape").length)).size, 3, "3 présentations différentes");
    for (const p of props) {
      assert.equal(p.layers.filter((l) => l.type === "text").length, 0, p.title);
      const m = p.layers.find((l) => l.type === "motif");
      // Le dragon trouvé pour l'IA prime sur le mot « feu » de la demande.
      assert.match(m.icon ?? "", /dragon/, `${p.title} : ${m.icon ?? m.motif}`);
      assert.ok(p.title.startsWith("Illustration"), p.title);
      assert.deepEqual(problems(p), [], p.title);
    }
  }
  // Un texte entre guillemets ou saisi reste imprimé.
  const quoted = proposalsFromBrief(brief, { prompt: "dragon, pas de slogan mais le texte « Draco »", seed: 1 });
  assert.ok(quoted.every((p) => p.layers.some((l) => l.type === "text" && /draco/i.test(l.text))));
  const typed = proposalsFromBrief(brief, { prompt: "dragon sans texte", text: "Draco", seed: 1 });
  assert.ok(typed.every((p) => p.layers.some((l) => l.type === "text")));
});

test("mots-clés : sujets nommés dans la demande d'abord, puis ceux de l'IA", async () => {
  const { illustrationKeywords } = await import("./illustrations.js");
  assert.deepEqual(illustrationKeywords("Un dragon qui crache du feu, pas de texte", ["burning", "dragon"]), ["dragon", "fire", "burning"]);
  assert.deepEqual(illustrationKeywords("logo de silhouette d'une femme", ["woman"]).slice(0, 2), ["woman", "silhouette"]);
  assert.deepEqual(illustrationKeywords("T-shirt rose, texte « Le chat »", ["flower"]), ["flower"], "couleur et texte cité ignorés");
});
