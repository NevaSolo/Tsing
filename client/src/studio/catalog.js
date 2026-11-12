/*
 * Catalogue du Studio : thèmes (mots-clés, slogans, palettes, formes, motifs), styles et mots de couleur.
 * Les motifs (illustrations) sont définis dans motifs.js.
 * Les mots-clés sont écrits sans accents, en minuscules (le texte de l'utilisateur est normalisé pareil).
 * Palette : { shirt, primary, secondary, accent } — primary/secondary sont lisibles sur shirt.
 */

export const THEMES = [
  {
    id: "surf",
    label: "Surf & plage",
    keywords: ["surf", "surfeur", "surfeuse", "plage", "vague", "ocean", "mer", "ete", "soleil", "sable", "tropical", "palmier", "beach", "wave", "summer", "glisse"],
    slogans: ["Ride the wave", "Esprit vague", "Sel & soleil", "Toujours l'été", "Cap sur la mer", "Libre comme l'océan"],
    motifs: ["wave", "sun", "palm", "sunset"],
    shapes: ["circle", "triangle", "star"],
    palettes: [
      { shirt: "#fdf6ec", primary: "#e4572e", secondary: "#17bebb", accent: "#ffc914" },
      { shirt: "#0b3954", primary: "#ffffff", secondary: "#ff7f11", accent: "#bfd7ea" },
      { shirt: "#ffffff", primary: "#0081a7", secondary: "#f07167", accent: "#fed9b7" },
    ],
  },
  {
    id: "gaming",
    label: "Gaming",
    keywords: ["gaming", "gamer", "jeu", "jeux", "video", "manette", "console", "pixel", "esport", "arcade", "retrogaming", "level", "joueur", "game"],
    slogans: ["Game on", "Encore une partie", "Player one", "Niveau suivant", "Respawn", "Pas de pause"],
    motifs: ["gamepad", "bolt", "starburst"],
    shapes: ["triangle", "rect", "circle", "star"],
    palettes: [
      { shirt: "#111111", primary: "#39ff14", secondary: "#ff2fd1", accent: "#00e5ff" },
      { shirt: "#1b1b3a", primary: "#ffd23f", secondary: "#ee4266", accent: "#3bceac" },
      { shirt: "#ffffff", primary: "#6a00f4", secondary: "#ff0054", accent: "#00bbf9" },
    ],
  },
  {
    id: "sport",
    label: "Sport",
    keywords: ["sport", "club", "equipe", "foot", "football", "basket", "rugby", "course", "running", "marathon", "gym", "fitness", "muscu", "tennis", "velo", "match", "champion", "team"],
    slogans: ["Toujours plus loin", "Esprit d'équipe", "Jamais sans mon club", "Sueur & fierté", "Champion de cœur", "On lâche rien"],
    motifs: ["ball", "bolt", "dumbbell", "flame"],
    shapes: ["star", "circle", "rect"],
    palettes: [
      { shirt: "#ffffff", primary: "#c1121f", secondary: "#003049", accent: "#fdf0d5" },
      { shirt: "#14213d", primary: "#fca311", secondary: "#ffffff", accent: "#e5e5e5" },
      { shirt: "#0a9396", primary: "#ffffff", secondary: "#001219", accent: "#ee9b00" },
    ],
  },
  {
    id: "nature",
    label: "Nature & montagne",
    keywords: ["nature", "montagne", "foret", "arbre", "rando", "randonnee", "camping", "plante", "fleur", "vert", "ecolo", "terre", "lac", "sommet", "outdoor", "aventure"],
    slogans: ["La montagne m'appelle", "Racines & sommets", "Plus haut", "Respire", "Sauvage & libre", "Prendre l'air"],
    motifs: ["mountains", "pines", "tent", "sun"],
    shapes: ["triangle", "circle", "heart"],
    palettes: [
      { shirt: "#f1faee", primary: "#2d6a4f", secondary: "#bc6c25", accent: "#95d5b2" },
      { shirt: "#283618", primary: "#fefae0", secondary: "#dda15e", accent: "#a3b18a" },
      { shirt: "#ffffff", primary: "#386641", secondary: "#a7c957", accent: "#bc4749" },
    ],
  },
  {
    id: "music",
    label: "Musique",
    keywords: ["musique", "music", "rock", "rap", "hip", "hop", "jazz", "concert", "festival", "guitare", "dj", "groupe", "band", "electro", "metal", "punk"],
    slogans: ["Monte le son", "Live forever", "Sur le beat", "Pas de musique, pas de vie", "Encore un rappel", "Volume max"],
    motifs: ["note", "vinyl", "headphones", "bolt"],
    shapes: ["star", "circle", "triangle"],
    palettes: [
      { shirt: "#111111", primary: "#ffffff", secondary: "#e63946", accent: "#f1c40f" },
      { shirt: "#2b2d42", primary: "#edf2f4", secondary: "#ef233c", accent: "#8d99ae" },
      { shirt: "#f8f9fa", primary: "#212529", secondary: "#7209b7", accent: "#f72585" },
    ],
  },
  {
    id: "love",
    label: "Amour & amitié",
    keywords: ["amour", "love", "coeur", "couple", "mariage", "saint", "valentin", "amitie", "ami", "amie", "copine", "bff", "famille", "maman", "papa", "mamie", "papi"],
    slogans: ["Fait avec amour", "Toi & moi", "Cœur sur toi", "Pour la vie", "Ma team de cœur", "Love club"],
    motifs: ["heart", "flower", "starburst"],
    shapes: ["heart", "star", "circle"],
    palettes: [
      { shirt: "#ffffff", primary: "#d00000", secondary: "#ff8fab", accent: "#ffccd5" },
      { shirt: "#ffe5ec", primary: "#9d0208", secondary: "#fb6f92", accent: "#ffffff" },
      { shirt: "#590d22", primary: "#ffccd5", secondary: "#ff4d6d", accent: "#fff0f3" },
    ],
  },
  {
    id: "coffee",
    label: "Café & cuisine",
    keywords: ["cafe", "coffee", "cuisine", "chef", "food", "pizza", "boulangerie", "patisserie", "brunch", "barista", "restaurant", "gourmand"],
    slogans: ["Café d'abord", "Mais d'abord, un café", "Chef de la maison", "Gourmand assumé", "Fait maison", "Bonne humeur torréfiée"],
    motifs: ["coffee", "beer", "heart"],
    shapes: ["circle", "heart", "star"],
    palettes: [
      { shirt: "#f5ebe0", primary: "#6f4518", secondary: "#a68a64", accent: "#d5bdaf" },
      { shirt: "#3c2a21", primary: "#f5ebe0", secondary: "#d5a253", accent: "#e3d5ca" },
      { shirt: "#ffffff", primary: "#7f4f24", secondary: "#e76f51", accent: "#f4a261" },
    ],
  },
  {
    id: "space",
    label: "Espace & science",
    keywords: ["espace", "space", "planete", "etoile", "galaxie", "lune", "astronaute", "fusee", "cosmos", "science", "astro", "univers", "nasa", "geek", "code", "dev", "tech"],
    slogans: ["Vers l'infini", "Tête dans les étoiles", "Explorer encore", "Mission accomplie", "Gravité zéro", "Hello world"],
    motifs: ["rocket", "planet", "moon", "starburst"],
    shapes: ["star", "circle", "triangle"],
    palettes: [
      { shirt: "#0d1b2a", primary: "#e0e1dd", secondary: "#ffb703", accent: "#778da9" },
      { shirt: "#10002b", primary: "#e0aaff", secondary: "#ffffff", accent: "#7b2cbf" },
      { shirt: "#ffffff", primary: "#03045e", secondary: "#f77f00", accent: "#00b4d8" },
    ],
  },
  {
    id: "street",
    label: "Ville & streetwear",
    keywords: ["ville", "street", "streetwear", "urbain", "skate", "graffiti", "paris", "quartier", "city", "hood", "hype", "drip", "mode", "fashion"],
    slogans: ["Made in the streets", "Original", "Pas comme les autres", "Ville lumière", "Toujours en mouvement", "No limit"],
    motifs: ["bolt", "crown", "flame", "starburst"],
    shapes: ["rect", "triangle", "star"],
    palettes: [
      { shirt: "#111111", primary: "#ffffff", secondary: "#ff3c38", accent: "#a3a3a3" },
      { shirt: "#e5e5e5", primary: "#111111", secondary: "#ff5400", accent: "#6c757d" },
      { shirt: "#ffffff", primary: "#000000", secondary: "#a40000", accent: "#ffd60a" },
    ],
  },
  {
    id: "animals",
    label: "Animaux",
    keywords: ["animal", "animaux", "chat", "chien", "chiot", "chaton", "lion", "loup", "ours", "renard", "oiseau", "cheval", "dog", "cat"],
    slogans: ["Team chat", "Meilleur ami à quatre pattes", "Sauvage", "Esprit loup", "Patte de velours", "Mon chien, mon héros"],
    motifs: ["cat", "paw", "heart"],
    shapes: ["heart", "circle", "star"],
    palettes: [
      { shirt: "#fefae0", primary: "#bc6c25", secondary: "#283618", accent: "#dda15e" },
      { shirt: "#222222", primary: "#f4a261", secondary: "#ffffff", accent: "#e9c46a" },
      { shirt: "#ffffff", primary: "#264653", secondary: "#e76f51", accent: "#2a9d8f" },
    ],
  },
  {
    id: "party",
    label: "Fête & événement",
    keywords: ["fete", "anniversaire", "party", "soiree", "evjf", "evg", "bapteme", "noel", "nouvel", "an", "celebration", "event", "evenement", "promo", "diplome", "remise"],
    slogans: ["Ce soir on fête", "Joyeux anniversaire", "Promo légendaire", "Team mariée", "La fête continue", "Moment inoubliable"],
    motifs: ["starburst", "crown", "flame", "note"],
    shapes: ["star", "heart", "circle", "triangle"],
    palettes: [
      { shirt: "#ffffff", primary: "#ff006e", secondary: "#3a86ff", accent: "#ffbe0b" },
      { shirt: "#3a0ca3", primary: "#ffffff", secondary: "#f72585", accent: "#4cc9f0" },
      { shirt: "#ffbe0b", primary: "#1d1d1d", secondary: "#fb5607", accent: "#ffffff" },
    ],
  },
  {
    id: "travel",
    label: "Voyage",
    keywords: ["voyage", "travel", "road", "trip", "aventure", "monde", "avion", "valise", "vacances", "explorer", "roadtrip", "backpack"],
    slogans: ["Ailleurs, c'est ici", "Prochain départ", "Le monde est à nous", "Road trip forever", "Collectionneur de souvenirs", "Pas de destination fixe"],
    motifs: ["plane", "globe", "mountains", "palm", "anchor"],
    shapes: ["circle", "triangle", "star"],
    palettes: [
      { shirt: "#edf6f9", primary: "#006d77", secondary: "#e29578", accent: "#83c5be" },
      { shirt: "#1d3557", primary: "#f1faee", secondary: "#e63946", accent: "#a8dadc" },
      { shirt: "#ffffff", primary: "#283d3b", secondary: "#c44536", accent: "#edddd4" },
    ],
  },
];

