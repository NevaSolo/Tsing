/*
 * Motifs vectoriels du Studio : illustrations dessinées en code (montagnes, vague, fusée…), en 1 à 3
 * couleurs, avec des effets (givre, rayons, usé vintage, néon, étincelles).
 *
 * Un calque « motif » ne stocke que { motif, color, color2, accent, effects, seed } : le dessin est
 * recalculé à chaque rendu (net à toute taille, léger à enregistrer, modifiable dans l'onglet Calques).
 * La graine fait varier le dessin (hauteur des sommets, nombre de rayons…) : « Redessiner » change la graine.
 *
 * Catalogue et mots-clés : purs (testés avec node --test). Dessin : navigateur uniquement (canvas).
 */
import { createRng } from "./random.js";

// ------------------------------------------------------------------ Catalogue

/**
 * aspect = hauteur / largeur de la boîte du motif. keywords : sans accents, minuscules (comme parsePrompt).
 * Les identifiants sont aussi la liste fermée proposée à l'IA locale.
 */
export const MOTIFS = [
  { id: "mountains", label: "Montagnes", aspect: 0.62, keywords: ["montagne", "mont", "sommet", "alpes", "pic", "randonnee", "rando", "trek", "alpinisme", "escalade", "mountain", "himalaya"] },
  { id: "sun", label: "Soleil", aspect: 1, keywords: ["soleil", "sun", "solaire", "rayonnant"] },
  { id: "sunset", label: "Coucher de soleil", aspect: 0.62, keywords: ["coucher", "couchant", "sunset", "aube", "horizon", "crepuscule", "retro80", "synthwave"] },
  { id: "wave", label: "Vague", aspect: 0.8, keywords: ["vague", "wave", "surf", "ocean", "houle", "glisse"] },
  { id: "palm", label: "Palmier", aspect: 1.1, keywords: ["palmier", "palm", "tropical", "tropique", "ile", "plage", "cocotier"] },
  { id: "pines", label: "Sapins", aspect: 0.8, keywords: ["sapin", "foret", "arbre", "pin", "bois", "camping", "nature", "forest"] },
  { id: "tent", label: "Tente", aspect: 0.8, keywords: ["tente", "camping", "bivouac", "camp", "aventure"] },
  { id: "gamepad", label: "Manette", aspect: 0.62, keywords: ["manette", "gaming", "gamer", "console", "jeu", "jeux", "joystick", "game", "arcade"] },
  { id: "bolt", label: "Éclair", aspect: 1.35, keywords: ["eclair", "foudre", "orage", "electrique", "energie", "flash", "bolt", "power"] },
  { id: "flame", label: "Flammes", aspect: 1.2, keywords: ["flamme", "feu", "fire", "brulant", "enflamme", "hot", "chaud"] },
  { id: "starburst", label: "Étoile éclatante", aspect: 1, keywords: ["etoile", "star", "eclat", "explosion", "boom", "pop"] },
  { id: "heart", label: "Cœur", aspect: 0.9, keywords: ["coeur", "amour", "love", "aime", "saint", "valentin", "romantique", "heart"] },
  { id: "flower", label: "Fleur", aspect: 1, keywords: ["fleur", "fleuri", "printemps", "flower", "marguerite", "jardin", "rose"] },
  { id: "beer", label: "Chope de bière", aspect: 1.05, keywords: ["biere", "chope", "pinte", "brasserie", "bar", "beer", "ale", "mousse", "apero", "houblon"] },
  { id: "coffee", label: "Tasse de café", aspect: 1, keywords: ["cafe", "coffee", "tasse", "expresso", "espresso", "barista", "latte", "cappuccino"] },
  { id: "rocket", label: "Fusée", aspect: 1.35, keywords: ["fusee", "rocket", "decollage", "lancement", "nasa", "astronaute"] },
  { id: "planet", label: "Planète", aspect: 0.75, keywords: ["planete", "saturne", "espace", "space", "galaxie", "cosmos", "univers", "planet"] },
  { id: "moon", label: "Lune", aspect: 1, keywords: ["lune", "moon", "nuit", "croissant", "night", "reve"] },
  { id: "note", label: "Notes de musique", aspect: 1, keywords: ["note", "musique", "music", "melodie", "chanson", "chant", "concert"] },
  { id: "vinyl", label: "Vinyle", aspect: 1, keywords: ["vinyle", "disque", "vinyl", "dj", "platine", "record"] },
  { id: "headphones", label: "Casque audio", aspect: 0.9, keywords: ["casque", "ecouteur", "headphone", "son", "audio", "podcast"] },
  { id: "ball", label: "Ballon", aspect: 1, keywords: ["ballon", "basket", "basketball", "ball", "balle"] },
  { id: "dumbbell", label: "Haltère", aspect: 0.45, keywords: ["haltere", "muscu", "musculation", "gym", "fitness", "salle", "force", "crossfit"] },
  { id: "cat", label: "Tête de chat", aspect: 0.95, keywords: ["chat", "chaton", "cat", "felin", "miaou", "minou"] },
  { id: "paw", label: "Patte", aspect: 1, keywords: ["patte", "chien", "animal", "animaux", "dog", "paw", "toutou", "chiot"] },
  { id: "plane", label: "Avion", aspect: 0.9, keywords: ["avion", "vol", "voyage", "travel", "aeroport", "pilote", "plane", "aviation"] },
  { id: "globe", label: "Globe", aspect: 1, keywords: ["globe", "monde", "terre", "world", "international", "mondial"] },
  { id: "crown", label: "Couronne", aspect: 0.7, keywords: ["couronne", "roi", "reine", "king", "queen", "royal", "princesse", "prince", "boss"] },
  { id: "snowflake", label: "Flocon", aspect: 1, keywords: ["flocon", "neige", "hiver", "snow", "noel", "ski", "flocon"] },
  { id: "cactus", label: "Cactus", aspect: 1.2, keywords: ["cactus", "desert", "western", "mexique", "farwest"] },
  { id: "anchor", label: "Ancre", aspect: 1.1, keywords: ["ancre", "marin", "bateau", "voile", "navy", "port", "matelot", "nautique"] },
];

