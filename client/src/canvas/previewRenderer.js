import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { normalizeShirt } from "../lib/format";
import {
  createShirtTexture,
  LIGHTS,
  loadImage,
  SHIRT_MODEL_URL,
  shirtToDesign,
  tuneShirtMaterial,
} from "./utils/shirtTexture";
import { ensureFonts, fontsOf } from "./utils/fonts";

/*
 * Générateur d'aperçus pour les listes (Boutique, Archive…).
 * Un seul WebGLRenderer pour toute l'application, au lieu d'un <Canvas> par carte :
 * les navigateurs limitent le nombre de contextes WebGL (~16) et chacun coûte cher.
 * Les rendus sont mis en file (un à la fois) et en cache (data URL).
 */

const SIZE = 640;
const cache = new Map();
let enginePromise = null;
let queue = Promise.resolve();

function createEngine() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(SIZE, SIZE, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0xffffff, LIGHTS.ambient));
  scene.add(new THREE.HemisphereLight(LIGHTS.hemisphere.sky, LIGHTS.hemisphere.ground, LIGHTS.hemisphere.intensity));
  const key = new THREE.DirectionalLight(0xffffff, LIGHTS.key.intensity);
  key.position.set(...LIGHTS.key.position);
  const fill = new THREE.DirectionalLight(0xffffff, LIGHTS.fill.intensity);
  fill.position.set(...LIGHTS.fill.position);
  scene.add(key, fill);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 100);

  return new GLTFLoader().loadAsync(SHIRT_MODEL_URL).then((gltf) => {
    const pivot = new THREE.Group();
    const model = gltf.scene;
    let material = null;
    model.traverse((obj) => {
      if (obj.isMesh) {
        material = tuneShirtMaterial(obj.material.clone());
        obj.material = material;
      }
    });
    // Centre le modèle sur l'origine pour pouvoir le faire pivoter sur lui-même.
    const box = new THREE.Box3().setFromObject(model);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(center);
    pivot.add(model);
    scene.add(pivot);

    const fitHeight = Math.max(size.y, size.x) * 1.22;
    const distance = fitHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.position.set(0, 0, distance);
    camera.lookAt(0, 0, 0);

    return { renderer, scene, camera, pivot, material };
  });
}

async function fetchAsObjectUrl(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return URL.createObjectURL(await response.blob());
}

async function render(shirt, view) {
  enginePromise ??= createEngine();
  const { renderer, scene, camera, pivot, material } = await enginePromise;

  let objectUrl = null;
  try {
    // Blob local pour éviter un canvas « tainted » (image servie par le backend, autre origine).
    if (shirt.image) objectUrl = await fetchAsObjectUrl(shirt.image).catch(() => null);
    const image = await loadImage(objectUrl);
    const design = shirtToDesign(shirt);
    await ensureFonts(fontsOf(design.layers, [design.fontFamily]));
    const texture = createShirtTexture(design, image);
    material.map = texture;
    material.needsUpdate = true;
    pivot.rotation.y = view === "back" ? Math.PI : 0;
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL("image/webp", 0.9);
    texture.dispose();
    return dataUrl;
  } finally {
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Renvoie (en cache si possible) une data URL de l'aperçu du t-shirt.
 * @param {object} rawShirt t-shirt tel que renvoyé par l'API
 * @param {"front"|"back"} view
 */
export function getShirtPreview(rawShirt, view = "front") {
  const shirt = normalizeShirt(rawShirt);
  const key = JSON.stringify([shirt.id, view, shirtToDesign(shirt), shirt.image]);
  if (!cache.has(key)) {
    const job = queue.then(() => render(shirt, view));
    // La file continue même si un rendu échoue.
    queue = job.catch(() => {});
    cache.set(key, job);
    job.catch(() => cache.delete(key));
  }
  return cache.get(key);
}
