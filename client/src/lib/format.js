const priceFormatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

/** Formate un prix (nombre ou chaîne décimale renvoyée par l'API) en euros. */
export function formatPrice(value) {
  const n = Number(value);
  return priceFormatter.format(Number.isFinite(n) ? n : 0);
}

/** Les champs JSON peuvent arriver sous forme de chaîne (anciennes données) : on les normalise. */
export function parseJSONField(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

/**
 * Zones du modèle 3D en coordonnées de texture (calculées sur la géométrie de shirt.gltf).
 * Le centre du devant n'est PAS en 0.5 : la texture contient le devant à gauche, le dos à droite.
 */
export const PLACEMENTS = {
  chest: { x: 0.265, y: 0.3 },
  belly: { x: 0.27, y: 0.4 },
  back: { x: 0.76, y: 0.3 },
};
export const DEFAULT_TEXT_POSITION = PLACEMENTS.chest;
export const DEFAULT_IMAGE_POSITION = { x: 0.265, y: 0.33 };

function parsePosition(value, fallback) {
  const pos = parseJSONField(value, fallback);
  const x = Number(pos?.x);
  const y = Number(pos?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : fallback;
}

/** Normalise un t-shirt renvoyé par l'API pour l'affichage 3D. */
export function normalizeShirt(shirt) {
  if (!shirt) return shirt;
  return {
    ...shirt,
    position: parsePosition(shirt.position, DEFAULT_TEXT_POSITION),
    rotation: Number(parseJSONField(shirt.rotation, 0)) || 0,
    image_scale: Number(parseJSONField(shirt.image_scale, 1)) || 1,
    image_position: parsePosition(shirt.image_position, DEFAULT_IMAGE_POSITION),
    image_rotation: Number(parseJSONField(shirt.image_rotation, 0)) || 0,
  };
}