export const MOTIF_IDS = MOTIFS.map((m) => m.id);
const MOTIF_BY_ID = new Map(MOTIFS.map((m) => [m.id, m]));
export const motifInfo = (id) => MOTIF_BY_ID.get(id) ?? (id === "icon" ? { id: "icon", label: "Illustration" } : null);
export const motifAspect = (id) => MOTIF_BY_ID.get(id)?.aspect ?? 1;

/**
 * Illustration de bibliothèque (motif « icon ») : le calque transporte ses tracés SVG (`paths`) et sa
 * boîte (`vb` = [largeur, hauteur]) — voir illustrations.js.
 */
export const ICON_MOTIF = "icon";
/** Proportions (hauteur / largeur) d'un calque ou paramètre motif, illustrations comprises. */
export const layerAspect = (m) =>
  m?.motif === ICON_MOTIF || m?.id === ICON_MOTIF
    ? Math.min(2, Math.max(0.3, (m.vb?.[1] ?? 1) / (m.vb?.[0] ?? 1)))
    : motifAspect(m?.motif ?? m?.id);

/** Effets combinables (2 au plus par motif). */
export const EFFECTS = [
  { id: "frost", label: "Givré", keywords: ["givre", "givree", "glace", "glacee", "gele", "gelee", "neige", "enneige", "enneigee", "frost", "ice", "icy", "polaire", "glacial", "froid"] },
  { id: "rays", label: "Rayons", keywords: ["rayon", "rayons", "rayonnant", "eclatant", "lumineux", "radieux", "sunburst"] },
  { id: "distressed", label: "Usé vintage", keywords: ["use", "usee", "vieilli", "vieillie", "patine", "delave", "grunge", "craquele", "distressed", "worn"] },
  { id: "glow", label: "Néon", keywords: ["neon", "fluo", "lumineux", "glow", "brillant", "phosphorescent", "cyber", "cyberpunk"] },
  { id: "sparkles", label: "Étincelles", keywords: ["etincelle", "etincelles", "paillette", "paillettes", "scintillant", "magique", "magie", "sparkle", "brille"] },
];
export const EFFECT_IDS = EFFECTS.map((e) => e.id);
export const MAX_EFFECTS = 2;

/** Effet ajouté par défaut selon le style (si l'utilisateur n'en demande pas). */
export const STYLE_EFFECTS = { vintage: ["distressed"], playful: ["sparkles"], bold: ["rays"], minimal: [] };

/** Nettoie une liste d'effets : connus, sans doublon, 2 au plus. */
export const cleanEffects = (list) => [...new Set((Array.isArray(list) ? list : []).filter((e) => EFFECT_IDS.includes(e)))].slice(0, MAX_EFFECTS);

// ------------------------------------------------------------------ Dessin (navigateur)

const TAU = Math.PI * 2;

