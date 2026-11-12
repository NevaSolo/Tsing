/*
 * Bibliothèque d'illustrations pour l'IA : l'IA décrit le dessin voulu en mots-clés anglais
 * (« woman, silhouette »), on cherche ici l'illustration la plus proche parmi :
 *   - nos motifs dessinés en code (multicolores, prioritaires quand ils correspondent) ;
 *   - ≈ 4 100 silhouettes de game-icons.net (CC BY 3.0 : source citée dans le Studio) ;
 *   - ≈ 7 600 icônes Material Design Icons (Apache 2.0).
 * Les bibliothèques (≈ 10 Mo) ne sont chargées qu'au premier besoin, puis gardées en mémoire.
 * Le tracé retenu est copié dans le calque : le t-shirt s'affiche ensuite partout sans elles.
 */
import { MOTIF_IDS } from "./motifs.js";

export const ICON_SETS = {
  "game-icons": { credit: "game-icons.net (CC BY 3.0)", bonus: 0.8 },
  mdi: { credit: "Material Design Icons (Apache 2.0)", bonus: 0 },
};

/** Mots-clés anglais de nos motifs dessinés en code. */
const MOTIF_WORDS = {
  mountains: ["mountain", "mountains", "peak", "summit", "alps", "hiking", "hike", "climbing"],
  sun: ["sun", "sunny", "sunshine"],
  sunset: ["sunset", "sunrise", "dusk", "horizon"],
  wave: ["wave", "waves", "surf", "surfing", "ocean", "sea"],
  palm: ["palm", "tropical", "island", "coconut"],
  pines: ["pine", "pines", "forest", "fir", "tree", "trees", "woods"],
  tent: ["tent", "camping", "camp", "bivouac"],
  gamepad: ["gamepad", "controller", "gaming", "videogame", "console"],
  bolt: ["lightning", "bolt", "thunder", "electric"],
  flame: ["flame", "flames", "fire", "blaze"],
  starburst: ["starburst", "burst", "explosion"],
  heart: ["heart", "love", "valentine"],
  flower: ["flower", "flowers", "blossom", "daisy", "floral"],
  beer: ["beer", "stein", "pint", "ale", "brewery", "pub", "bar", "foam", "lager"],
  coffee: ["coffee", "cup", "espresso", "latte"],
  rocket: ["rocket", "spaceship", "launch"],
  planet: ["planet", "saturn", "space"],
  moon: ["moon", "crescent", "night"],
  note: ["music", "note", "notes", "melody"],
  vinyl: ["vinyl", "record", "dj", "disc"],
  headphones: ["headphones", "headphone", "headset", "audio"],
  ball: ["basketball", "ball"],
  dumbbell: ["dumbbell", "gym", "fitness", "weightlifting", "workout"],
  cat: ["cat", "kitten", "kitty", "feline"],
  paw: ["paw", "pawprint", "pet"],
  plane: ["plane", "airplane", "aircraft", "flight", "aviation"],
  globe: ["globe", "world", "earth"],
  crown: ["crown", "king", "queen", "royal"],
  snowflake: ["snowflake", "snow", "winter"],
  cactus: ["cactus", "desert", "western"],
  anchor: ["anchor", "sailor", "nautical", "marine"],
};

/** Synonymes : élargissent la recherche (les noms d'icônes n'utilisent qu'un mot). */
const SYNONYMS = {
  woman: ["female", "girl", "lady", "women"],
  girl: ["female", "woman"],
  lady: ["female", "woman"],
  man: ["male", "guy", "men"],
  person: ["human", "people", "man", "woman"],
  people: ["human", "person", "group"],
  silhouette: ["human", "body", "person"],
  body: ["human", "silhouette"],
  dog: ["puppy", "hound", "wolf"],
  car: ["auto", "vehicle", "racing"],
  bike: ["bicycle", "cycling"],
  bicycle: ["bike", "cycling"],
  motorcycle: ["motorbike", "biker"],
  football: ["soccer", "ball"],
  soccer: ["football", "ball"],
  skull: ["death", "skeleton"],
  wolf: ["howl", "dog"],
  bird: ["eagle", "dove", "feather"],
  eagle: ["bird", "hawk"],
  dragon: ["wyvern", "drake"],
  guitar: ["bass", "ukulele"],
  sexy: ["female", "lips", "kiss"],
  kiss: ["lips", "mouth"],
  beer: ["stein", "pint", "ale", "brewery"],
  wine: ["glass", "drink", "grape"],
  food: ["meal", "burger", "pizza"],
  baby: ["child", "infant"],
  child: ["kid", "baby"],
  king: ["crown"],
  queen: ["crown"],
  angel: ["wings", "halo"],
  devil: ["horns", "demon"],
  sun: ["sunny"],
  fire: ["flame", "breath", "burning", "blaze"],
  flame: ["fire", "breath", "burning", "blaze"],
};

