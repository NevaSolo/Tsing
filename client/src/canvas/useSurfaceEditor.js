import { useCallback, useEffect, useRef, useState } from "react";
import useLayersEditor from "./useLayersEditor";
import {
  appendPoint,
  createPathLayer,
  createShapeLayer,
  createTextLayer,
  hitTest,
  isSeamJump,
  translateLayer,
} from "./utils/layers";

const CURSORS = { orbit: "grab", select: "move", pen: "crosshair", eraser: "cell", text: "text" };

const isTypingTarget = (el) =>
  el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

/**
 * Logique de l'éditeur de surface : outils, interactions pointeur (coordonnées uv du t-shirt),
 * historique et raccourcis clavier.
 *
 * Un geste (trait, gomme, déplacement) appartient à UN pointeur : un second doigt est ignoré
 * tant que le premier n'est pas relevé, et l'historique est verrouillé pendant le geste.
 */
export default function useSurfaceEditor({ onLayerCreated } = {}) {
  const editor = useLayersEditor([]);
  const { preview, commit, undo, redo } = editor;
  const [tool, setTool] = useState("orbit");
  const [style, setStyle] = useState({ color: "#a40000", width: 10, size: 140, filled: true });
  const [selectedId, setSelectedId] = useState(null);

  // Références vers l'état courant (les gestionnaires pointeur restent stables pendant un trait).
  const layersRef = useRef(editor.layers);
  layersRef.current = editor.layers;
  const styleRef = useRef(style);
  styleRef.current = style;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const onLayerCreatedRef = useRef(onLayerCreated);
  onLayerCreatedRef.current = onLayerCreated;
  const gesture = useRef(null); // { kind, pointerId, from, current, id, lastUv, lastWorld }
  const frame = useRef(0);

  // Prévisualisation limitée à une mise à jour par image (la texture 1024 px est régénérée à chaque fois).
  const schedulePreview = useCallback(
    (layers) => {
      gesture.current.current = layers;
      if (frame.current) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = 0;
        if (gesture.current) preview(gesture.current.current);
      });
    },
    [preview]
  );

  const finishGesture = useCallback(() => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    if (g.current !== g.from) commit(g.current, g.from);
    else preview(g.from);
  }, [commit, preview]);

  const onSurfacePointer = useCallback(
    (phase, uv, e) => {
      const pointerId = e?.pointerId;
      const world = e?.point?.clone?.();
      const g = gesture.current;
      // Seul le pointeur qui a commencé le geste peut le poursuivre ou le terminer.
      if (g && pointerId !== undefined && g.pointerId !== pointerId) return;

      if (phase === "up") {
        finishGesture();
        return;
      }
      if (!uv) return;

      if (phase === "down") {
        if (g) return; // un geste est déjà en cours
        const current = toolRef.current;
        const s = styleRef.current;
        const layers = layersRef.current;
        if (current === "pen") {
          const path = createPathLayer(uv, s);
          gesture.current = { kind: "draw", pointerId, from: layers, current: [...layers, path], id: path.id, lastUv: uv, lastWorld: world };
          preview(gesture.current.current);
        } else if (current === "eraser") {
          gesture.current = { kind: "erase", pointerId, from: layers, current: layers };
          const hit = hitTest(layers, uv);
          if (hit) schedulePreview(layers.filter((l) => l.id !== hit.id));
        } else if (current === "select") {
          const hit = hitTest(layers, uv);
          setSelectedId(hit?.id ?? null);
          if (hit) gesture.current = { kind: "move", pointerId, from: layers, current: layers, id: hit.id, lastUv: uv, lastWorld: world };
        } else if (current === "text" || current.startsWith("shape:")) {
          const layer = current === "text" ? createTextLayer(uv, s) : createShapeLayer(current.slice(6), uv, s);
          commit([...layers, layer]);
          setSelectedId(layer.id);
          setTool("select");
          onLayerCreatedRef.current?.(layer);
        }
        return;
      }

      // phase === "move"
      if (!g) return;
      if (g.kind === "erase") {
        const hit = hitTest(g.current, uv);
        if (hit) schedulePreview(g.current.filter((l) => l.id !== hit.id));
        return;
      }
      const seam = isSeamJump(g.lastUv, uv, g.lastWorld, world);
      const du = uv.x - g.lastUv.x;
      const dv = uv.y - g.lastUv.y;
      g.lastUv = uv;
      g.lastWorld = world;
      if (g.kind === "draw") {
        const next = g.current.map((l) => (l.id === g.id ? { ...l, points: appendPoint(l.points, uv, { seam }) } : l));
        schedulePreview(next);
      } else if (g.kind === "move" && !seam) {
        // Une couture franchie téléporterait l'élément : on ignore ce pas-là.
        schedulePreview(g.current.map((l) => (l.id === g.id ? translateLayer(l, du, dv) : l)));
      }
    },
    [commit, preview, finishGesture, schedulePreview]
  );

  /** Abandonne le geste en cours (retour à son état de départ), sans toucher à l'historique. */
  const cancelGesture = useCallback(() => {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    cancelAnimationFrame(frame.current);
    frame.current = 0;
    preview(g.from);
  }, [preview]);

  // Relâchement hors du t-shirt : on termine quand même le geste (uniquement pour son pointeur).
  useEffect(() => {
    const onUp = (ev) => {
      const g = gesture.current;
      if (g && g.pointerId !== undefined && ev.pointerId !== g.pointerId) return;
      finishGesture();
    };
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [finishGesture]);

  // Annuler / rétablir verrouillés pendant un geste (sinon l'historique serait corrompu au relâchement).
  const safeUndo = useCallback(() => {
    if (!gesture.current) undo();
  }, [undo]);
  const safeRedo = useCallback(() => {
    if (!gesture.current) redo();
  }, [redo]);

  const updateLayer = useCallback(
    (id, patch) =>
      commit(
        layersRef.current.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        undefined,
        `${id}:${Object.keys(patch).sort().join(",")}`
      ),
    [commit]
  );

  const removeLayer = useCallback(
    (id) => {
      commit(layersRef.current.filter((l) => l.id !== id));
      setSelectedId((sel) => (sel === id ? null : sel));
    },
    [commit]
  );

  const clearLayers = useCallback(() => {
    commit([]);
    setSelectedId(null);
  }, [commit]);

  // Raccourcis clavier (ignorés pendant la saisie, dans un menu ou une fenêtre modale).
  useEffect(() => {
    const onKey = (e) => {
      if (
        isTypingTarget(e.target) ||
        e.target?.closest?.("[role=menu],[role=dialog]") ||
        document.querySelector("[role=dialog]")
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && (key === "z" || key === "y")) {
        e.preventDefault();
        if (key === "y" || e.shiftKey) safeRedo();
        else safeUndo();
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if ((key === "delete" || key === "backspace") && selectedId) {
        e.preventDefault();
        removeLayer(selectedId);
        return;
      }
      const map = { h: "orbit", escape: "orbit", v: "select", p: "pen", e: "eraser", t: "text", s: "shape:star" };
      if (map[key]) setTool(map[key]);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [safeUndo, safeRedo, removeLayer, selectedId]);

  // Si le calque sélectionné disparaît (annuler, gomme…), on oublie la sélection.
  useEffect(() => {
    if (selectedId && !editor.layers.some((l) => l.id === selectedId)) setSelectedId(null);
  }, [editor.layers, selectedId]);

  return {
    ...editor,
    undo: safeUndo,
    redo: safeRedo,
    tool,
    setTool,
    style,
    updateStyle: useCallback((patch) => setStyle((s) => ({ ...s, ...patch })), []),
    selectedId,
    setSelectedId,
    updateLayer,
    removeLayer,
    clearLayers,
    onSurfacePointer,
    cancelGesture,
    editing: tool !== "orbit",
    cursor: tool.startsWith("shape:") ? "copy" : CURSORS[tool],
  };
}