/** Polygone fermé à partir de points [x, y]. */
const poly = (g, pts) => {
  g.beginPath();
  pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
};
const circle = (g, x, y, r) => {
  g.beginPath();
  g.arc(x, y, r, 0, TAU);
};
const fill = (g, color) => {
  g.fillStyle = color;
  g.fill();
};
const stroke = (g, color, width) => {
  g.strokeStyle = color;
  g.lineWidth = width;
  g.lineCap = "round";
  g.lineJoin = "round";
  g.stroke();
};
/** Découpe (trou transparent : la couleur du t-shirt apparaît). */
const cut = (g, draw) => {
  g.save();
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = "#000";
  g.strokeStyle = "#000";
  draw();
  g.restore();
};
/** Étoile à `n` branches. */
const starPath = (g, x, y, r, n = 5, inner = 0.45, rot = -Math.PI / 2) => {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const rr = i % 2 ? r * inner : r;
    const a = rot + (Math.PI / n) * i;
    g[i ? "lineTo" : "moveTo"](x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
};
/** Petite étincelle à 4 branches. */
const sparkle = (g, x, y, r, color) => {
  starPath(g, x, y, r, 4, 0.28, 0);
  fill(g, color);
};
/** Flocon à 6 branches (traits). */
const snowflakePath = (g, x, y, r, width, color) => {
  g.save();
  g.translate(x, y);
  for (let i = 0; i < 6; i++) {
    g.rotate(TAU / 6);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(0, -r);
    g.moveTo(0, -r * 0.55);
    g.lineTo(-r * 0.28, -r * 0.8);
    g.moveTo(0, -r * 0.55);
    g.lineTo(r * 0.28, -r * 0.8);
    stroke(g, color, width);
  }
  g.restore();
};

/*
 * Chaque dessin travaille dans une boîte de 100 unités de large centrée sur (0, 0),
 * de hauteur 100 × aspect : x ∈ [-50, 50], y ∈ [-H/2, H/2]. c = { a, b, c } : couleurs 1, 2, 3.
 * `fx` : effets demandés (certains motifs les intègrent eux-mêmes, ex. le givre des montagnes).
 */
const DRAW = {
  /** Illustration de bibliothèque : silhouette pleine + ombre décalée (look sérigraphie rétro). */
  icon(g, c, rng, H, fx, layer) {
    const [w, h] = layer.vb;
    const k = 100 / w;
    const shapes = layer.paths.map((d) => new Path2D(d));
    const draw = (dx, dy, color) => {
      g.save();
      g.translate(dx, dy);
      g.scale(k, k);
      g.translate(-w / 2, -h / 2);
      g.fillStyle = color;
      for (const shape of shapes) g.fill(shape);
      g.restore();
    };
    if (c.b !== c.a) draw(2.6, 2.6, c.b);
    draw(0, 0, c.a);
  },

  mountains(g, c, rng, H, fx) {
    const base = H / 2;
    const frost = fx.includes("frost");
    const count = rng.pick([2, 3, 3]);
    const peaks =
      count === 2
        ? [
            { x: -16 + rng.int(-4, 4), h: 46 + rng.int(-4, 6), w: 74, back: false },
            { x: 22 + rng.int(-4, 4), h: 36 + rng.int(-4, 6), w: 62, back: true },
          ]
        : [
            { x: -28 + rng.int(-3, 3), h: 34 + rng.int(-4, 4), w: 52, back: true },
            { x: 26 + rng.int(-3, 3), h: 38 + rng.int(-4, 4), w: 56, back: true },
            { x: rng.int(-6, 6), h: 54 + rng.int(-4, 4), w: 76, back: false },
          ];
    peaks.sort((p, q) => Number(q.back) - Number(p.back)); // arrière-plan d'abord
    for (const p of peaks) {
      const apex = [p.x, base - Math.min(p.h, H - 2)];
      const left = [p.x - p.w / 2, base];
      const right = [p.x + p.w / 2, base];
      poly(g, [apex, right, left]);
      fill(g, p.back ? c.b : c.a);
      // Calotte de neige : plus grande et dentelée si givré.
      const f = frost ? 0.42 : 0.3;
      const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
      const l = lerp(apex, left, f);
      const r = lerp(apex, right, f);
      const teeth = frost ? 4 : 3;
      const pts = [apex, r];
      for (let i = 1; i < teeth * 2; i++) {
        const t = 1 - i / (teeth * 2);
        const x = l[0] + (r[0] - l[0]) * t;
        const y = l[1] + (i % 2 ? rng.int(4, frost ? 9 : 6) : 0);
        pts.push([x, y]);
      }
      pts.push(l);
      poly(g, pts);
      fill(g, c.c);
      if (frost) {
        // Stalactites de glace sous la calotte.
        for (let i = 1; i < teeth * 2; i += 2) {
          const t = 1 - i / (teeth * 2);
          const x = l[0] + (r[0] - l[0]) * t;
          const y = l[1] + 6;
          poly(g, [[x - 1.6, y], [x + 1.6, y], [x, y + rng.int(4, 8)]]);
          fill(g, c.c);
        }
      }
    }
    // Ligne de sol.
    g.beginPath();
    g.moveTo(-50, base - 1);
    g.lineTo(50, base - 1);
    stroke(g, c.a, 2.5);
  },

  sun(g, c, rng) {
    const n = rng.pick([10, 12, 16]);
    for (let i = 0; i < n; i++) {
      const a = (TAU / n) * i;
      const r0 = 30;
      const r1 = i % 2 ? 44 : 49;
      poly(g, [
        [Math.cos(a - 0.12) * r0, Math.sin(a - 0.12) * r0],
        [Math.cos(a) * r1, Math.sin(a) * r1],
        [Math.cos(a + 0.12) * r0, Math.sin(a + 0.12) * r0],
      ]);
      fill(g, c.b);
    }
    circle(g, 0, 0, 26);
    fill(g, c.a);
    circle(g, 0, 0, 18);
    fill(g, c.c);
  },

  sunset(g, c, rng, H) {
    const horizon = H / 2 - 10;
    g.save();
    g.beginPath();
    g.rect(-50, -H / 2, 100, horizon + H / 2);
    g.clip();
    circle(g, 0, horizon, 40);
    fill(g, c.a);
    g.restore();
    // Bandes découpées dans le soleil (style rétro).
    cut(g, () => {
      const bands = rng.pick([3, 4]);
      for (let i = 0; i < bands; i++) {
        const y = horizon - 4 - i * 7;
        g.fillRect(-50, y - (bands - i) * 0.9, 100, (bands - i) * 1.8);
      }
    });
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      const y = horizon + 3 + i * 3.5;
      const w = 46 - i * 12;
      g.moveTo(-w, y);
      g.lineTo(w, y);
      stroke(g, i ? c.c : c.b, 2.2);
    }
  },

  wave(g, c, rng, H) {
    const b = H / 2;
    const lift = rng.int(-3, 3);
    g.beginPath();
    g.moveTo(-50, b);
    g.bezierCurveTo(-46, 4, -26, -b + lift, 4, -b + 2 + lift);
    g.bezierCurveTo(30, -b + 2, 46, -10, 34, 6);
    g.bezierCurveTo(26, 16, 10, 8, 14, -4);
    g.bezierCurveTo(16, -12, 26, -12, 26, -6);
    g.bezierCurveTo(20, -16, 0, -16, -6, 0);
    g.bezierCurveTo(-12, 16, 6, b - 6, 50, b);
    g.closePath();
    fill(g, c.a);
    // Écume
    g.beginPath();
    g.moveTo(-34, 2);
    g.bezierCurveTo(-26, -24, -2, -34, 18, -30);
    stroke(g, c.c, 3);
    for (let i = 0; i < 4; i++) {
      circle(g, -38 + i * 7 + rng.int(-1, 1), -14 - i * 5, 1.6 + rng.next());
      fill(g, c.c);
    }
    g.beginPath();
    g.moveTo(-50, b - 1);
    g.lineTo(50, b - 1);
    stroke(g, c.b, 3);
  },

  palm(g, c, rng, H) {
    const b = H / 2;
    const lean = rng.int(-8, 8);
    // Tronc
    g.beginPath();
    g.moveTo(-4, b);
    g.quadraticCurveTo(lean - 6, 0, lean, -b + 22);
    g.lineTo(lean + 6, -b + 22);
    g.quadraticCurveTo(lean, 0, 6, b);
    g.closePath();
    fill(g, c.b);
    const top = [lean + 3, -b + 20];
    // Palmes : lames incurvées qui retombent vers l'extérieur.
    const angles = [-172, -140, -108, -76, -42, -8];
    for (const deg of angles) {
      const a = ((deg + rng.int(-6, 6)) * Math.PI) / 180;
      const len = 30 + rng.int(0, 8);
      const dir = [Math.cos(a), Math.sin(a)];
      const nrm = [-dir[1], dir[0]];
      const tip = [top[0] + dir[0] * len, top[1] + dir[1] * len + len * 0.42];
      const ctl = [top[0] + dir[0] * len * 0.55, top[1] + dir[1] * len * 0.55 - len * 0.14];
      g.beginPath();
      g.moveTo(...top);
      g.quadraticCurveTo(ctl[0] + nrm[0] * 8, ctl[1] + nrm[1] * 8, ...tip);
      g.quadraticCurveTo(ctl[0] - nrm[0] * 3, ctl[1] - nrm[1] * 3, ...top);
      fill(g, c.a);
    }
    for (const [dx, dy] of [[-3, 4], [4, 5], [0, 8]]) {
      circle(g, top[0] + dx, top[1] + dy, 3);
      fill(g, c.c);
    }
  },

  pines(g, c, rng, H) {
    const b = H / 2;
    const trees = [
      { x: -26, h: 52 + rng.int(-6, 4), col: c.b },
      { x: 26, h: 48 + rng.int(-6, 4), col: c.b },
      { x: 0, h: 72 + rng.int(-4, 4), col: c.a },
    ];
    for (const t of trees) {
      const w = t.h * 0.55;
      const tiers = 3;
      for (let i = 0; i < tiers; i++) {
        const top = b - t.h + (i * t.h) / (tiers + 0.6);
        const bottom = top + t.h / 2.2;
        const half = (w / 2) * (0.6 + i * 0.25);
        poly(g, [[t.x, top], [t.x + half, Math.min(bottom, b - 6)], [t.x - half, Math.min(bottom, b - 6)]]);
        fill(g, t.col);
      }
      g.fillStyle = c.c;
      g.fillRect(t.x - 2.5, b - 7, 5, 7);
    }
  },

  tent(g, c, rng, H) {
    const b = H / 2;
    poly(g, [[0, -b + 6], [40, b - 4], [-40, b - 4]]);
    fill(g, c.a);
    cut(g, () => {
      poly(g, [[0, -b + 26], [12, b - 4], [-12, b - 4]]);
      g.fill();
    });
    poly(g, [[0, -b + 26], [12, b - 4], [2, b - 4]]);
    fill(g, c.b);
    g.beginPath();
    g.moveTo(-50, b - 2);
    g.lineTo(50, b - 2);
    stroke(g, c.b, 3);
    starPath(g, 34 + rng.int(-3, 3), -b + 10, 5, 5);
    fill(g, c.c);
  },

  gamepad(g, c, rng, H) {
    const h = H / 2;
    g.beginPath();
    g.moveTo(-30, -h + 6);
    g.lineTo(30, -h + 6);
    g.bezierCurveTo(46, -h + 6, 50, h, 40, h);
    g.bezierCurveTo(32, h, 28, 8, 18, 8);
    g.lineTo(-18, 8);
    g.bezierCurveTo(-28, 8, -32, h, -40, h);
    g.bezierCurveTo(-50, h, -46, -h + 6, -30, -h + 6);
    g.closePath();
    fill(g, c.a);
    cut(g, () => {
      g.fillRect(-32, -6, 16, 5);
      g.fillRect(-26.5, -11.5, 5, 16);
    });
    const btn = [[24, -9], [31, -3], [24, 3], [17, -3]];
    btn.forEach(([x, y], i) => {
      circle(g, x, y, 3.3);
      fill(g, i % 2 ? c.c : c.b);
    });
  },

  bolt(g, c, rng, H) {
    const h = H / 2;
    const k = rng.int(-4, 4);
    const pts = [[8, -h], [-24, 4 + k], [-2, 4 + k], [-10, h], [24, -8 + k], [2, -8 + k], [16, -h]];
    g.save();
    g.translate(4, 3);
    poly(g, pts);
    fill(g, c.b);
    g.restore();
    poly(g, pts);
    fill(g, c.a);
  },

  flame(g, c, rng, H) {
    const h = H / 2;
    const tongue = (scale, color) => {
      g.save();
      g.scale(scale, scale);
      g.translate(0, h * (1 - scale) * 0.9 / scale);
      g.beginPath();
      g.moveTo(0, h);
      g.bezierCurveTo(-40, h, -42, 10, -20, -14);
      g.bezierCurveTo(-18, -2, -10, 2, -8, -6);
      g.bezierCurveTo(-12, -26, 0, -h + 8, 6, -h);
      g.bezierCurveTo(10, -30, 30, -22, 22, -2);
      g.bezierCurveTo(30, -8, 34, -14, 32, -20);
      g.bezierCurveTo(46, 0, 40, h, 0, h);
      fill(g, color);
      g.restore();
    };
    tongue(1, c.a);
    tongue(0.68, c.b);
    tongue(0.36 + rng.next() * 0.06, c.c);
  },

  starburst(g, c, rng) {
    const n = rng.pick([12, 14, 16]);
    starPath(g, 0, 0, 49, n, 0.72);
    fill(g, c.a);
    starPath(g, 0, 0, 30, 5, 0.45);
    fill(g, c.c);
  },

  heart(g, c, rng, H) {
    const h = H / 2;
    g.beginPath();
    g.moveTo(0, h - 2);
    g.bezierCurveTo(-60, -4, -30, -h - 14, 0, -h + 12);
    g.bezierCurveTo(30, -h - 14, 60, -4, 0, h - 2);
    fill(g, c.a);
    g.beginPath();
    g.arc(-17, -h + 16, 8, Math.PI * 1.05, Math.PI * 1.6);
    stroke(g, c.c, 3);
    sparkle(g, 30 + rng.int(-2, 2), -h + 6, 6, c.b);
  },

  flower(g, c, rng) {
    const n = rng.pick([6, 8, 10]);
    for (let i = 0; i < n; i++) {
      g.save();
      g.rotate((TAU / n) * i);
      g.beginPath();
      g.ellipse(0, -28, 11, 20, 0, 0, TAU);
      fill(g, i % 2 ? c.b : c.a);
      g.restore();
    }
    circle(g, 0, 0, 13);
    fill(g, c.c);
  },

  beer(g, c, rng, H) {
    const h = H / 2;
    const top = -h + 22; // haut du verre (sous la mousse)
    // Anse
    g.beginPath();
    g.arc(22, top + 30, 15, -Math.PI / 2, Math.PI / 2);
    stroke(g, c.a, 7);
    // Verre ambré
    g.beginPath();
    g.roundRect?.(-30, top, 52, h - top - 2, 7) ?? g.rect(-30, top, 52, h - top - 2);
    fill(g, c.a);
    // Reflets (découpés : la couleur du t-shirt apparaît, effet verre)
    cut(g, () => {
      g.fillRect(-22, top + 10, 4, h - top - 22);
      g.fillRect(-12, top + 14, 2.5, h - top - 30);
    });
    // Bulles
    for (let i = 0; i < 7; i++) {
      circle(g, -4 + rng.int(-14, 20), top + 12 + rng.int(0, h - top - 26), 1.2 + rng.next() * 1.6);
      fill(g, c.b);
    }
    // Mousse qui déborde : nuage + coulures
    const puffs = [[-28, top - 2, 9], [-16, top - 9, 12], [0, top - 12, 13], [14, top - 8, 11], [24, top - 1, 8]];
    for (const [x, y, r] of puffs) {
      circle(g, x, y, r + rng.next() * 1.5);
      fill(g, c.b);
    }
    g.fillStyle = c.b;
    g.fillRect(-32, top - 4, 56, 9);
    for (const [x, len] of [[-24, 16 + rng.int(0, 8)], [10, 10 + rng.int(0, 10)]]) {
      g.beginPath();
      g.moveTo(x - 4, top + 3);
      g.lineTo(x - 4, top + len);
      g.arc(x, top + len, 4, Math.PI, 0, true);
      g.lineTo(x + 4, top + 3);
      fill(g, c.b);
    }
    sparkle(g, 38, -h + 6, 5, c.c);
  },

  coffee(g, c, rng) {
    // Vapeur
    for (const x of [-12, 0, 12]) {
      g.beginPath();
      g.moveTo(x, -16);
      g.bezierCurveTo(x - 6, -24, x + 6, -30, x, -40 - rng.int(0, 6));
      stroke(g, c.c, 3);
    }
    // Tasse
    g.beginPath();
    g.moveTo(-30, -10);
    g.lineTo(26, -10);
    g.bezierCurveTo(26, 22, 14, 30, -2, 30);
    g.bezierCurveTo(-18, 30, -30, 22, -30, -10);
    fill(g, c.a);
    g.beginPath();
    g.arc(30, 4, 9, -Math.PI / 2, Math.PI / 2);
    stroke(g, c.a, 5);
    // Soucoupe
    g.beginPath();
    g.ellipse(-2, 36, 40, 6, 0, 0, TAU);
    fill(g, c.b);
    cut(g, () => {
      g.beginPath();
      g.moveTo(-14, 4);
      g.bezierCurveTo(-14, -2, -6, -2, -6, 4);
      g.bezierCurveTo(-6, 10, -14, 10, -14, 4);
      g.fill();
    });
  },

  rocket(g, c, rng, H) {
    const h = H / 2;
    // Flamme
    g.beginPath();
    g.moveTo(-9, h - 26);
    g.quadraticCurveTo(0, h + 4 - rng.int(0, 6), 9, h - 26);
    fill(g, c.c);
    // Ailerons
    poly(g, [[-12, h - 46], [-28, h - 20], [-12, h - 28]]);
    fill(g, c.b);
    poly(g, [[12, h - 46], [28, h - 20], [12, h - 28]]);
    fill(g, c.b);
    // Corps
    g.beginPath();
    g.moveTo(0, -h + 2);
    g.bezierCurveTo(22, -h + 26, 18, h - 40, 12, h - 26);
    g.lineTo(-12, h - 26);
    g.bezierCurveTo(-18, h - 40, -22, -h + 26, 0, -h + 2);
    fill(g, c.a);
    // Hublot
    circle(g, 0, -h + 42, 8);
    fill(g, c.b);
    cut(g, () => {
      circle(g, 0, -h + 42, 4.5);
      g.fill();
    });
  },

  planet(g, c, rng, H) {
    const tilt = -0.35 + rng.next() * 0.2;
    const ring = (front) => {
      g.save();
      g.rotate(tilt);
      g.beginPath();
      g.ellipse(0, 0, 47, 12, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
      stroke(g, c.b, 5);
      g.restore();
    };
    ring(false);
    circle(g, 0, 0, 25);
    fill(g, c.a);
    g.save();
    circle(g, 0, 0, 25);
    g.clip();
    g.beginPath();
    g.moveTo(-30, -6);
    g.lineTo(30, -12);
    stroke(g, c.c, 3);
    g.restore();
    ring(true);
    sparkle(g, -38, -H / 2 + 6, 5, c.c);
    sparkle(g, 40, H / 2 - 8, 4, c.c);
  },

  moon(g, c, rng) {
    circle(g, -4, 0, 36);
    fill(g, c.a);
    cut(g, () => {
      circle(g, 12, -8, 30);
      g.fill();
    });
    const n = rng.pick([3, 4]);
    for (let i = 0; i < n; i++) {
      starPath(g, 22 + i * 7 - (i % 2) * 10, 10 + i * 9 - 24, 4 + (i % 2) * 2, 5);
      fill(g, c.c);
    }
  },

  note(g, c, rng) {
    const tilt = rng.int(-3, 3);
    g.beginPath();
    g.moveTo(-14, 20);
    g.lineTo(-14, -30);
    g.lineTo(30, -38 + tilt);
    g.lineTo(30, 12);
    stroke(g, c.a, 5);
    poly(g, [[-14, -30], [30, -38 + tilt], [30, -26 + tilt], [-14, -18]]);
    fill(g, c.a);
    for (const [x, y] of [[-23, 22], [21, 14]]) {
      g.beginPath();
      g.ellipse(x, y, 11, 8, -0.4, 0, TAU);
      fill(g, c.a);
    }
    sparkle(g, -36, -30, 6, c.c);
    sparkle(g, 42, -8, 4, c.b);
  },

  vinyl(g, c, rng) {
    circle(g, 0, 0, 48);
    fill(g, c.a);
    cut(g, () => {
      for (const r of [40, 33, 26]) {
        g.beginPath();
        g.arc(0, 0, r, 0, TAU);
        g.lineWidth = 1.2;
        g.stroke();
      }
    });
    circle(g, 0, 0, 16);
    fill(g, c.b);
    cut(g, () => {
      circle(g, 0, 0, 3);
      g.fill();
    });
    g.beginPath();
    g.arc(0, 0, 44, -0.9 - rng.next() * 0.3, -0.4);
    stroke(g, c.c, 2.5);
  },

  headphones(g, c, rng, H) {
    const h = H / 2;
    g.beginPath();
    g.arc(0, 4, 36, Math.PI, 0);
    stroke(g, c.a, 7);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.roundRect?.(s * 36 - 9, 0, 18, h - 2, 7) ?? g.rect(s * 36 - 9, 0, 18, h - 2);
      fill(g, c.a);
      g.beginPath();
      g.roundRect?.(s * 36 - (s > 0 ? 13 : 1), 6, 6, h - 14, 3) ?? g.rect(s * 36 - (s > 0 ? 13 : 1), 6, 6, h - 14);
      fill(g, c.b);
    }
    sparkle(g, 0, -10 + rng.int(-2, 2), 6, c.c);
  },

  ball(g, c, rng) {
    circle(g, 0, 0, 46);
    fill(g, c.a);
    cut(g, () => {
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-46, 0);
      g.lineTo(46, 0);
      g.moveTo(0, -46);
      g.lineTo(0, 46);
      g.stroke();
      g.beginPath();
      g.arc(-58, 0, 40, -0.85, 0.85);
      g.stroke();
      g.beginPath();
      g.arc(58, 0, 40, Math.PI - 0.85, Math.PI + 0.85);
      g.stroke();
    });
    g.beginPath();
    g.arc(-14 + rng.int(-2, 2), -16, 10, Math.PI * 1.1, Math.PI * 1.55);
    stroke(g, c.c, 3);
  },

  dumbbell(g, c, rng, H) {
    const h = H / 2;
    g.fillStyle = c.b;
    g.fillRect(-30, -3.5, 60, 7);
    for (const s of [-1, 1]) {
      g.beginPath();
      g.roundRect?.(s * 30 - (s > 0 ? 0 : 12), -h + 2, 12, H - 4, 3) ?? g.rect(s * 30 - (s > 0 ? 0 : 12), -h + 2, 12, H - 4);
      fill(g, c.a);
      g.beginPath();
      g.roundRect?.(s * 42 - (s > 0 ? 0 : 8), -h + 8, 8, H - 16, 3) ?? g.rect(s * 42 - (s > 0 ? 0 : 8), -h + 8, 8, H - 16);
      fill(g, c.a);
    }
    sparkle(g, 0, -h + 4 + rng.int(0, 2), 5, c.c);
  },

  paw(g, c, rng) {
    g.beginPath();
    g.ellipse(0, 18, 22, 18, 0, 0, TAU);
    fill(g, c.a);
    const toes = [[-30, -6, -0.5], [-12, -26, -0.15], [12, -26, 0.15], [30, -6, 0.5]];
    for (const [x, y, r] of toes) {
      g.beginPath();
      g.ellipse(x, y, 9, 12, r, 0, TAU);
      fill(g, c.a);
    }
    sparkle(g, 38, -34 + rng.int(-2, 2), 6, c.c);
  },

  cat(g, c, rng, H) {
    const h = H / 2;
    g.beginPath();
    g.moveTo(-40, -h + 2);
    g.lineTo(-20, -18);
    g.lineTo(20, -18);
    g.lineTo(40, -h + 2);
    g.lineTo(42, 8);
    g.bezierCurveTo(40, h, -40, h, -42, 8);
    g.closePath();
    fill(g, c.a);
    cut(g, () => {
      for (const s of [-1, 1]) {
        g.beginPath();
        g.ellipse(s * 15, 4, 6, 8, 0, 0, TAU);
        g.fill();
      }
    });
    for (const s of [-1, 1]) {
      g.beginPath();
      g.ellipse(s * 15, 5, 2, 6, 0, 0, TAU);
      fill(g, c.c);
    }
    poly(g, [[-5, 18], [5, 18], [0, 24]]);
    fill(g, c.b);
    g.beginPath();
    for (const s of [-1, 1]) {
      for (const dy of [-2, 4]) {
        g.moveTo(s * 10, 24);
        g.lineTo(s * (36 + rng.int(0, 4)), 22 + dy * 1.5);
      }
    }
    stroke(g, c.c, 1.6);
  },

  plane(g, c, rng, H) {
    const h = H / 2;
    g.save();
    g.rotate(-0.5 + rng.next() * 0.2);
    poly(g, [
      [0, -h + 2], [5, -h + 8], [5, -8], [44, 8], [44, 15], [5, 6], [4, h - 14], [15, h - 4], [15, h],
      [0, h - 6], [-15, h], [-15, h - 4], [-4, h - 14], [-5, 6], [-44, 15], [-44, 8], [-5, -8], [-5, -h + 8],
    ]);
    fill(g, c.a);
    g.restore();
    g.beginPath();
    g.moveTo(-48, h - 6);
    g.bezierCurveTo(-30, h - 2, -20, 20, -14, 12);
    g.setLineDash?.([3, 4]);
    stroke(g, c.c, 2);
    g.setLineDash?.([]);
  },

  globe(g, c, rng) {
    circle(g, 0, 0, 44);
    fill(g, c.a);
    g.save();
    circle(g, 0, 0, 44);
    g.clip();
    // Continents stylisés
    g.fillStyle = c.b;
    const blobs = [[-18, -14, 16, 10], [14, 6, 14, 18], [-10, 22, 10, 7]];
    for (const [x, y, rx, ry] of blobs) {
      g.beginPath();
      g.ellipse(x + rng.int(-3, 3), y, rx, ry, 0.4, 0, TAU);
      g.fill();
    }
    g.restore();
    cut(g, () => {
      g.lineWidth = 1.6;
      g.beginPath();
      g.ellipse(0, 0, 20, 44, 0, 0, TAU);
      g.moveTo(-44, 0);
      g.lineTo(44, 0);
      g.moveTo(-40, -18);
      g.lineTo(40, -18);
      g.moveTo(-40, 18);
      g.lineTo(40, 18);
      g.stroke();
    });
    g.beginPath();
    g.arc(0, 0, 48, -2.4, -0.7);
    stroke(g, c.c, 3);
  },

  crown(g, c, rng, H) {
    const h = H / 2;
    const points = rng.pick([3, 5]);
    const pts = [[-44, h - 10]];
    for (let i = 0; i <= points * 2; i++) {
      const x = -44 + (88 / (points * 2)) * i;
      pts.push([x, i % 2 ? -4 : -h + 4]);
    }
    pts.push([44, h - 10]);
    poly(g, pts);
    fill(g, c.a);
    g.fillStyle = c.b;
    g.fillRect(-44, h - 12, 88, 10);
    for (let i = 0; i <= points * 2; i += 2) {
      circle(g, -44 + (88 / (points * 2)) * i, -h + 4, 4);
      fill(g, c.c);
    }
  },

  snowflake(g, c, rng) {
    snowflakePath(g, 0, 0, 46, 5, c.a);
    starPath(g, 0, 0, 10, 6, 0.6, rng.next());
    fill(g, c.c);
  },

  cactus(g, c, rng, H) {
    const h = H / 2;
    const arm = (s, y, len) => {
      g.beginPath();
      g.moveTo(s * 8, y);
      g.lineTo(s * 22, y);
      g.quadraticCurveTo(s * 28, y, s * 28, y - 6);
      g.lineTo(s * 28, y - len);
      stroke(g, c.a, 12);
    };
    arm(-1, 6 + rng.int(-4, 4), 22);
    arm(1, -6 + rng.int(-4, 4), 20);
    g.beginPath();
    g.moveTo(0, h - 12);
    g.lineTo(0, -h + 8);
    stroke(g, c.a, 18);
    g.fillStyle = c.b;
    g.fillRect(-22, h - 14, 44, 14);
    sparkle(g, 0, -h + 4, 6, c.c);
  },

  anchor(g, c, rng, H) {
    const h = H / 2;
    g.beginPath();
    g.arc(0, -h + 10, 7, 0, TAU);
    stroke(g, c.a, 5);
    g.beginPath();
    g.moveTo(0, -h + 17);
    g.lineTo(0, h - 6);
    g.moveTo(-16, -h + 28);
    g.lineTo(16, -h + 28);
    stroke(g, c.a, 6);
    g.beginPath();
    g.arc(0, h - 34, 30, 0.25, Math.PI - 0.25);
    stroke(g, c.a, 6);
    for (const s of [-1, 1]) {
      poly(g, [[s * 34, h - 30], [s * 26, h - 22], [s * 36, h - 18]]);
      fill(g, c.a);
    }
    g.beginPath();
    g.moveTo(-24, -h + 40);
    g.bezierCurveTo(-40, -10, 30, 0, 22, h - 20 - rng.int(0, 4));
    stroke(g, c.b, 2.5);
  },
};