/** Icônes « interface » de Material Design : inutiles sur un t-shirt. */
const UI_WORDS = new Set([
  "outline", "off", "plus", "minus", "remove", "check", "alert", "cog", "account", "file", "folder", "arrow", "chevron",
  "format", "view", "menu", "numeric", "alpha", "box", "circle", "square", "variant", "lock", "sync", "cancel", "edit",
  "search", "settings", "download", "upload", "network", "wifi", "battery", "signal", "cellphone", "monitor", "table",
  "text", "sort", "filter", "database", "clipboard", "calendar", "clock", "message", "email", "phone", "keyboard", "page",
]);

/**
 * Le petit modèle donne parfois ses mots-clés en français malgré la consigne (mesuré : « loup, lune ») :
 * traduction des mots les plus courants (sans accents, au singulier).
 */
const FR_EN = {
  femme: "woman", fille: "girl", homme: "man", garcon: "boy", enfant: "child", bebe: "baby", personne: "person",
  silhouette: "silhouette", corps: "body", visage: "face", tete: "head", main: "hand", oeil: "eye", yeux: "eye",
  bouche: "mouth", levre: "lips", levres: "lips", coeur: "heart", amour: "love", baiser: "kiss", danseuse: "dancer",
  loup: "wolf", lune: "moon", soleil: "sun", etoile: "star", chat: "cat", chien: "dog", lion: "lion", tigre: "tiger",
  ours: "bear", aigle: "eagle", oiseau: "bird", poisson: "fish", requin: "shark", cheval: "horse", serpent: "snake",
  dragon: "dragon", papillon: "butterfly", abeille: "bee", renard: "fox", hibou: "owl", chouette: "owl", lapin: "rabbit",
  cerf: "deer", taureau: "bull", singe: "monkey", elephant: "elephant", baleine: "whale", dauphin: "dolphin", licorne: "unicorn",
  crane: "skull", squelette: "skeleton", fleur: "flower", arbre: "tree", feuille: "leaf", montagne: "mountain",
  route: "road", chemin: "path", desert: "desert", coucher: "sunset", couchant: "sunset", crepuscule: "sunset",
  vague: "wave", mer: "sea", ocean: "ocean", plage: "beach", ile: "island", palmier: "palm", foret: "forest",
  feu: "fire", flamme: "flame", incendie: "fire", brasier: "fire", eclair: "lightning", nuage: "cloud", pluie: "rain", neige: "snow", flocon: "snowflake",
  voiture: "car", moto: "motorcycle", velo: "bicycle", avion: "plane", bateau: "boat", fusee: "rocket", train: "train",
  guitare: "guitar", piano: "piano", batterie: "drum", micro: "microphone", musique: "music", casque: "headphones",
  ballon: "ball", foot: "football", football: "football", basket: "basketball", tennis: "tennis", boxe: "boxing",
  couronne: "crown", epee: "sword", bouclier: "shield", ancre: "anchor", cle: "key", livre: "book", appareil: "camera",
  cafe: "coffee", biere: "beer", chope: "beer", brasserie: "beer", pinte: "beer", mousse: "foam", vin: "wine", pizza: "pizza", gateau: "cake",
  maison: "house", chateau: "castle", ville: "city", pont: "bridge", tour: "tower", monde: "world", terre: "earth",
  planete: "planet", astronaute: "astronaut", robot: "robot", fantome: "ghost", sorciere: "witch", ange: "angel",
  diable: "devil", ninja: "ninja", pirate: "pirate", chevalier: "knight", viking: "viking", samourai: "samurai",
  manette: "gamepad", jeu: "game", pinceau: "brush", camera: "camera", sport: "sport", yoga: "yoga", danse: "dance",
}

/** Mots de style ou de format : ne décrivent pas le dessin (« logo », « minimal »…). */
const STOP_WORDS = new Set([
  "logo", "minimal", "minimalist", "minimalism", "vintage", "retro", "style", "design", "shirt", "tshirt", "tee", "icon",
  "symbol", "graphic", "print", "illustration", "drawing", "image", "simple", "modern", "elegant", "cool", "sexy",
  "bold", "playful", "colorful", "black", "white", "red", "blue", "pink", "orange", "green", "yellow", "purple",
])