export const GENERIC_THEME = {
  id: "generic",
  label: "Libre",
  keywords: [],
  slogans: ["Original", "Fait main", "Édition limitée", "Sois toi-même", "Rien n'est impossible", "Simple & efficace"],
  motifs: ["starburst", "heart", "bolt", "sun", "crown"],
  shapes: ["star", "circle", "rect", "triangle", "heart"],
  palettes: [
    { shirt: "#ffffff", primary: "#111111", secondary: "#a40000", accent: "#d4d4d4" },
    { shirt: "#111111", primary: "#ffffff", secondary: "#e63946", accent: "#9e9e9e" },
    { shirt: "#f1faee", primary: "#1d3557", secondary: "#e63946", accent: "#a8dadc" },
  ],
};

/** Styles : polices (chargées dans index.html), casse, mises en page privilégiées. */
export const STYLES = [
  {
    id: "minimal",
    label: "Minimal",
    keywords: ["minimal", "minimaliste", "sobre", "simple", "epure", "discret", "clean", "elegant", "chic"],
    fonts: ["Oswald", "Helvetica"],
    uppercase: true,
    layouts: ["minimal", "stack", "frame"],
  },
  {
    id: "vintage",
    label: "Vintage",
    keywords: ["vintage", "retro", "ancien", "oldschool", "classique", "annees", "70s", "80s", "90s", "nostalgie", "nostalgique"],
    fonts: ["Playfair Display", "Georgia"],
    uppercase: false,
    layouts: ["crest", "emblem", "badge", "frame"],
  },
  {
    id: "bold",
    label: "Percutant",
    keywords: ["bold", "gros", "fort", "impact", "streetwear", "puissant", "massif", "imposant", "grand", "big"],
    fonts: ["Bebas Neue", "Impact", "Jaro"],
    uppercase: true,
    layouts: ["stack", "crest", "badge", "back"],
  },
  {
    id: "playful",
    label: "Fun",
    keywords: ["fun", "drole", "rigolo", "enfant", "kids", "joyeux", "mignon", "cute", "colore", "pop", "humour", "decale"],
    fonts: ["Pacifico", "Permanent Marker"],
    uppercase: false,
    layouts: ["emblem", "badge", "stack"],
  },
];