// ------------------------------------------------------------------ Effets

function applyEffects(g, c, rng, H, effects, motif) {
  for (const fx of effects) {
    if (fx === "frost") {
      // Voile de givre sur le haut du motif + flocons autour.
      if (motif !== "mountains") {
        g.save();
        g.globalCompositeOperation = "source-atop";
        const grad = g.createLinearGradient(0, -H / 2, 0, H * 0.1);
        grad.addColorStop(0, c.c);
        grad.addColorStop(1, "rgba(0,0,0,0)");
        g.fillStyle = grad;
        g.globalAlpha = 0.85;
        g.fillRect(-60, -H / 2 - 10, 120, H * 0.7);
        g.restore();
      }
      const flakes = [[-46, -H / 2 + 4, 6], [44, -H / 2 + 10, 5], [38, 2, 3.5], [-40, H / 2 - 18, 3.5]];
      for (const [x, y, r] of flakes) snowflakePath(g, x + rng.int(-2, 2), y, r, 1.3, c.c);
    } else if (fx === "sparkles") {
      const spots = [[-48, -H / 2 + 6, 6], [46, -H / 2 + 2, 5], [50, H / 2 - 14, 4], [-50, 6, 3.5]];
      for (const [x, y, r] of spots) sparkle(g, x + rng.int(-2, 2), y + rng.int(-2, 2), r, c.c);
    } else if (fx === "rays") {
      // Rayons DERRIÈRE le motif.
      g.save();
      g.globalCompositeOperation = "destination-over";
      const n = 18;
      const R = Math.min(78, Math.max(62, H * 0.55)); // reste dans la marge du canvas
      for (let i = 0; i < n; i += 2) {
        const a0 = (TAU / n) * i - Math.PI / 2;
        const a1 = a0 + TAU / n;
        poly(g, [[0, 0], [Math.cos(a0) * R, Math.sin(a0) * R], [Math.cos(a1) * R, Math.sin(a1) * R]]);
        g.fillStyle = c.b;
        g.globalAlpha = 0.55;
        g.fill();
      }
      g.restore();
    }
  }
}