const PEOPLE_TOKENS = new Set(["male", "female", "boy", "girl", "child", "man", "woman", "baby"]);
const EXTRA_PEOPLE = ["male", "boy", "girl", "child", "female", "pregnant", "baby", "elderly", "wheelchair"].map((w) => w.replace(/s$/, ""));

/** Sujets « personne » : on préfère alors une silhouette en pied à un visage. */
const PERSON_WORDS = new Set(["woman", "man", "girl", "boy", "person", "people", "female", "male", "lady", "child", "kid", "dancer", "silhouette"])

const stem = (w) => w.replace(/(ies)$/, "y").replace(/(es|s)$/, "").replace(/ing$/, "");

const defaultLoader = async () => {
  const [g, m] = await Promise.all([import("@iconify-json/game-icons/icons.json"), import("@iconify-json/mdi/icons.json")]);
  return { "game-icons": g.default ?? g, mdi: m.default ?? m };
};

function buildIndex(sets) {
  const entries = [];
  for (const [set, data] of Object.entries(sets)) {
    // Alias Material Design : autres noms d'une même icône (mots-clés en plus).
    const extra = new Map();
    for (const [alias, info] of Object.entries(data.aliases ?? {})) {
      if (!info?.parent) continue;
      if (!extra.has(info.parent)) extra.set(info.parent, []);
      extra.get(info.parent).push(...alias.split("-"));
    }
    for (const [name, icon] of Object.entries(data.icons)) {
      const tokens = name.split("-");
      if (set === "mdi" && tokens.some((t) => UI_WORDS.has(t))) continue;
      entries.push({
        set,
        name,
        tokens,
        stems: new Set([...tokens, ...(extra.get(name) ?? [])].map(stem)),
        body: icon.body,
        w: icon.width ?? data.width ?? 24,
        h: icon.height ?? data.height ?? 24,
      });
    }
  }
  return entries;
}

let indexPromise = null;
/** Charge (une fois) les bibliothèques et construit l'index de recherche. */
export function loadIllustrations(loader = defaultLoader) {
  indexPromise ??= loader()
    .then(buildIndex)
    .catch((err) => {
      indexPromise = null; // nouvel essai possible
      throw err;
    });
  return indexPromise;
}

/** Tracés SVG (attribut d) d'une icône ; null si elle contient autre chose que des tracés pleins. */
export function iconPaths(body) {
  if (!/^(<path [^>]*\/>)+$/.test(body) || /(stroke|transform|fill="none"|opacity)/.test(body)) return null;
  const paths = [...body.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);
  return paths.length && paths.every((d) => SAFE_PATH.test(d)) ? paths : null;
}
/** Caractères autorisés dans un tracé (aucune balise, aucun script). */
export const SAFE_PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\s+-]+$/;

const cleanKeywords = (keywords) => {
  const words = [
    ...new Set(
      (Array.isArray(keywords) ? keywords : String(keywords ?? "").split(/[\s,]+/))
        .map((k) => String(k).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, ""))
        .filter((k) => k.length >= 2)
        .map((k) => FR_EN[k] ?? FR_EN[k.replace(/s$/, "")] ?? k)
    ),
  ];
  // Sans les mots de style, sauf s'il ne reste rien d'autre.
  const subject = words.filter((w) => !STOP_WORDS.has(w));
  return (subject.length ? subject : words).slice(0, 6);
};

/**
 * Cherche les illustrations correspondant aux mots-clés (anglais), meilleures d'abord, toutes différentes.
 * @returns {Promise<Array<{ id: string, label: string } & ({ kind: "motif" } | { kind: "icon", icon: string, paths: string[], vb: [number, number], credit: string })>>}
 */
