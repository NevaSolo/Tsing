import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Html, OrbitControls, Stage } from "@react-three/drei";
import Shirt from "./objects/Shirt";
import ErrorBoundary from "../components/ErrorBoundary";
import { Spinner } from "../components/ui/feedback";
import { LIGHTS } from "./utils/shirtTexture";

const ModelLoader = () => (
  <Html center>
    <div className="flex items-center gap-2 whitespace-nowrap rounded-full bg-background/90 px-4 py-2 text-sm text-muted-foreground shadow-[var(--shadow-card)]">
      <Spinner label="Chargement du modèle 3D" />
      Chargement du modèle…
    </div>
  </Html>
);

/**
 * Scène 3D unique du t-shirt (personnaliseur et page produit) :
 * même éclairage, même chargement, même gestion d'erreur partout.
 * - `design` : props du composant Shirt (texte, image, couleurs…)
 * - `view` : "front" | "back"
 * - `preserveDrawingBuffer` : nécessaire pour exporter le rendu en PNG
 */
const ShirtScene = ({
  design,
  view = "front",
  preserveDrawingBuffer = false,
  cameraZ = 1.2,
  className,
  editing = false,
  cursor,
  onSurfacePointer,
}) => (
  <div className={className} style={{ cursor: editing ? cursor : undefined }}>
    <ErrorBoundary>
      <Canvas
        // Toujours "none" : le doigt dessine (édition) ou fait tourner le t-shirt (OrbitControls).
        style={{ touchAction: "none" }}
        flat
        shadows
        dpr={[1, 2]}
        camera={{ position: [0, 0, cameraZ], fov: 40 }}
        gl={{ preserveDrawingBuffer, antialias: true }}
      >
        {/* Éclairage local (aucun HDR téléchargé) réglé pour qu'un t-shirt blanc reste blanc. */}
        <ambientLight intensity={LIGHTS.ambient} />
        <hemisphereLight args={[LIGHTS.hemisphere.sky, LIGHTS.hemisphere.ground, LIGHTS.hemisphere.intensity]} />
        <directionalLight position={LIGHTS.key.position} intensity={LIGHTS.key.intensity} castShadow />
        <directionalLight position={LIGHTS.fill.position} intensity={LIGHTS.fill.intensity} />
        <Suspense fallback={<ModelLoader />}>
          <Stage environment={null} intensity={0.2} shadows="contact" adjustCamera={1.15}>
            <Shirt {...design} view={view} onSurfacePointer={editing ? onSurfacePointer : undefined} />
          </Stage>
        </Suspense>
        <OrbitControls
          makeDefault
          // Désactivé pendant l'édition : le glisser dessine/déplace au lieu de tourner la caméra.
          enabled={!editing}
          enablePan={false}
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.8}
          minDistance={0.5}
          maxDistance={3}
        />
      </Canvas>
    </ErrorBoundary>
  </div>
);

export default ShirtScene;
