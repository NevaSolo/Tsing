// Motifs vectoriels, effets et mise en page « Écusson » (node --test).
import { test } from "node:test";
import assert from "node:assert/strict";
import { EFFECT_IDS, MOTIFS, MOTIF_IDS, cleanEffects } from "./motifs.js";
import { generateProposals, parsePrompt, colorVariants } from "./engine.js";
import { checkDesign } from "./checker.js";
import { layerBox } from "./background.js";
import { THEMES, GENERIC_THEME, PRINT_ZONES } from "./catalog.js";
import { sanitizeLayers } from "../canvas/utils/layers.js";
import { normalizeBrief, BRIEF_SCHEMA } from "../ai/brief.js";
import { proposalsFromBrief } from "../ai/fromBrief.js";

const HIKING =
  "T-shirt noir pour un club de randonnée en montagne, style vintage, couleurs orange et crème, texte « Plus haut, plus loin », logo de montagne givrée";

const problems = (p) =>
  checkDesign({ shirtColor: p.shirtColor, layers: p.layers }).filter((i) => i.level !== "info").map((i) => i.message);

test("catalogue : identifiants uniques, proportions valides, mots-clés normalisés", () => {
  assert.equal(new Set(MOTIF_IDS).size, MOTIF_IDS.length);
  for (const m of MOTIFS) {
    assert.ok(m.aspect > 0.3 && m.aspect < 2, m.id);
    for (const k of m.keywords) assert.equal(k, k.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(), `${m.id} : ${k}`);
  }
  for (const t of [...THEMES, GENERIC_THEME]) {
    for (const id of t.motifs) assert.ok(MOTIF_IDS.includes(id), `${t.id} : ${id}`);
  }
});

test("demande : « montagne givrée » → motif montagnes + effet givre ; le texte cité n'est pas analysé", () => {
  const p = parsePrompt(HIKING);
  assert.equal(p.motif, "mountains");
  assert.ok(p.effects.includes("frost"), JSON.stringify(p.effects));
  assert.equal(p.text, "Plus haut, plus loin");
  assert.equal(parsePrompt("t-shirt gamer néon").effects.includes("glow"), true);
  assert.equal(parsePrompt("une fusée dans l'espace").motif, "rocket");
  assert.equal(parsePrompt("mon chat adoré").motif, "cat");
  assert.equal(parsePrompt("texte « Fusée »").motif, null, "le texte imposé ne choisit pas le motif");
  assert.deepEqual(cleanEffects(["frost", "frost", "virus", "glow", "rays"]), ["frost", "glow"]);
});

test("exemple randonnée : montagnes givrées dans chaque proposition, écusson vintage, prêt à imprimer", () => {
  let crests = 0;
  for (let seed = 1; seed <= 12; seed++) {
    for (const p of generateProposals({ prompt: HIKING }, { seed })) {
      const motifs = p.layers.filter((l) => l.type === "motif");
      assert.equal(motifs.length, 1, p.title);
      assert.equal(motifs[0].motif, "mountains");
      assert.ok(motifs[0].effects.includes("frost"), JSON.stringify(motifs[0].effects));
      assert.equal(p.shirtColor, "#111111");
      // Le titre peut être réparti sur plusieurs lignes (calques) selon la mise en page.
      const printed = p.layers.filter((l) => l.type === "text").map((l) => l.text).join(" ").toLowerCase();
      assert.ok(printed.includes("plus haut, plus loin"), `${p.title} : ${printed}`);
      if (p.title.startsWith("Écusson")) {
        crests++;
        assert.ok(p.layers.some((l) => l.arc > 0), "titre courbé en haut");
      }
      assert.deepEqual(problems(p), [], `${p.title} (graine ${seed})`);
    }
  }
  assert.ok(crests > 0, "au moins un écusson");
});

test("motifs : toujours dans la zone imprimable, lisibles, pour tous les thèmes et styles", () => {
  const prompts = [...THEMES.map((t) => `${t.keywords[0]} ${t.keywords[1]}`), "", "fusée néon", "palmier vintage", "chat fun"];
  for (const prompt of prompts) {
    for (const styleId of [null, "minimal", "vintage", "bold", "playful"]) {
      for (const placement of [null, "back"]) {
        for (let seed = 1; seed <= 3; seed++) {
          for (const p of generateProposals({ prompt, styleId, placement }, { seed })) {
            assert.deepEqual(problems(p), [], `« ${prompt} » ${styleId} ${placement} ${p.title} (graine ${seed})`);
            for (const l of p.layers.filter((x) => x.type === "motif")) {
              const zone = PRINT_ZONES[l.x > 0.5 ? "back" : "front"];
              const b = layerBox(l);
              assert.ok(b.u0 >= zone.u0 - 0.01 && b.u1 <= zone.u1 + 0.01 && b.v0 >= zone.v0 - 0.01 && b.v1 <= zone.v1 + 0.01, `${l.motif} hors zone`);
            }
          }
        }
      }
    }
  }
});