/**
 * Styles d'écriture demandés dans le prompt (« écriture manuscrite », « police graffiti »…).
 * Polices chargées dans index.html. Ils priment sur les polices du style graphique.
 */
export const WRITING_STYLES = [
  { id: "script", label: "Manuscrite élégante", fonts: ["Lobster", "Dancing Script", "Pacifico"], uppercase: false,
    keywords: ["manuscrite", "manuscrit", "cursive", "calligraphie", "calligraphique", "attachee", "script", "signature", "lobster", "pacifico"] },
  { id: "hand", label: "Écrite à la main", fonts: ["Caveat", "Indie Flower", "Shadows Into Light"], uppercase: false,
    keywords: ["main", "crayon", "feutre", "griffonnee", "naive", "enfantine", "craie", "caveat"] },
  { id: "marker", label: "Graffiti / marqueur", fonts: ["Permanent Marker"], uppercase: true,
    keywords: ["graffiti", "graff", "tag", "marqueur", "pinceau", "brush", "bombe"] },
  { id: "serif", label: "Classique à empattements", fonts: ["Playfair Display", "Merriweather"], uppercase: false,
    keywords: ["serif", "empattement", "empattements", "classique", "elegante", "luxe", "magazine", "journal", "playfair"] },
  { id: "condensed", label: "Affiche condensée", fonts: ["Bebas Neue", "Oswald"], uppercase: true,
    keywords: ["condensee", "affiche", "capitales", "majuscules", "haute", "etroite", "bebas", "oswald"] },
  { id: "rounded", label: "Moderne arrondie", fonts: ["Montserrat", "Quicksand", "Raleway"], uppercase: false,
    keywords: ["moderne", "arrondie", "geometrique", "ronde", "douce", "montserrat"] },
  { id: "future", label: "Futuriste", fonts: ["Orbitron", "Jaro"], uppercase: true,
    keywords: ["futuriste", "futur", "techno", "tech", "cyber", "robot", "spatiale", "orbitron", "pixel"] },
];