export async function searchIllustrations(keywords, { limit = 6, loader } = {}) {
  const words = cleanKeywords(keywords);
  if (!words.length) return [];
  // Le premier mot-clé est le sujet principal : il pèse plus lourd.
  const personSubject = PERSON_WORDS.has(words[0]);
  const asked = new Set(words.flatMap((w) => [stem(w), ...(SYNONYMS[w] ?? []).map(stem)]));
  const query = words.map((w, i) => ({ stem: stem(w), weight: i === 0 ? 1.6 : 1, syn: (SYNONYMS[w] ?? []).map(stem) }));

  const scoreTokens = (stems, tokenCount, tokens = []) => {
    let score = 0;
    let hits = 0;
    let subject = false;
    for (const [qi, q] of query.entries()) {
      const before = hits;
      if (stems.has(q.stem)) {
        score += 3 * q.weight;
        hits++;
      } else if (q.syn.some((s) => stems.has(s))) {
        score += 1.8 * q.weight;
        hits++;
      } else if (q.stem.length >= 4 && [...stems].some((s) => s.length >= 4 && (s.startsWith(q.stem) || q.stem.startsWith(s)))) {
        score += 1 * q.weight;
        hits++;
      }
      if (qi === 0 && hits > before) subject = true;
    }
    // Les noms courts et précis (« female ») passent avant les longs (« female-vampire »).
    let total = hits ? score - 0.45 * Math.max(0, tokenCount - hits) : 0;
    // Une personne : silhouette en pied plutôt qu'un visage.
    if (total && personSubject) {
      total += stems.has("human") || stems.has("silhouette") ? 1.5 : stems.has("face") ? -1 : 0;
      // Personnes en plus ou trop particulières (« femme et garçon », « enceinte ») : seulement si demandé.
      for (const extra of EXTRA_PEOPLE) if (stems.has(extra) && !asked.has(extra)) total -= 3;
      // Plusieurs personnes dans le nom (« human-female-female », « human-male-female ») : un groupe.
      if (tokens.filter((t) => PEOPLE_TOKENS.has(t)).length >= 2 && !asked.has("group")) total -= 3;
    }
    return { score: total, subject };
  };

  const results = [];
  for (const id of MOTIF_IDS) {
    const stems = new Set((MOTIF_WORDS[id] ?? []).map(stem));
    // Nos motifs : bonus (multicolores, effets intégrés) mais seulement s'ils correspondent vraiment.
    const { score: s, subject } = scoreTokens(stems, 1);
    if (s >= 3) results.push({ score: s + 1.2, subject, item: { kind: "motif", id, label: id } });
  }
  const index = await loadIllustrations(loader);
  for (const e of index) {
    const { score: s, subject } = scoreTokens(e.stems, e.tokens.length, e.tokens);
    if (s < 2.5) continue;
    results.push({ score: s + ICON_SETS[e.set].bonus, subject, entry: e });
  }
  // Le sujet (1er mot-clé) d'abord : « guitar, rock » ne doit pas donner des rochers.
  results.sort((a, b) => Number(b.subject) - Number(a.subject) || b.score - a.score);

  const out = [];
  const seen = new Set();
  for (const r of results) {
    if (out.length >= limit) break;
    if (r.item) {
      out.push(r.item);
      continue;
    }
    const e = r.entry;
    const key = e.tokens.filter((t) => !["variant", "outline", "alt"].includes(t)).join("-");
    if (seen.has(key)) continue;
    const paths = iconPaths(e.body);
    if (!paths) continue;
    seen.add(key);
    out.push({
      kind: "icon",
      id: "icon",
      icon: `${e.set}:${e.name}`,
      label: e.name.replace(/-/g, " "),
      paths,
      vb: [e.w, e.h],
      credit: ICON_SETS[e.set].credit,
    });
  }
  return out;
}

/**
 * Sujets nommés dans la demande française (« dragon », « feu ») : traduits, dans l'ordre de la phrase.
 * Ils passent avant les mots-clés de l'IA, dont l'ordre est moins fiable (mesuré : « burning, dragon »).
 */
export function promptKeywords(prompt = "") {
  const withoutQuote = prompt.replace(/["«“][^"»”]*["»”]/g, " ");
  const words = withoutQuote.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z]+/);
  const found = [...new Set(words.map((w) => FR_EN[w] ?? FR_EN[w.replace(/s$/, "")]).filter(Boolean))];
  // « silhouette d'une femme » : le sujet est la femme, « silhouette » le précise.
  const modifiers = new Set(["silhouette", "head", "face"]);
  return [...found.filter((w) => !modifiers.has(w)), ...found.filter((w) => modifiers.has(w))].slice(0, 4);
}

/** Mots-clés de recherche : sujets de la demande d'abord, puis ceux de l'IA. */
export const illustrationKeywords = (prompt, aiKeywords = []) => [...new Set([...promptKeywords(prompt), ...aiKeywords])].slice(0, 5);

/** Paramètre `motif` du moteur à partir d'un résultat de recherche. */
export const motifFromIllustration = (ill) =>
  ill.kind === "icon" ? { id: "icon", icon: ill.icon, paths: ill.paths, vb: ill.vb, credit: ill.credit } : { id: ill.id };
