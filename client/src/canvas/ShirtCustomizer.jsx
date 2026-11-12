import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ImagePlus, Layers, Sparkles, Trash2, Type } from "lucide-react";
import ShirtScene from "./ShirtScene";
import ViewToggle from "./ViewToggle";
import EditorToolbar from "./EditorToolbar";
import LayersPanel from "./LayersPanel";
import useSurfaceEditor from "./useSurfaceEditor";
import { sanitizeLayers } from "./utils/layers";
import font from "./utils/font";
import api, { getErrorMessage } from "../lib/api";
import { DEFAULT_IMAGE_POSITION, DEFAULT_TEXT_POSITION, normalizeShirt, PLACEMENTS } from "../lib/format";
import { cn } from "../lib/utils";
import { useToast } from "../context/ToastContext";
import { Button } from "../components/ui/button";
import { Field, Input, RangeField, Select, Textarea } from "../components/ui/form";
import { ConfirmModal, Modal } from "../components/ui/modal";
import StudioPanel from "./StudioPanel";
import TrimEditor from "./TrimEditor";
import { createTrimLayer } from "./utils/trims";
import { bestOnColor, contrastRatio } from "../studio/color";
import { newLayerId } from "./utils/layers";
import { textLayerFor } from "../studio/engine";
import { checkDesign } from "../studio/checker";

const TABS = [
  { id: "text", label: "Texte", icon: Type },
  { id: "image", label: "Image", icon: ImagePlus },
  { id: "layers", label: "Calques", icon: Layers },
  { id: "studio", label: "Studio", icon: Sparkles },
];

const PLACEMENT_OPTIONS = [
  { id: "chest", label: "Poitrine", view: "front" },
  { id: "belly", label: "Ventre", view: "front" },
  { id: "back", label: "Dos", view: "back" },
];

/** Raccourcis de placement : positionne l'élément sur une zone du t-shirt et tourne la vue. */
const PlacementPicker = ({ onPick }) => (
  <div>
    <p className="mb-1.5 text-sm font-medium text-foreground">Placement rapide</p>
    <div className="grid grid-cols-3 gap-2">
      {PLACEMENT_OPTIONS.map((opt) => (
        <Button key={opt.id} type="button" variant="outline" size="sm" onClick={() => onPick(PLACEMENTS[opt.id], opt.view)}>
          {opt.label}
        </Button>
      ))}
    </div>
  </div>
);

const ColorField = ({ label, value, onChange }) => (
  <Field label={label}>
    {(a11y) => (
      <div className="flex items-center gap-3">
        <input
          {...a11y}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 cursor-pointer rounded-[var(--radius-control)] border border-input bg-background p-1"
        />
        <span className="font-mono text-sm uppercase text-muted-foreground">{value}</span>
      </div>
    )}
  </Field>
);