test("calques motif et texte courbé : conservés au rechargement, motif inconnu ignoré", () => {
  const [p] = generateProposals({ prompt: HIKING }, { seed: 1 });
  assert.deepEqual(sanitizeLayers(JSON.stringify(p.layers)), p.layers);
  const cleaned = sanitizeLayers([
    { id: "a", type: "motif", motif: "dragon", x: 0.2, y: 0.3, size: 100, color: "#000" },
    { id: "b", type: "motif", motif: "sun", x: 0.2, y: 0.3, size: 100, color: "#000", effects: ["frost", "x"] },
    { id: "c", type: "text", text: "Hi", x: 0.2, y: 0.3, size: 30, color: "#000", arc: 3 },
  ]);
  assert.deepEqual(cleaned.map((l) => l.id), ["b", "c"]);
  assert.deepEqual(cleaned[0].effects, ["frost"]);
  assert.equal(cleaned[0].color2, "#000");
  assert.equal("arc" in cleaned[1], false, "courbure insignifiante retirée");
});

test("variantes de couleurs : les 3 couleurs du motif suivent et restent lisibles", () => {
  const [p] = generateProposals({ prompt: HIKING }, { seed: 2 });
  for (const v of colorVariants({ shirtColor: p.shirtColor, layers: p.layers })) {
    assert.deepEqual(problems({ shirtColor: v.shirtColor, layers: v.layers }), [], v.label);
  }
});

test("IA : le brief choisit motif et effets (listes fermées), la demande explicite prime", () => {
  assert.ok(BRIEF_SCHEMA.required.includes("illustration"));
  assert.deepEqual(BRIEF_SCHEMA.properties.effects.items.enum, EFFECT_IDS);
  const base = { theme: "space", style: "bold", shirt_color: "#111111", main_color: "#ffd23f", second_color: "#ee4266", slogans: ["Vers les étoiles"], summary: "" };
  const brief = normalizeBrief({ ...base, motif: "rocket", effects: ["glow", "virus"] });
  assert.equal(brief.motif, "rocket");
  assert.deepEqual(brief.effects, ["glow"]);
  assert.equal(normalizeBrief({ ...base, motif: "none", effects: [] }).motif, null);
  for (const p of proposalsFromBrief(brief, { prompt: "fusée", seed: 1 })) {
    const m = p.layers.find((l) => l.type === "motif");
    assert.equal(m.motif, "rocket");
    // Néon retiré en minimal et dans le disque du badge (il baverait sur le disque).
    assert.ok(m.effects.includes("glow") || /^(Minimal|Badge)/.test(p.title), p.title);
    assert.deepEqual(problems(p), [], p.title);
  }
  // L'utilisateur nomme un motif : il l'emporte sur celui du modèle.
  for (const p of proposalsFromBrief(brief, { prompt: "montagne givrée", seed: 1 })) {
    assert.equal(p.layers.find((l) => l.type === "motif").motif, "mountains");
  }
});

test("« sans texte » sans IA : motif seul, dans la zone, sans point à vérifier", () => {
  assert.equal(parsePrompt("logo de loup, aucun texte").noText, true);
  assert.equal(parsePrompt("juste le dessin d'une montagne").noText, true);
  assert.equal(parsePrompt("un texte rouge").noText, false);
  for (const placement of [null, "back"]) {
    for (let seed = 1; seed <= 4; seed++) {
      for (const p of generateProposals({ prompt: "montagne givrée, pas de texte", placement }, { seed })) {
        assert.equal(p.layers.filter((l) => l.type === "text").length, 0);
        assert.equal(p.layers.find((l) => l.type === "motif").motif, "mountains");
        assert.deepEqual(problems(p), [], `${p.title} ${placement}`);
      }
    }
  }
});

test("style d'écriture demandé dans le prompt : police imposée, toujours lisible et dans la zone", async () => {
  const { WRITING_STYLES } = await import("./catalog.js");
  assert.equal(parsePrompt("bar à bière, style vintage, écriture manuscrite").writing.id, "script");
  assert.equal(parsePrompt("police graffiti").writing.id, "marker");
  assert.equal(parsePrompt("écrit à la main").writing.id, "hand");
  assert.equal(parsePrompt("style classique").writing, null, "« classique » seul = style graphique");
  assert.equal(parsePrompt("texte « Lobster »").writing, null, "le texte cité n'est pas une police");
  for (const w of WRITING_STYLES) {
    const cue = w.keywords.find((k) => k.length > 4) ?? w.keywords[0];
    for (let seed = 1; seed <= 3; seed++) {
      for (const p of generateProposals({ prompt: `bar à bière vintage, écriture ${cue}, texte « Izy AH »` }, { seed })) {
        const texts = p.layers.filter((l) => l.type === "text");
        assert.ok(texts.length && texts.every((l) => w.fonts.includes(l.font)), `${w.id} : ${texts.map((l) => l.font)}`);
        assert.deepEqual(problems(p), [], `${w.id} ${p.title}`);
      }
    }
  }
});