/** Effets appliqués à l'image finale (bitmap) : usure vintage, halo néon. */
function postEffects(g, canvas, c, rng, effects, unit) {
  if (effects.includes("distressed")) {
    // Usure : petites taches et rayures retirées de l'encre (le t-shirt apparaît).
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "destination-out";
    const W = canvas.width;
    const Hpx = canvas.height;
    const spots = Math.round((W * Hpx) / 260);
    for (let i = 0; i < spots; i++) {
      g.globalAlpha = 0.35 + rng.next() * 0.65;
      g.beginPath();
      g.arc(rng.next() * W, rng.next() * Hpx, (0.3 + rng.next() * 1.1) * unit, 0, TAU);
      g.fill();
    }
    g.globalAlpha = 0.8;
    g.lineWidth = Math.max(1, 0.6 * unit);
    for (let i = 0; i < 7; i++) {
      const x = rng.next() * W;
      const y = rng.next() * Hpx;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + (rng.next() - 0.5) * 30 * unit, y + (rng.next() - 0.5) * 8 * unit);
      g.stroke();
    }
    g.restore();
  }
  if (effects.includes("glow")) {
    g.save();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "destination-over";
    g.shadowColor = c.a;
    g.shadowBlur = 9 * unit;
    for (let i = 0; i < 2; i++) g.drawImage(copyOf(canvas), 0, 0);
    g.restore();
  }
}

