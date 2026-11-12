/* Tests du moteur du Studio — lancés avec `npm test` (node --test, aucune dépendance). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { contrastRatio, ensureContrast, normalizeHex } from "./color.js";
import { parsePrompt, generateProposals, colorVariants, suggestSlogans, buildPalette, textLayerFor } from "./engine.js";
import { backgroundAt, backgroundsUnder, checkDesign, CM_PER_PX, MIN_TEXT_CM } from "./checker.js";
import { THEMES, STYLES } from "./catalog.js";
import { sanitizeLayers } from "../canvas/utils/layers.js";

test("contraste WCAG : valeurs de référence", () => {
  assert.equal(Math.round(contrastRatio("#000000", "#ffffff")), 21);
  assert.equal(contrastRatio("#777777", "#777777"), 1);
  assert.equal(normalizeHex("#ABC"), "#aabbcc");
  assert.equal(normalizeHex("pas une couleur"), null);
});

test("ensureContrast atteint le minimum demandé", () => {
  for (const [c, bg] of [["#ffff00", "#ffffff"], ["#222222", "#111111"], ["#ff6fa5", "#ffccd5"], ["#00e5ff", "#ffffff"]]) {
    assert.ok(contrastRatio(ensureContrast(c, bg, 3), bg) >= 3, `${c} sur ${bg}`);
  }
});

test("analyse : thème, style, couleurs, texte imposé", () => {
  const p = parsePrompt("Logo rétro pour un club de surf, tons orangés, texte « Les Vagues »");
  assert.equal(p.theme.id, "surf");
  assert.equal(p.style?.id, "vintage");
  assert.ok(p.colors.includes("#f77f00"));
  assert.equal(p.text, "Les Vagues");
  assert.equal(p.placement, "front");
});

test("analyse : couleur du t-shirt, emplacement dos, guillemets droits", () => {
  const p = parsePrompt('T-shirt noir avec un texte bleu "GAME ON" dans le dos pour gamer');
  assert.equal(p.shirtColor, "#111111");
  assert.deepEqual(p.colors, ["#1d4ed8"]);
  assert.equal(p.text, "GAME ON");
  assert.equal(p.placement, "back");
  assert.equal(p.theme.id, "gaming");
});

test("analyse : demande vide ou inconnue → thème libre", () => {
  assert.equal(parsePrompt("").theme.id, "generic");
  assert.equal(parsePrompt("zzz qwerty").themeDetected, false);
});

test("propositions reproductibles et variées", () => {
  const a = generateProposals({ prompt: "café vintage" }, { seed: 7 });
  const b = generateProposals({ prompt: "café vintage" }, { seed: 7 });
  const c = generateProposals({ prompt: "café vintage" }, { seed: 8 });
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, 3);
  assert.equal(new Set(a.map((p) => p.params.layout)).size, 3, "3 mises en page différentes");
  assert.ok(a.every((p) => p.layers.length > 0));
});

test("le texte imposé est utilisé tel quel (casse selon le style)", () => {
  const props = generateProposals({ prompt: 'surf "Les Vagues"', styleId: "vintage" }, { seed: 3 });
  for (const p of props) {
    assert.ok(p.layers.some((l) => l.type === "text" && l.text === "Les Vagues"), `${p.title} : ${JSON.stringify(p.layers.filter((l) => l.type === "text").map((l) => l.text))}`);
  }
});

// Propriétés vérifiées sur de nombreuses demandes et graines.
const PROMPTS = [
  "",
  "Logo rétro pour un club de surf, tons orangés, texte « Les Vagues »",
  "t-shirt noir gamer néon",
  "cadeau pour maman avec un cœur rose pastel",
  "streetwear paris bold dans le dos",
  'anniversaire 30 ans fun "Team Julie"',
  "montagne randonnée minimaliste vert sur fond blanc",
  "groupe de rock, texte très long : Les Incroyables Musiciens Du Dimanche Soir",
  "café sombre",
  "jaune sur blanc",
];

test("propriétés : contraste, zone imprimable, taille des textes, validité des calques", () => {
  let checked = 0;
  for (const prompt of PROMPTS) {
    for (let seed = 1; seed <= 8; seed++) {
      for (const styleId of [null, ...STYLES.map((s) => s.id)]) {
        for (const p of generateProposals({ prompt, styleId }, { seed })) {
          checked++;
          const ctx = `${JSON.stringify(prompt)} seed=${seed} style=${styleId} ${p.title}`;
          // Calques valides : rien n'est rejeté ni réparé par la validation du rendu.
          assert.deepEqual(sanitizeLayers(p.layers), p.layers, `calques invalides : ${ctx}`);
          p.layers.forEach((l, index) => {
            const bg = backgroundAt(p.layers, index, p.shirtColor);
            if (l.type === "text") {
              assert.ok(contrastRatio(l.color, bg) >= 3, `texte peu lisible : ${ctx}`);
              assert.ok(l.size * CM_PER_PX >= MIN_TEXT_CM, `texte trop petit (${l.size}px) : ${ctx}`);
              assert.ok(l.size >= 1 && l.size <= 1000, ctx);
            } else {
              assert.ok(contrastRatio(l.color, bg) >= 1.5, `élément invisible : ${ctx}`);
            }
          });
          const problems = checkDesign({ shirtColor: p.shirtColor, layers: p.layers }).filter((i) => i.level !== "info");
          assert.deepEqual(problems, [], `le vérificateur signale : ${ctx}`);
        }
      }
    }
  }
  assert.ok(checked >= 1000, `${checked} propositions vérifiées`);
});

test("variantes de couleurs : 5 déclinaisons lisibles (fond réel pris en compte)", () => {
  for (const prompt of PROMPTS) {
    for (let seed = 1; seed <= 6; seed++) {
      for (const p of generateProposals({ prompt }, { seed })) {
        const variants = colorVariants({ shirtColor: p.shirtColor, layers: p.layers });
        // Jusqu'à 5 déclinaisons : celles identiques au design (ou entre elles) sont écartées.
        assert.ok(variants.length >= 3 && variants.length <= 5, `${variants.length} variantes`);
        for (const v of variants) {
          assert.equal(v.layers.length, p.layers.length);
          v.layers.forEach((l, index) => {
            const bg = backgroundAt(v.layers, index, v.shirtColor);
            assert.ok(contrastRatio(l.color, bg) >= 3, `${v.label} / ${p.title} / ${JSON.stringify(prompt)} seed=${seed}`);
          });
        }
      }
    }
  }
  assert.ok(colorVariants({ shirtColor: "#ffffff", layers: [] }).every((v) => v.layers.length === 0));
});

test("slogans : thème détecté prioritaire, sans doublons", () => {
  const s = suggestSlogans("club de surf");
  assert.equal(s.length, 6);
  assert.equal(new Set(s).size, 6);
  const surf = THEMES.find((t) => t.id === "surf").slogans;
  assert.ok(s.some((x) => surf.includes(x)));
});

test("vérificateur : détecte invisible, trop petit, hors zone", () => {
  const issues = checkDesign({
    shirtColor: "#ffffff",
    layers: [
      { id: "a", type: "text", text: "Blanc", x: 0.26, y: 0.3, size: 60, color: "#fafafa", font: "Arial" },
      { id: "b", type: "text", text: "petit", x: 0.26, y: 0.4, size: 8, color: "#111111", font: "Arial" },
      { id: "c", type: "shape", shape: "star", x: 0.02, y: 0.9, size: 40, color: "#111111", filled: true },
    ],
  });
  const byLayer = (id) => issues.filter((i) => i.layerId === id).map((i) => i.level);
  assert.ok(byLayer("a").includes("error"), "texte invisible");
  assert.ok(byLayer("b").includes("warning"), "texte trop petit");
  assert.ok(byLayer("c").includes("error"), "hors zone");
  assert.equal(issues[0].level, "error", "erreurs en premier");
  assert.equal(checkDesign({ shirtColor: "#fff" })[0].level, "info");
});

test("vérificateur : un texte posé sur une forme pleine est jugé sur la couleur de la forme", () => {
  const layers = [
    { id: "disc", type: "shape", shape: "circle", x: 0.26, y: 0.3, size: 220, color: "#111111", filled: true },
    { id: "t", type: "text", text: "OK", x: 0.26, y: 0.3, size: 60, color: "#ffffff", font: "Arial" },
  ];
  assert.equal(backgroundAt(layers, 1, "#ffffff"), "#111111");
  assert.deepEqual(checkDesign({ shirtColor: "#ffffff", layers }).filter((i) => i.layerId === "t"), []);
});

test("palette : couleur demandée respectée et lisible", () => {
  const pal = buildPalette(THEMES[0].palettes[0], { colors: ["#ffc300"], shirtColor: "#ffffff" });
  assert.equal(pal.shirt, "#ffffff");
  assert.ok(contrastRatio(pal.primary, "#ffffff") >= 3, "le jaune est assombri pour rester lisible sur blanc");
});

test("slogan posé : dans la zone, lisible, sur fond clair comme foncé", () => {
  for (const shirtColor of ["#ffffff", "#111111", "#a40000", "#ffc300"]) {
    for (const placement of ["front", "back"]) {
      for (const text of ["Ok", "Une phrase bien plus longue que prévu ici"]) {
        const layer = textLayerFor(text, { shirtColor, placement });
        assert.ok(contrastRatio(layer.color, shirtColor) >= 3, `${shirtColor}`);
        const issues = checkDesign({ shirtColor, layers: [layer] }).filter((i) => i.level !== "info");
        assert.deepEqual(issues, [], `${shirtColor} ${placement} ${text}`);
      }
    }
  }
});

test("slogan : trouve une place libre au lieu de recouvrir le design", () => {
  for (const prompt of PROMPTS) {
    for (let seed = 1; seed <= 4; seed++) {
      for (const p of generateProposals({ prompt }, { seed })) {
        const zone = p.view === "back" ? "back" : "front";
        const slogan = textLayerFor("Esprit vague", { shirtColor: p.shirtColor, placement: zone, existing: p.layers, id: "new" });
        const layers = [...p.layers, slogan];
        const overlaps = checkDesign({ shirtColor: p.shirtColor, layers }).filter((i) => i.message.includes("chevauche"));
        assert.deepEqual(overlaps, [], `${p.title} ${JSON.stringify(prompt)} seed=${seed}`);
      }
    }
  }
});

test("vérificateur : signale deux textes superposés", () => {
  const a = { id: "a", type: "text", text: "Bonjour", x: 0.26, y: 0.3, size: 60, color: "#111111", font: "Arial" };
  const b = { ...a, id: "b", text: "Salut", y: 0.305 };
  const issues = checkDesign({ shirtColor: "#ffffff", layers: [a, b] });
  assert.ok(issues.some((i) => i.layerId === "b" && i.message.includes("chevauche")));
});

// ---------------------------------------------------------------- Régressions de la revue

const LONG_TEXTS = [
  "Joyeux anniversaire à notre super papa !",
  "Les Incroyables Musiciens Du Dimanche",
  "Supercalifragilisticexpialidocious2026", // un seul mot très long
  "Wow mom",
];

test("textes longs (≤ 40 car.) : jamais de débordement, toujours lisibles, quel que soit le style", () => {
  let n = 0;
  for (const text of LONG_TEXTS) {
    for (const styleId of [null, ...STYLES.map((s) => s.id)]) {
      for (const placement of [null, "front", "back"]) {
        for (let seed = 1; seed <= 6; seed++) {
          for (const p of generateProposals({ prompt: "", text, styleId, placement }, { seed })) {
            n++;
            const issues = checkDesign({ shirtColor: p.shirtColor, layers: p.layers }).filter((i) => i.level !== "info");
            assert.deepEqual(issues, [], `${text} / ${p.title} / ${placement} / seed ${seed}`);
            // Le texte de l'utilisateur est entièrement présent (éventuellement sur plusieurs lignes).
            const printed = p.layers.filter((l) => l.type === "text").map((l) => l.text).join(" ").replace(/\s+/g, "");
            const wanted = (STYLES.find((s) => s.id === p.params?.styleId)?.uppercase ? text.toLocaleUpperCase("fr-FR") : text).replace(/\s+/g, "");
            assert.ok(printed.toLowerCase().includes(wanted.toLowerCase()) || printed.includes(text.toLocaleUpperCase("fr-FR").replace(/\s+/g, "")), `texte incomplet : ${text} → ${printed}`);
          }
        }
      }
    }
  }
  assert.ok(n > 500);
});

test("badge : un titre trop long ne déborde jamais du disque (sinon repli « Empilé »)", () => {
  for (let seed = 1; seed <= 20; seed++) {
    for (const p of generateProposals({ prompt: "", text: LONG_TEXTS[0], styleId: "bold" }, { seed })) {
      p.layers.forEach((l, index) => {
        const bgs = backgroundsUnder(p.layers, index, p.shirtColor);
        for (const bg of bgs) assert.ok(contrastRatio(l.color, bg) >= 3, `${p.title} seed ${seed}`);
      });
    }
  }
});

test("thème générique : « Libre » n'est jamais imprimé", () => {
  for (let seed = 1; seed <= 30; seed++) {
    for (const p of generateProposals({ prompt: "un design" }, { seed })) {
      assert.ok(!p.layers.some((l) => l.type === "text" && /libre/i.test(l.text)), `seed ${seed}`);
    }
  }
});

test("trait posé sur une forme pleine : jugé (et recoloré) sur la couleur de la forme", () => {
  const layers = [
    { id: "c", type: "shape", shape: "circle", x: 0.26, y: 0.3, size: 200, color: "#111111", filled: true },
    { id: "p", type: "path", color: "#ffffff", width: 8, points: [[0.24, 0.3], [0.28, 0.3]] },
  ];
  assert.deepEqual(checkDesign({ shirtColor: "#ffffff", layers }).filter((i) => i.layerId === "p"), []);
  for (const v of colorVariants({ shirtColor: "#ffffff", layers })) {
    const bg = backgroundAt(v.layers, 1, v.shirtColor);
    assert.ok(contrastRatio(v.layers[1].color, bg) >= 3, v.label);
  }
});

test("rotation prise en compte : zone imprimable et chevauchements", () => {
  // Vertical, monte dans le col → signalé
  const up = { id: "a", type: "text", text: "TOUJOURS PLUS LOIN VITE", x: 0.26, y: 0.18, size: 26, rotation: 90, color: "#111111", font: "Arial" };
  assert.ok(checkDesign({ shirtColor: "#ffffff", layers: [up] }).some((i) => i.layerId === "a" && /zone imprimable/.test(i.message)));
  // Vertical, entièrement dans la zone → pas de faux positif
  const ok = { id: "b", type: "text", text: "PLUS LOIN", x: 0.15, y: 0.35, size: 30, rotation: 90, color: "#111111", font: "Arial" };
  assert.deepEqual(checkDesign({ shirtColor: "#ffffff", layers: [ok] }), []);
});

test("analyse : texte long coupé entre deux mots et signalé ; ponctuation conservée", () => {
  const long = parsePrompt('Mon texte "Le meilleur papa du monde entier et de toute la galaxie"');
  assert.ok(long.text && long.text.length <= 40 && !long.text.endsWith(" "));
  assert.equal(long.textTruncated, true);
  assert.ok("Le meilleur papa du monde entier et de toute la galaxie".startsWith(long.text));
  assert.equal(parsePrompt("slogan : 3.14 pour toujours").text, "3.14 pour toujours");
  assert.equal(parsePrompt('"🎉 Fête 🎉"').text, "🎉 Fête 🎉");
});

test("analyse : pas de faux positifs sur les mots courts ni dans le texte imposé", () => {
  assert.notEqual(parsePrompt("t-shirt pour son anniversaire").theme.id, "music");
  assert.equal(parsePrompt("t-shirt pour son anniversaire").theme.id, "party");
  assert.equal(parsePrompt("t-shirt pour son chien").theme.id, "animals");
  assert.notEqual(parsePrompt("the best dad ever").theme.id, "coffee");
  assert.notEqual(parsePrompt("un design moderne").theme.id, "street");
  const quoted = parsePrompt('"Back to school" pour mon fils');
  assert.equal(quoted.placement, "front");
  assert.notEqual(quoted.style?.id, "vintage");
  assert.equal(parsePrompt("style old school").style?.id, "vintage");
  assert.equal(parsePrompt("deux surfeurs").theme.id, "surf");
});

test("analyse : couleurs composées (« bleu marine »)", () => {
  const p = parsePrompt("t-shirt bleu marine avec texte blanc");
  assert.equal(p.shirtColor, "#14213d");
  assert.deepEqual(p.colors, ["#ffffff"]);
});

test("variantes : jamais identiques au design ni entre elles (y compris noir & blanc)", () => {
  for (let seed = 1; seed <= 10; seed++) {
    for (const p of generateProposals({ prompt: "" }, { seed })) {
      // Toutes les couleurs comptent (un motif en a jusqu'à trois).
      const sig = (shirt, layers) => `${shirt}|${layers.map((l) => [l.color, l.color2, l.accent].filter(Boolean).join("/")).join(",")}`;
      const base = sig(p.shirtColor, p.layers);
      const sigs = colorVariants({ shirtColor: p.shirtColor, layers: p.layers }).map((v) => sig(v.shirtColor, v.layers));
      assert.ok(!sigs.includes(base), `variante identique au design (seed ${seed})`);
      assert.equal(new Set(sigs).size, sigs.length, `variantes en double (seed ${seed})`);
      assert.ok(sigs.length >= 3, `trop peu de variantes (seed ${seed})`);
    }
  }
});

test("slogan : évite aussi le texte principal", () => {
  const main = { text: "MON TEXTE", color: "#111111", size: 60, font: "Arial", position: { x: 0.265, y: 0.3 } };
  const mainLayer = { id: "__main", type: "text", text: main.text, x: 0.265, y: 0.3, size: 60, font: "Arial", rotation: 0 };
  const slogan = textLayerFor("Esprit vague", { shirtColor: "#ffffff", existing: [mainLayer], id: "s" });
  const issues = checkDesign({ shirtColor: "#ffffff", layers: [slogan], mainText: main }).filter((i) => i.message.includes("chevauche"));
  assert.deepEqual(issues, []);
});
