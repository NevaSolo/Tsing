import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { createShirtTexture, loadImage, SHIRT_MODEL_URL, tuneShirtMaterial } from "../utils/shirtTexture";
import { ensureFonts, fontsOf, fontsReady } from "../utils/fonts";

// Le modèle a sa géométrie embarquée (data URI) : pas de requête « .bin », que certains
// gestionnaires de téléchargement (ex. IDM) interceptent en renvoyant une réponse vide.

/** Angle (axe Y) pour présenter la face ou le dos du t-shirt. */
const VIEW_ANGLE = { front: 0, back: Math.PI };

/**
 * T-shirt 3D texturé avec le design.
 * `view` : "front" | "back" — le modèle pivote en douceur vers la face demandée.
 */
const Shirt = ({
  text,
  textColor,
  textSize,
  textPosition,
  textRotation,
  image,
  fontFamily,
  imageScale = 1,
  imagePosition = { x: 0.5, y: 0.5 },
  imageRotation = 0,
  tshirtColor = "#ffffff",
  layers,
  selectedId,
  view = "front",
  onSurfacePointer,
}) => {
  const { nodes, materials } = useGLTF(SHIRT_MODEL_URL);
  const [loadedImage, setLoadedImage] = useState(null);
  // Incrémenté quand une police web finit de charger : la texture est alors redessinée.
  const [fontsVersion, setFontsVersion] = useState(0);
  const fontKey = fontsOf(layers, [fontFamily]).sort().join("|");
  useEffect(() => {
    const families = fontKey ? fontKey.split("|") : [];
    if (fontsReady(families)) return;
    let cancelled = false;
    ensureFonts(families).then(() => {
      if (!cancelled) setFontsVersion((v) => v + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [fontKey]);
  const groupRef = useRef();

  // Matériau propre à cette instance (plusieurs t-shirts peuvent coexister).
  const material = useMemo(() => {
    return tuneShirtMaterial(materials.lambert1.clone());
  }, [materials]);
  useEffect(() => () => material.dispose(), [material]);

  useEffect(() => {
    let cancelled = false;
    loadImage(image).then((img) => {
      if (!cancelled) setLoadedImage(img);
    });
    return () => {
      cancelled = true;
    };
  }, [image]);

  const texture = useMemo(
    () =>
      createShirtTexture(
        {
          text,
          textColor,
          textSize,
          textPosition,
          textRotation,
          fontFamily,
          imageScale,
          imagePosition,
          imageRotation,
          tshirtColor,
          layers,
          selectedId,
        },
        loadedImage
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, textColor, textSize, textPosition, textRotation, fontFamily, imageScale, imagePosition, imageRotation, tshirtColor, layers, selectedId, loadedImage, fontsVersion]
  );

  useEffect(() => {
    material.map = texture;
    material.needsUpdate = true;
    // Libère la texture GPU précédente à chaque régénération (évite une fuite mémoire).
    return () => texture.dispose();
  }, [material, texture]);

  // Rotation animée vers la vue demandée.
  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const target = VIEW_ANGLE[view] ?? VIEW_ANGLE.front;
    group.rotation.y = THREE.MathUtils.damp(group.rotation.y, target, 6, delta);
  });

  return (
    <group ref={groupRef} rotation={[0, VIEW_ANGLE[view] ?? VIEW_ANGLE.front, 0]}>
      <mesh
        geometry={nodes.Object_4.geometry}
        material={material}
        castShadow
        receiveShadow
        {...(onSurfacePointer && {
          // Les événements three.js fournissent la coordonnée de texture (uv) du point touché :
          // c'est ce qui permet de dessiner directement sur le t-shirt.
          onPointerDown: (e) => {
            if (!e.uv) return;
            e.stopPropagation();
            // Capture au niveau du DOM uniquement : la capture d'objet de R3F rejouerait
            // l'intersection du pointerdown (uv périmé) quand le pointeur sort du t-shirt.
            e.nativeEvent.target?.setPointerCapture?.(e.pointerId);
            onSurfacePointer("down", { x: e.uv.x, y: e.uv.y }, e);
          },
          onPointerMove: (e) => {
            if (!e.uv) return;
            e.stopPropagation(); // une seule intersection (la plus proche) par événement
            onSurfacePointer("move", { x: e.uv.x, y: e.uv.y }, e);
          },
          onPointerUp: (e) => {
            e.nativeEvent.target?.releasePointerCapture?.(e.pointerId);
            onSurfacePointer("up", e.uv ? { x: e.uv.x, y: e.uv.y } : null, e);
          },
        })}
      />
    </group>
  );
};

// Démarre le téléchargement du modèle dès l'import du module.
useGLTF.preload(SHIRT_MODEL_URL);

export default Shirt;