/** Mots de couleur → teinte hexadécimale. */
export const COLOR_WORDS = {
  rouge: "#d62828", bordeaux: "#7b1e3a", rose: "#ff6fa5", fuchsia: "#d81b9b", orange: "#f77f00",
  jaune: "#ffc300", dore: "#d4a017", vert: "#2a9d48",
  kaki: "#6b705c", turquoise: "#1abc9c", cyan: "#00b4d8", bleu: "#1d4ed8", marine: "#14213d",
  violet: "#7b2cbf", mauve: "#b388eb", lilas: "#c8a2c8", marron: "#7f4f24", beige: "#e9d8a6",
  creme: "#fdf6ec", ambre: "#e8a317", cuivre: "#b87333", caramel: "#c68e17", bronze: "#cd7f32", moutarde: "#d4a20c", ocre: "#cc7722", miel: "#eba937", gris: "#8d99ae", noir: "#111111", blanc: "#ffffff", argent: "#c0c0c0",
};

/** Ambiances de couleur (modifient la palette générée). */
export const MOODS = {
  pastel: { lightness: 0.8, saturation: 0.6 },
  fluo: { lightness: 0.55, saturation: 1 },
  neon: { lightness: 0.55, saturation: 1 },
  sombre: { lightness: 0.25, saturation: 0.5 },
  fonce: { lightness: 0.25, saturation: 0.5 },
  clair: { lightness: 0.75, saturation: 0.5 },
};

/** Zones imprimables en coordonnées de texture (mesurées sur la géométrie de shirt.gltf). */
export const PRINT_ZONES = {
  front: { u0: 0.113, u1: 0.409, v0: 0.157, v1: 0.528 },
  back: { u0: 0.596, u1: 0.901, v0: 0.148, v1: 0.512 },
};

/** Largeur réelle approximative de la zone imprimable (cm) — pour exprimer les tailles en centimètres. */
export const PRINT_WIDTH_CM = 30;
