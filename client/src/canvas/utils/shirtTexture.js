import * as THREE from "three";
import { drawLayers, sanitizeLayers } from "./layers";
import { canvasFont } from "./fonts";

export const TEXTURE_SIZE = 1024;

/**
 * Dessine le design d'un t-shirt (couleur de fond, image, texte) sur un canvas 2D.
 * Fonction pure partagée par la scène interactive et le générateur d'aperçus.
 */
export function drawShirtDesign(canvas, design, image) {
  const {
    text,
    textColor = "#000000",
    textSize = 48,
    textPosition = { x: 0.5, y: 0.4 },
    textRotation = 0,
    fontFamily = "Arial",
    imageScale = 1,
    imagePosition = { x: 0.5, y: 0.5 },
    imageRotation = 0,
    tshirtColor = "#ffffff",
  } = design;

  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = tshirtColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (image) {
    const ratio = Math.min(canvas.width / image.width, canvas.height / image.height);
    const width = image.width * ratio * imageScale;
    const height = image.height * ratio * imageScale;
    ctx.save();
    ctx.translate(imagePosition.x * canvas.width, imagePosition.y * canvas.height);
    ctx.rotate((imageRotation * Math.PI) / 180);
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    ctx.restore();
  }

  if (text) {
    ctx.save();
    ctx.fillStyle = textColor;
    ctx.font = canvasFont(textSize, fontFamily);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.translate(textPosition.x * canvas.width, textPosition.y * canvas.height);
    ctx.rotate((textRotation * Math.PI) / 180);
    ctx.fillText(text, 0, 0);
    ctx.restore();
  }

  // Calques libres (traits, formes, textes) au-dessus du reste.
  drawLayers(ctx, design.layers, { selectedId: design.selectedId });
  return canvas;
}

/** Crée une texture three.js à partir du design. Penser à appeler texture.dispose(). */
export function createShirtTexture(design, image) {
  const canvas = drawShirtDesign(document.createElement("canvas"), design, image);
  const texture = new THREE.CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

/** Charge une image (URL, data URL ou blob URL) ; résout null si absente ou en échec. */
export function loadImage(src) {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Convertit un t-shirt de l'API (normalisé) en design pour drawShirtDesign. */
export function shirtToDesign(shirt) {
  return {
    text: shirt.custom_text,
    textColor: shirt.text_color,
    textSize: shirt.text_size,
    textPosition: shirt.position,
    textRotation: shirt.rotation,
    fontFamily: shirt.font_family,
    imageScale: shirt.image_scale,
    imagePosition: shirt.image_position,
    imageRotation: shirt.image_rotation,
    tshirtColor: shirt.shirt_color,
    layers: sanitizeLayers(shirt.layers),
  };
}

export const SHIRT_MODEL_URL = "/shirt.gltf";

/**
 * Règle le matériau du modèle pour un rendu fidèle de la couleur choisie.
 * Le modèle définit baseColorFactor = 0.5 (gris) qui assombrit toute la texture :
 * on repart du blanc ; tissu mat, plis conservés mais adoucis.
 */
export function tuneShirtMaterial(material) {
  material.color.set("#ffffff");
  material.metalness = 0;
  material.roughness = 0.9;
  material.aoMapIntensity = 0.6;
  if (material.normalScale) material.normalScale.set(0.2, 0.2);
  return material;
}

/** Éclairage commun (aucun HDR externe), utilisé par la scène et les aperçus. */
export const LIGHTS = {
  ambient: 1.1,
  hemisphere: { sky: "#ffffff", ground: "#d9d9d9", intensity: 0.9 },
  key: { position: [2, 3, 4], intensity: 1.2 },
  fill: { position: [-3, 1, -4], intensity: 0.6 },
};
