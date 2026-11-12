// Bordures du t-shirt (col, manches, bas) demandées dans le prompt ou réglées à la main (node --test).
import { test } from "node:test";
import assert from "node:assert/strict";
import GEOMETRY from "./trimGeometry.js";
import { sanitizeLayers } from "./layers.js";
import { generateProposals, parsePrompt, colorVariants } from "../../studio/engine.js";
import { checkDesign } from "../../studio/checker.js";
import { normalizeBrief } from "../../ai/brief.js";
import { proposalsFromBrief } from "../../ai/fromBrief.js";

const problems = (p) => checkDesign({ shirtColor: p.shirtColor, layers: p.layers }).filter((i) => i.level !== "info").map((i) => i.message);

test("géométrie extraite du modèle : col, poignets et ourlet présents, dans la texture", () => {
  assert.ok(GEOMETRY.collar.tris.length > 100 && GEOMETRY.collar.edges.length > 20);
  for (const part of ["sleeves", "hem"]) {
    assert.ok(GEOMETRY[part].edges.length > 50, part);
    assert.ok(GEOMETRY[part].tris.length > 100, part);
  }
  const all = [GEOMETRY.collar.tris, GEOMETRY.sleeves.tris, GEOMETRY.hem.tris].flat(2);
  assert.ok(all.every((x) => x >= 0 && x <= 1));
});

test("demande : parties, couleurs, style et largeur des bordures", () => {
  const a = parsePrompt("T-shirt noir avec une tête de loup, bordures rouges au col et aux manches");
  assert.deepEqual(a.trims.parts, ["collar", "sleeves"]);
  assert.equal(a.trims.color, "#d62828");
  assert.ok(!a.colors.includes("#d62828"), "le rouge des bordures ne colore pas le motif");
  const b = parsePrompt("liseré blanc et bleu fin au bas, style vintage");
  assert.deepEqual(b.trims.parts, ["hem"]);
  assert.equal(b.trims.style, "double");
  assert.equal(b.trims.width, 14);
  assert.equal(parsePrompt("bordures rayées").trims.style, "stripes");
  assert.deepEqual(parsePrompt("avec des bordures").trims.parts, ["collar", "sleeves", "hem"]);
  assert.deepEqual(parsePrompt("col blanc").trims.parts, ["collar"]);
  assert.equal(parsePrompt("t-shirt manches courtes, surf").trims, null, "« manches courtes » n'est pas une bordure");
  assert.equal(parsePrompt("texte « Bordure »").trims, null, "le texte cité n'est pas lu");
});

test("propositions (mots-clés et IA) : la bordure demandée est posée, lisible, et ne gêne rien", () => {
  const prompt = "Logo de loup, t-shirt noir, style vintage, liseré rouge et blanc au col et au bas";
  for (let seed = 1; seed <= 3; seed++) {
    for (const p of generateProposals({ prompt }, { seed })) {
      const trim = p.layers.find((l) => l.type === "trim");
      assert.deepEqual(trim.parts, ["collar", "hem"]);
      assert.equal(trim.style, "double");
      assert.deepEqual(problems(p), [], p.title);
      assert.deepEqual(sanitizeLayers(JSON.stringify(p.layers)), p.layers, "rechargement identique");
      for (const v of colorVariants({ shirtColor: p.shirtColor, layers: p.layers })) assert.deepEqual(problems(v), [], v.label);
    }
  }
  const brief = normalizeBrief({ theme: "animals", style: "vintage", shirt_color: "#111111", main_color: "#ffffff", second_color: "#d62828", slogans: ["Cri de la meute"], summary: "", illustration: ["wolf"], effects: [] });
  for (const p of proposalsFromBrief({ ...brief, illustrations: [] }, { prompt, seed: 1 })) {
    assert.ok(p.layers.some((l) => l.type === "trim"), p.title);
    assert.deepEqual(problems(p), [], p.title);
  }
});

test("calque bordure : valeurs aberrantes réparées ou rejetées", () => {
  assert.equal(sanitizeLayers([{ type: "trim", parts: ["pocket"], color: "#000" }]).length, 0);
  const [t] = sanitizeLayers([{ id: "t", type: "trim", parts: ["hem", "x", "collar"], color: "#000", style: "zigzag", width: 999 }]);
  assert.deepEqual(t.parts, ["collar", "hem"]);
  assert.equal(t.style, "solid");
  assert.equal(t.width, 60);
});