const ShirtCustomizer = ({ saveRequest = 0, exportRequest = 0, newShirt, onDirtyChange }) => {
  const [activeTab, setActiveTab] = useState("text");
  const [view, setView] = useState("front");
  const { toast } = useToast();
  const [focusTextOf, setFocusTextOf] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);
  // Studio : la demande vit ici pour survivre aux changements d'onglet.
  const [studioRequest, setStudioRequest] = useState({
    prompt: "",
    text: "",
    draft: { prompt: "", text: "" }, // saisie en cours (conservée en changeant d'onglet)
    styleId: null,
    placement: null,
    seed: 1,
    submitted: false,
    aiEnabled: null, // null = automatique : active si l'IA du serveur existe, sinon à activer (IA du navigateur)
    brief: null, // dernière réponse de l'IA (réutilisée pour les variantes)
    aiError: null,
    pending: null, // génération IA en cours : { startedAt, controller }
  });
  const [pendingDesign, setPendingDesign] = useState(null);
  // Quitter l'éditeur pendant que l'IA réfléchit : on arrête la génération (sinon le GPU continue pour rien).
  const studioPendingRef = useRef(null);
  studioPendingRef.current = studioRequest.pending;
  useEffect(() => () => studioPendingRef.current?.controller.abort(), []);
  /*
   * Couleur du t-shirt liée aux états des calques : appliquer une proposition change les deux.
   * L'historique conserve les mêmes références de tableaux, donc Annuler/Rétablir retrouve la couleur.
   */
  const shirtColorByLayers = useRef(new WeakMap());
  // Éditeur de surface : stylo, formes, textes posés directement sur le t-shirt 3D.
  const editor = useSurfaceEditor({
    onLayerCreated: (layer) => {
      setActiveTab("layers");
      setFocusTextOf(layer.type === "text" ? layer.id : null);
    },
  });
  const { reset: resetLayers, setSelectedId } = editor;
  // Bordures (col, manches, bas) : un seul calque « trim », réglé dans l'onglet Image ou Calques.
  const trimLayer = editor.layers.find((l) => l.type === "trim") ?? null;
  // États pour la personnalisation du texte
  const [textColor, setTextColor] = useState("#000000");
  const [textSize, setTextSize] = useState(48);
  const [position, setPosition] = useState(DEFAULT_TEXT_POSITION);
  const [rotation, setRotation] = useState(0);
  const [customText, setCustomText] = useState("");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [tshirtColor, setTshirtColor] = useState("#ffffff");

  // États pour l'image : `image` = fichier à envoyer, `currentImage` = source affichée
  const [image, setImage] = useState(null);
  const [currentImage, setCurrentImage] = useState(null);
  const [imageRemoved, setImageRemoved] = useState(false);
  const [imageScale, setImageScale] = useState(0.4);
  const [imagePosition, setImagePosition] = useState(DEFAULT_IMAGE_POSITION);
  const [imageRotation, setImageRotation] = useState(0);

  // État pour les détails du t-shirt
  const [shirtDetails, setShirtDetails] = useState({
    name: "",
    description: "",
    price: 0,
    stock: 0,
  });

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showSaveModal, setShowSaveModal] = useState(false);
  const canvasContainerRef = useRef(null);
  const navigate = useNavigate();
  const isEditing = Boolean(newShirt?.id);

  /*
   * Modifications non enregistrées : on compare un instantané de l'état à celui pris au chargement.
   * (L'image affichée n'en fait pas partie : elle se charge en différé ; seules les actions
   * « importer » / « retirer » comptent.)
   */
  const snapshot = useMemo(
    () =>
      JSON.stringify([
        shirtDetails, textColor, textSize, position, rotation, customText, fontFamily,
        tshirtColor, imageScale, imagePosition, imageRotation, editor.layers,
      ]),
    [shirtDetails, textColor, textSize, position, rotation, customText, fontFamily, tshirtColor, imageScale, imagePosition, imageRotation, editor.layers]
  );
  const [baseline, setBaseline] = useState(null);
  const needsBaseline = useRef(true);
  const saved = useRef(false);
  useEffect(() => {
    if (needsBaseline.current) {
      needsBaseline.current = false;
      setBaseline(snapshot);
    }
  }, [snapshot]);
  const dirty =
    !saved.current && baseline !== null && (snapshot !== baseline || image instanceof File || imageRemoved);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const buildFormData = () => {
    const formData = new FormData();
    formData.append("name", shirtDetails.name.trim());
    formData.append("description", shirtDetails.description);
    formData.append("price", shirtDetails.price);
    formData.append("stock", shirtDetails.stock);
    formData.append("text_color", textColor);
    formData.append("text_size", textSize);
    formData.append("position", JSON.stringify(position));
    formData.append("rotation", JSON.stringify(rotation));
    formData.append("custom_text", customText);
    formData.append("font_family", fontFamily);
    formData.append("shirt_color", tshirtColor);
    formData.append("image_scale", JSON.stringify(imageScale));
    formData.append("image_position", JSON.stringify(imagePosition));
    formData.append("image_rotation", JSON.stringify(imageRotation));
    formData.append("layers", JSON.stringify(editor.layers));

    if (image instanceof File) {
      formData.append("image", image);
    } else if (imageRemoved) {
      formData.append("image", ""); // vide = suppression de l'image côté serveur
    }
    return formData;
  };

  // Chargement d'un t-shirt existant (mode édition)
  useEffect(() => {
    if (!newShirt?.id) return;
    const shirt = normalizeShirt(newShirt);
    setShirtDetails({
      name: shirt.name ?? "",
      description: shirt.description ?? "",
      price: Number(shirt.price) || 0,
      stock: Number(shirt.stock) || 0,
    });
    setTextColor(shirt.text_color ?? "#000000");
    setTextSize(shirt.text_size ?? 48);
    setPosition(shirt.position);
    setRotation(shirt.rotation);
    setCustomText(shirt.custom_text ?? "");
    setFontFamily(shirt.font_family ?? "Arial");
    setTshirtColor(shirt.shirt_color ?? "#ffffff");
    setImageScale(shirt.image_scale);
    setImagePosition(shirt.image_position);
    setImageRotation(shirt.image_rotation);
    setImage(null);
    setImageRemoved(false);
    resetLayers(sanitizeLayers(shirt.layers));
    setSelectedId(null);
    needsBaseline.current = true; // le prochain instantané (état chargé) devient la référence

    if (!shirt.image) {
      setCurrentImage(null);
      return;
    }
    // Conversion en data URL pour pouvoir dessiner l'image dans le canvas (cross-origin)
    const controller = new AbortController();
    fetch(shirt.image, { signal: controller.signal })
      .then((response) => response.blob())
      .then((blob) => {
        const reader = new FileReader();
        reader.onloadend = () => setCurrentImage(reader.result);
        reader.readAsDataURL(blob);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          console.error("Erreur lors du chargement de l'image :", error);
        }
      });
    return () => controller.abort();
  }, [newShirt, resetLayers, setSelectedId]);

  // Le bouton « Enregistrer » de la barre de navigation incrémente saveRequest.
  // On ne réagit qu'aux clics postérieurs au montage (le composant est remonté à chaque t-shirt).
  const mountedSave = useRef(saveRequest);
  const mountedExport = useRef(exportRequest);
  useEffect(() => {
    if (saveRequest > mountedSave.current) {
      setSaveError("");
      setShowSaveModal(true);
    }
  }, [saveRequest]);

  // Le bouton « Exporter » télécharge un aperçu PNG du rendu 3D.
  useEffect(() => {
    if (exportRequest <= mountedExport.current) return;
    // On retire le cadre de sélection, on attend le rendu suivant, puis on capture.
    setSelectedId(null);
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => {
        const canvas = canvasContainerRef.current?.querySelector("canvas");
        if (!canvas) return;
        const link = document.createElement("a");
        const safeName = (shirtDetails.name || "mon-tshirt").replace(/[^a-z0-9-_]+/gi, "-");
        link.download = `${safeName}.png`;
        link.href = canvas.toDataURL("image/png");
        link.click();
        toast({ title: "Image exportée", description: link.download, variant: "info" });
      });
    });
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportRequest]);

  const validate = () => {
    if (!shirtDetails.name.trim()) return "Le nom du projet est requis.";
    if (!(shirtDetails.price >= 0)) return "Le prix doit être positif ou nul.";
    if (!Number.isInteger(shirtDetails.stock) || shirtDetails.stock < 0) {
      return "Le stock doit être un entier positif ou nul.";
    }
    return null;
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setSaveError(validationError);
      return;
    }
    setSaving(true);
    setSaveError("");
    try {
      const formData = buildFormData();
      if (isEditing) {
        await api.patch(`/shirts/${newShirt.id}/`, formData);
      } else {
        await api.post("/shirts/", formData);
      }
      setShowSaveModal(false);
      saved.current = true;
      onDirtyChange?.(false);
      toast({ title: isEditing ? "Modifications enregistrées" : "T-shirt enregistré", description: shirtDetails.name });
      navigate("/archive");
    } catch (err) {
      console.error("Erreur lors de l'enregistrement :", err);
      setSaveError(getErrorMessage(err, "Une erreur est survenue lors de l'enregistrement."));
    } finally {
      setSaving(false);
    }
  };

  const handleImageImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg";
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      setImage(file); // Fichier envoyé au serveur
      setImageRemoved(false);
      const reader = new FileReader();
      reader.onload = (event) => setCurrentImage(event.target.result); // Aperçu
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleImageRemove = () => {
    setImage(null);
    setCurrentImage(null);
    setImageRemoved(true);
  };

  // ---- Studio : appliquer une proposition / une variante, ajouter un slogan
  const applyDesign = (proposal, { keepView = false } = {}) => {
    editor.cancelGesture(); // un glisser en cours écraserait le design appliqué à son relâchement
    // Nouveaux identifiants : une proposition peut être appliquée plusieurs fois.
    const next = proposal.layers.map((l) => ({ ...l, id: newLayerId() }));
    shirtColorByLayers.current.set(editor.layers, tshirtColor);
    shirtColorByLayers.current.set(next, proposal.shirtColor);
    editor.commit(next);
    setTshirtColor(proposal.shirtColor);
    if (!keepView && proposal.view) setView(proposal.view);
    setSelectedId(null);
    toast({ title: "Design appliqué", description: "Modifiable dans l'onglet Calques · Ctrl+Z pour revenir en arrière." });
  };
  const requestApply = (proposal, options) => {
    // Une variante recolore le design courant : pas de confirmation. Une proposition le remplace.
    const hasContent = editor.layers.length > 0 || customText.trim() !== "" || Boolean(currentImage);
    if (!options?.keepView && hasContent) setPendingDesign({ proposal, options });
    else applyDesign(proposal, options);
  };
  const addSlogan = (text, placement) => {
    // Le texte principal (onglet Texte) compte aussi comme obstacle.
    const mainText = customText.trim()
      ? [{ id: "__main", type: "text", text: customText, x: position.x, y: position.y, size: textSize, font: fontFamily, rotation }]
      : [];
    const layer = textLayerFor(text, {
      shirtColor: tshirtColor,
      placement,
      id: newLayerId(),
      existing: [...editor.layers, ...mainText],
    });
    editor.commit([...editor.layers, layer]);
    setSelectedId(layer.id);
    setView(placement);
    setActiveTab("layers");
    toast({ title: "Slogan ajouté", description: text });
  };
  const selectLayerFromCheck = (id) => {
    const layer = editor.layers.find((l) => l.id === id);
    if (!layer) return;
    setSelectedId(id);
    // Les calques au-delà de u = 0.5 sont dans le dos (voir PRINT_ZONES).
    const u = layer.type === "path" ? layer.points.find(Boolean)?.[0] ?? 0 : layer.x;
    setView(u > 0.5 ? "back" : "front");
    setActiveTab("layers");
  };
  // Annuler/Rétablir : on retrouve la couleur du t-shirt associée à l'état des calques.
  useEffect(() => {
    const color = shirtColorByLayers.current.get(editor.layers);
    if (color) setTshirtColor(color);
  }, [editor.layers]);

  const checkInput = useMemo(
    () => ({
      shirtColor: tshirtColor,
      layers: editor.layers,
      mainText: { text: customText, color: textColor, size: textSize, position, font: fontFamily, rotation },
      hasImage: Boolean(currentImage),
      imagePosition,
    }),
    [tshirtColor, editor.layers, customText, textColor, textSize, position, fontFamily, rotation, currentImage, imagePosition]
  );
  const saveIssues = useMemo(
    () => (showSaveModal ? checkDesign(checkInput).filter((i) => i.level !== "info") : []),
    [showSaveModal, checkInput]
  );

  const design = {
    text: customText,
    textColor,
    textSize,
    textPosition: position,
    textRotation: rotation,
    image: currentImage,
    fontFamily,
    imageScale,
    imagePosition,
    imageRotation,
    tshirtColor,
    layers: editor.layers,
    selectedId: editor.selectedId,
  };

  return (
    <div className="flex h-full w-full flex-col lg:flex-row">
      {/* Aperçu 3D : en haut sur mobile, à gauche sur desktop */}
      <section
        ref={canvasContainerRef}
        aria-label="Aperçu 3D du t-shirt"
        className="relative h-[45vh] w-full shrink-0 bg-muted lg:h-full lg:flex-1"
      >
        <ShirtScene
          design={design}
          view={view}
          preserveDrawingBuffer
          className="h-full w-full"
          editing={editor.editing}
          cursor={editor.cursor}
          onSurfacePointer={editor.onSurfacePointer}
        />
        <ViewToggle value={view} onChange={setView} className="absolute left-3 top-3" />
        <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
          <EditorToolbar
            tool={editor.tool}
            onToolChange={editor.setTool}
            style={editor.style}
            onStyleChange={editor.updateStyle}
            canUndo={editor.canUndo}
            canRedo={editor.canRedo}
            onUndo={editor.undo}
            onRedo={editor.redo}
            onClear={() => setConfirmClear(true)}
            hasLayers={editor.layers.length > 0}
          />
        </div>
      </section>

      {/* Panneau de contrôle */}
      <aside className="flex min-h-0 w-full flex-1 flex-col border-border bg-background lg:w-[400px] lg:flex-none lg:border-l">
        <div role="tablist" aria-label="Outils de personnalisation" className="flex shrink-0 border-b border-border">
          {TABS.map(({ id, label, icon }) => {
            const Icon = icon;
            return (
            <button
              key={id}
              id={`tab-${id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls={`panel-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => setActiveTab(id)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                const index = TABS.findIndex((t) => t.id === activeTab);
                const next = TABS[(index + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
                setActiveTab(next.id);
                document.getElementById(`tab-${next.id}`)?.focus();
              }}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-medium transition-colors",
                activeTab === id
                  ? "border-brand text-brand-ink"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
              {label}
            </button>
            );
          })}
        </div>

        <div
          id={`panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`tab-${activeTab}`}
          data-lenis-prevent
          className="flex-1 space-y-5 overflow-y-auto p-5"
        >
          {activeTab === "text" && (
            <>
              <Field label="Texte">
                {(a11y) => (
                  <Input
                    {...a11y}
                    value={customText}
                    placeholder="Votre texte"
                    onChange={(e) => setCustomText(e.target.value)}
                  />
                )}
              </Field>
              <Field label="Police">
                {(a11y) => (
                  <Select {...a11y} value={fontFamily} onChange={(e) => setFontFamily(e.target.value)}>
                    {font.map((f) => (
                      <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                        {f.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <ColorField label="Couleur du texte" value={textColor} onChange={setTextColor} />
              <PlacementPicker
                onPick={(pos, nextView) => {
                  setPosition(pos);
                  setView(nextView);
                }}
              />
              <RangeField label="Taille" value={textSize} display={`${textSize} px`} min={12} max={100} onChange={setTextSize} />
              <div className="grid grid-cols-2 gap-4">
                <RangeField
                  label="Position X"
                  value={position.x}
                  display={position.x.toFixed(2)}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(x) => setPosition({ ...position, x })}
                />
                <RangeField
                  label="Position Y"
                  value={position.y}
                  display={position.y.toFixed(2)}
                  min={0}
                  max={1}
                  step={0.01}
                  onChange={(y) => setPosition({ ...position, y })}
                />
              </div>
              <RangeField label="Rotation" value={rotation} display={`${rotation}°`} min={-180} max={180} onChange={setRotation} />
            </>
          )}

          {activeTab === "image" && (
            <>
              <div className="flex flex-col gap-2">
                <Button onClick={handleImageImport} className="w-full">
                  <ImagePlus /> {currentImage ? "Remplacer l'image" : "Importer une image"}
                </Button>
                {currentImage && (
                  <Button variant="outline" onClick={handleImageRemove} className="w-full">
                    <Trash2 /> Retirer l'image
                  </Button>
                )}
                <p className="text-xs text-muted-foreground">PNG ou JPEG.</p>
              </div>
              {currentImage && (
                <>
                  <PlacementPicker
                    onPick={(pos, nextView) => {
                      setImagePosition(pos);
                      setView(nextView);
                    }}
                  />
                  <RangeField
                    label="Taille de l'image"
                    value={imageScale}
                    display={imageScale.toFixed(2)}
                    min={0.2}
                    max={2}
                    step={0.01}
                    onChange={setImageScale}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <RangeField
                      label="Position X"
                      value={imagePosition.x}
                      display={imagePosition.x.toFixed(2)}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(x) => setImagePosition({ ...imagePosition, x })}
                    />
                    <RangeField
                      label="Position Y"
                      value={imagePosition.y}
                      display={imagePosition.y.toFixed(2)}
                      min={0}
                      max={1}
                      step={0.01}
                      onChange={(y) => setImagePosition({ ...imagePosition, y })}
                    />
                  </div>
                  <RangeField
                    label="Rotation de l'image"
                    value={imageRotation}
                    display={`${imageRotation}°`}
                    min={-180}
                    max={180}
                    onChange={setImageRotation}
                  />
                </>
              )}
              <div className="border-t border-border pt-5">
                <ColorField label="Couleur du t-shirt" value={tshirtColor} onChange={setTshirtColor} />
              </div>
              <div className="border-t border-border pt-5">
                <TrimEditor
                  trim={trimLayer}
                  onChange={(patch) => {
                    if (trimLayer) editor.updateLayer(trimLayer.id, patch);
                    else {
                      // Première bordure : couleur bien visible sur le t-shirt.
                      const color = contrastRatio("#a40000", tshirtColor) >= 3 ? "#a40000" : bestOnColor(tshirtColor);
                      editor.commit([createTrimLayer({ id: newLayerId(), color, color2: tshirtColor, ...patch }), ...editor.layers]);
                    }
                  }}
                  onRemove={() => trimLayer && editor.removeLayer(trimLayer.id)}
                />
              </div>
            </>
          )}

          {activeTab === "layers" && <LayersPanel editor={editor} focusTextOf={focusTextOf} onFocused={() => setFocusTextOf(null)} />}

          {activeTab === "studio" && (
            <StudioPanel
              request={studioRequest}
              setRequest={setStudioRequest}
              layers={editor.layers}
              shirtColor={tshirtColor}
              checkInput={checkInput}
              onApplyDesign={requestApply}
              onAddSlogan={addSlogan}
              onSelectLayer={selectLayerFromCheck}
            />
          )}
        </div>
      </aside>

      <ConfirmModal
        open={Boolean(pendingDesign)}
        onOpenChange={(open) => !open && setPendingDesign(null)}
        title="Remplacer votre design ?"
        description="Les éléments actuels seront remplacés par la proposition. Vous pourrez revenir en arrière avec Annuler (Ctrl+Z)."
        confirmLabel="Remplacer"
        onConfirm={() => {
          applyDesign(pendingDesign.proposal, pendingDesign.options);
          setPendingDesign(null);
        }}
      />

      <ConfirmModal
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Tout effacer ?"
        description="Tous les traits, formes et textes ajoutés seront supprimés. Vous pourrez revenir en arrière avec le bouton Annuler (Ctrl+Z)."
        confirmLabel="Tout effacer"
        destructive
        onConfirm={() => {
          editor.clearLayers();
          setConfirmClear(false);
        }}
      />

      {/* Fenêtre d'enregistrement */}
      <Modal
        open={showSaveModal}
        onOpenChange={setShowSaveModal}
        title={isEditing ? "Modifier le projet" : "Enregistrer le projet"}
        description="Ces informations seront affichées dans la boutique."
      >
        <form className="space-y-4" onSubmit={handleSave} noValidate>
          <Field label="Nom du projet">
            {(a11y) => (
              <Input
                {...a11y}
                required
                autoFocus
                value={shirtDetails.name}
                onChange={(e) => setShirtDetails({ ...shirtDetails, name: e.target.value })}
              />
            )}
          </Field>
          <Field label="Description">
            {(a11y) => (
              <Textarea
                {...a11y}
                rows={3}
                value={shirtDetails.description}
                onChange={(e) => setShirtDetails({ ...shirtDetails, description: e.target.value })}
              />
            )}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Prix (€)">
              {(a11y) => (
                <Input
                  {...a11y}
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  value={shirtDetails.price}
                  onChange={(e) => setShirtDetails({ ...shirtDetails, price: parseFloat(e.target.value) || 0 })}
                />
              )}
            </Field>
            <Field label="Stock">
              {(a11y) => (
                <Input
                  {...a11y}
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={shirtDetails.stock}
                  onChange={(e) => setShirtDetails({ ...shirtDetails, stock: parseInt(e.target.value, 10) || 0 })}
                />
              )}
            </Field>
          </div>
          {saveIssues.length > 0 && (
            <div className="rounded-[var(--radius-control)] bg-warning-soft p-3 text-sm text-warning" role="status">
              <p className="font-medium">
                {saveIssues.length} point{saveIssues.length > 1 ? "s" : ""} à vérifier avant impression
              </p>
              <ul className="mt-1 list-disc space-y-0.5 pl-5">
                {saveIssues.slice(0, 3).map((issue, i) => (
                  <li key={i}>{issue.message}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs">Vous pouvez enregistrer quand même (détails dans l'onglet Studio).</p>
            </div>
          )}
          {saveError && (
            <p className="rounded-[var(--radius-control)] bg-brand-soft p-3 text-sm text-destructive" role="alert">
              {saveError}
            </p>
          )}
          <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setShowSaveModal(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ShirtCustomizer;