const copyOf = (canvas) => {
  const copy = document.createElement("canvas");
  copy.width = canvas.width;
  copy.height = canvas.height;
  copy.getContext("2d").drawImage(canvas, 0, 0);
  return copy;
};

/** Marge autour de la boîte (rayons, halo, étincelles débordent un peu). */
const PAD = 0.3;

const cache = new Map();
const CACHE_MAX = 48;

/**
 * Image (canvas) d'un motif, mise en cache. Renvoie null hors navigateur ou si le motif est inconnu.
 * Dimensions : (size × (1 + 2·PAD)) × (size·aspect + 2·PAD·size), le motif au centre.
 */
export function renderMotif(layer) {
  if (typeof document === "undefined" || !DRAW[layer.motif]) return null;
  if (layer.motif === ICON_MOTIF && !(Array.isArray(layer.paths) && layer.paths.length && layer.vb?.[0] > 0)) return null;
  const effects = cleanEffects(layer.effects);
  const key = [layer.motif, layer.icon, Math.round(layer.size), layer.color, layer.color2, layer.accent, effects.join("+"), layer.seed ?? 1].join("|");
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit); // LRU
    return hit;
  }
  const aspect = layerAspect(layer);
  const size = Math.max(8, layer.size);
  const unit = size / 100;
  const canvas = document.createElement("canvas");
  canvas.width = Math.ceil(size * (1 + 2 * PAD));
  canvas.height = Math.ceil(size * aspect + 2 * PAD * size);
  const g = canvas.getContext("2d");
  const c = { a: layer.color, b: layer.color2 ?? layer.color, c: layer.accent ?? layer.color2 ?? layer.color };
  const rng = createRng((layer.seed ?? 1) * 7919 + 17);
  const H = 100 * aspect;
  g.translate(canvas.width / 2, canvas.height / 2);
  g.scale(unit, unit);
  DRAW[layer.motif](g, c, rng, H, effects, layer);
  applyEffects(g, c, rng, H, effects, layer.motif);
  postEffects(g, canvas, c, rng, effects, unit);
  cache.set(key, canvas);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return canvas;
}

/** Dessine un calque motif sur le canvas de la texture (W × H px). */
export function drawMotifLayer(ctx, layer, W, H) {
  const image = renderMotif(layer);
  if (!image) return;
  ctx.save();
  ctx.translate(layer.x * W, layer.y * H);
  ctx.rotate(((layer.rotation ?? 0) * Math.PI) / 180);
  ctx.drawImage(image, -image.width / 2, -image.height / 2);
  ctx.restore();
}
