import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, Palette, RefreshCw, Sparkles, Type, Wand2, XCircle } from "lucide-react";
import ShirtPreview from "../components/ShirtPreview";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/feedback";
import { Field, Input, Textarea } from "../components/ui/form";
import { cn } from "../lib/utils";
import { STYLES } from "../studio/catalog";
import { checkDesign } from "../studio/checker";
import { clipText, colorVariants, generateProposals, parsePrompt, suggestSlogans } from "../studio/engine";
import LocalAICard from "../ai/LocalAICard";
import useLocalAI from "../ai/useLocalAI";
import { generateBrief } from "../ai/localAI";
import { proposalsFromBrief } from "../ai/fromBrief";
import { THEMES } from "../studio/catalog";
import { illustrationKeywords, loadIllustrations, searchIllustrations } from "../studio/illustrations";
import { useToast } from "../context/ToastContext";

const PLACEMENTS = [
  { id: null, label: "Auto" },
  { id: "front", label: "Poitrine" },
  { id: "back", label: "Dos" },
];

const EXAMPLES = [
  "Logo rétro pour un club de surf, tons orangés, texte « Les Vagues »",
  "T-shirt noir gamer néon",
  "Cadeau pour maman, cœur rose pastel",
  "Streetwear minimaliste, texte « Paris 2026 » dans le dos",
];

/** Petit groupe de boutons radio (style, emplacement). */
const ChoiceGroup = ({ label, options, value, onChange }) => (
  <div>
    <p className="mb-1.5 text-sm font-medium">{label}</p>
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={String(opt.id)}
          type="button"
          role="radio"
          aria-checked={value === opt.id}
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition-colors",
            value === opt.id ? "border-brand bg-brand text-white" : "border-input hover:border-brand"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
);

/** Carte d'une proposition ou d'une variante : aperçu rendu + bouton Appliquer. */
const DesignCard = ({ design, title, subtitle, onApply }) => {
  // Objet « t-shirt » minimal pour le générateur d'aperçus.
  const shirt = useMemo(
    () => ({ id: design.id, name: title, shirt_color: design.shirtColor, layers: design.layers, custom_text: "", image: null }),
    [design, title]
  );
  return (
    <li className="overflow-hidden rounded-[var(--radius-card)] border border-border">
      <div className="aspect-square bg-muted">
        <ShirtPreview shirt={shirt} view={design.view ?? "front"} className="h-full w-full" />
      </div>
      <div className="flex items-center justify-between gap-2 p-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium" title={title}>
            {title}
          </p>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        <Button size="sm" onClick={() => onApply(design)} aria-label={`Appliquer : ${title}`}>
          Appliquer
        </Button>
      </div>
    </li>
  );
};

const ISSUE_ICON = { error: XCircle, warning: AlertTriangle, info: Info };
const ISSUE_TONE = { error: "text-destructive", warning: "text-warning", info: "text-info" };

const Section = ({ icon, title, children, aside }) => {
  const Icon = icon;
  return (
    <section className="space-y-3 border-b border-border pb-6 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-display text-lg">
          <Icon className="size-5 text-brand-ink" aria-hidden="true" />
          {title}
        </h3>
        {aside}
      </div>
      {children}
    </section>
  );
};

/**
 * Onglet « Studio » : générateur de designs, slogans, variantes de couleurs et vérification.
 * Tout est calculé localement (aucune IA distante, aucun coût).
 *
 * `request` / `setRequest` vivent dans le parent pour survivre aux changements d'onglet.
 */
const StudioPanel = ({ request, setRequest, layers, shirtColor, checkInput, onApplyDesign, onAddSlogan, onSelectLayer }) => {
  const draft = request.draft;
  const setDraft = (update) => setRequest((r) => ({ ...r, draft: update(r.draft) }));
  const [sloganSeed, setSloganSeed] = useState(1);
  // Instantané du design au moment du clic : pas de recalcul (ni de rendus d'aperçus) à chaque modification.
  const [variantSource, setVariantSource] = useState(null);
  const { toast } = useToast();
  const ai = useLocalAI();
  const aiReady = ai.status === "ready" || ai.status === "generating";
  // L'IA du serveur est utilisée d'office ; celle du navigateur seulement si l'utilisateur l'a activée.
  const aiOn = request.aiEnabled ?? ai.engine === "server";
  const useAI = aiOn && aiReady;
  const pending = request.pending;
  // Bibliothèque d'illustrations (≈ 10 Mo) préchargée dès que l'IA est prête : la recherche est alors instantanée.
  useEffect(() => {
    if (aiReady) loadIllustrations().catch(() => {});
  }, [aiReady]);
  // Focus : sur « Annuler » pendant la réflexion, puis retour au bouton principal.
  const cancelRef = useRef(null);
  const submitRef = useRef(null);
  const hadPending = useRef(false);
  useEffect(() => {
    if (pending) cancelRef.current?.focus();
    else if (hadPending.current && cancelRef.current === null) submitRef.current?.focus();
    hadPending.current = Boolean(pending);
  }, [pending]);
  // Chrono affiché pendant que l'IA réfléchit.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!pending) return;
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, [pending]);

  const proposals = useMemo(() => {
    if (!request.submitted) return [];
    const options = { seed: request.seed, year: new Date().getFullYear() };
    // Brief de l'IA s'il existe, sinon générateur par mots-clés (mêmes mises en page dans les deux cas).
    return request.brief
      ? proposalsFromBrief(request.brief, { prompt: request.prompt, text: request.text, styleId: request.styleId, placement: request.placement, ...options })
      : generateProposals({ prompt: request.prompt, styleId: request.styleId, placement: request.placement, text: request.text }, options);
    // Seuls ces champs influencent les propositions (pas `pending`, ni l'état de l'IA).
  }, [request.submitted, request.brief, request.prompt, request.text, request.styleId, request.placement, request.seed]);
  const parsed = useMemo(() => parsePrompt(request.prompt), [request.prompt]);
  const slogans = useMemo(() => suggestSlogans(draft.prompt, { seed: sloganSeed }), [draft.prompt, sloganSeed]);
  const variants = useMemo(
    () => (variantSource?.layers.length ? colorVariants(variantSource).map((v) => ({ ...v, id: `v-${v.id}` })) : []),
    [variantSource]
  );
  const variantsOutdated = Boolean(variantSource) && (variantSource.layers !== layers || variantSource.shirtColor !== shirtColor);
  const issues = useMemo(() => checkDesign(checkInput), [checkInput]);

  const generate = async (e, { forceAI = false } = {}) => {
    e?.preventDefault?.();
    if (pending) return;
    const prompt = draft.prompt.trim();
    const text = draft.text.trim();
    const sameInput = request.submitted && prompt === request.prompt && text === request.text;

    // Même demande déjà comprise par l'IA : nouvelles variantes instantanées, sans rappeler le modèle.
    if (!useAI || (sameInput && request.brief && !forceAI)) {
      setRequest((r) => ({
        ...r,
        prompt,
        text,
        brief: useAI && sameInput ? r.brief : null,
        aiError: null,
        seed: r.submitted ? r.seed + 1 : r.seed,
        submitted: true,
      }));
      return;
    }

    const controller = new AbortController();
    setRequest((r) => ({ ...r, pending: { startedAt: Date.now(), controller }, aiError: null }));
    try {
      const { brief: raw } = await generateBrief(prompt || "Un t-shirt original et tendance", { text, signal: controller.signal });
      // L'IA a décrit le dessin voulu : on cherche les illustrations correspondantes.
      let illustrations = [];
      // Sujets nommés dans la demande d'abord (« dragon »), puis la description de l'IA.
      const keywords = illustrationKeywords(prompt, raw.illustration);
      try {
        if (keywords.length) illustrations = await searchIllustrations(keywords, { limit: 6 });
      } catch {
        /* bibliothèque indisponible (hors ligne) : motifs du thème */
      }
      if (controller.signal.aborted) throw new DOMException("Génération annulée", "AbortError");
      const brief = { ...raw, illustration: keywords, illustrations };
      setRequest((r) => ({ ...r, prompt, text, brief, seed: 1, submitted: true, pending: null }));
    } catch (err) {
      if (controller.signal.aborted) {
        setRequest((r) => ({ ...r, pending: null }));
        return;
      }
      // Repli : le générateur intégré prend le relais, et on le dit.
      const message = err?.message ?? "erreur inconnue";
      setRequest((r) => ({ ...r, prompt, text, brief: null, aiError: message, seed: r.submitted ? r.seed + 1 : 1, submitted: true, pending: null }));
      toast({ title: "L'IA n'a pas pu répondre", description: `${message} Propositions du générateur intégré.`, variant: "error", duration: 6000 });
    }
  };
  const sameAsSubmitted = request.submitted && draft.prompt.trim() === request.prompt && draft.text.trim() === request.text;
  // Pastilles = couleurs réellement imprimées (après correction du contraste), pas les souhaits bruts du modèle.
  const printedPalette = proposals[0]?.params?.palette;
  const textClipped = Boolean(request.brief) && Boolean(request.text) && clipText(request.text).truncated;
  // Licences : la source des illustrations de bibliothèque est citée (game-icons.net : CC BY 3.0).
  const credits = [...new Set(proposals.flatMap((p) => p.layers.map((l) => l.credit).filter(Boolean)))];
  const briefTheme = request.brief ? THEMES.find((t) => t.id === request.brief.theme) : null;
  const briefStyle = request.brief ? STYLES.find((s) => s.id === request.brief.style) : null;

  return (
    <div className="space-y-6">
      <LocalAICard enabled={aiOn} onEnabledChange={(aiEnabled) => setRequest((r) => ({ ...r, aiEnabled }))} />
      <p className="rounded-[var(--radius-control)] bg-muted p-3 text-xs text-muted-foreground">
        Sans IA, le générateur intégré répond instantanément. Dans les deux cas, chaque proposition devient des
        éléments modifiables dans l'onglet Calques.
      </p>

      {/* 1. Générateur */}
      <Section icon={Wand2} title="Décris ton design">
        <form onSubmit={generate} className="space-y-4">
          <Field label="Votre idée" hint="Thème, ambiance, couleurs… Mettez entre guillemets le texte à afficher.">
            {(a11y) => (
              <Textarea
                {...a11y}
                rows={3}
                value={draft.prompt}
                placeholder={EXAMPLES[0]}
                onChange={(e) => setDraft((d) => ({ ...d, prompt: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) generate(e);
                }}
              />
            )}
          </Field>
          <div className="flex flex-wrap gap-1.5" aria-label="Exemples">
            {EXAMPLES.slice(1).map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => setDraft((d) => ({ ...d, prompt: ex }))}
                className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {ex}
              </button>
            ))}
          </div>
          <Field label="Texte à afficher (facultatif)">
            {(a11y) => (
              <Input
                {...a11y}
                maxLength={40}
                value={draft.text}
                placeholder="Ex. : Les Vagues"
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              />
            )}
          </Field>
          <ChoiceGroup
            label="Style"
            options={[{ id: null, label: "Auto" }, ...STYLES.map((s) => ({ id: s.id, label: s.label }))]}
            value={request.styleId}
            onChange={(styleId) => setRequest((r) => ({ ...r, styleId }))}
          />
          <ChoiceGroup
            label="Emplacement"
            options={PLACEMENTS}
            value={request.placement}
            onChange={(placement) => setRequest((r) => ({ ...r, placement }))}
          />
          {pending ? (
            <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-border bg-muted p-3" role="status" aria-live="polite">
              <Sparkles className="size-5 shrink-0 animate-pulse text-brand-ink" aria-hidden="true" />
              <span className="flex-1 text-sm">
                L'IA réfléchit… <span className="tabular-nums text-muted-foreground">{Math.max(0, Math.round((now - pending.startedAt) / 1000))} s</span>
              </span>
              <Button ref={cancelRef} type="button" variant="outline" size="sm" onClick={() => pending.controller.abort()}>
                Annuler
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <Button ref={submitRef} type="submit" className="w-full">
                <Sparkles />{" "}
                {useAI
                  ? request.brief && sameAsSubmitted
                    ? "Nouvelles variantes"
                    : "Demander à l'IA"
                  : request.submitted
                    ? "Nouvelles propositions"
                    : "Générer 3 propositions"}
              </Button>
              {request.brief && useAI && sameAsSubmitted && (
                <Button type="button" variant="outline" className="w-full" onClick={(e) => generate(e, { forceAI: true })}>
                  Nouvelle idée de l'IA
                </Button>
              )}
            </div>
          )}
        </form>

        {request.submitted && (
          <>
            {request.brief ? (
              <div className="space-y-1.5 rounded-[var(--radius-control)] bg-brand-soft p-3 text-xs" aria-live="polite">
                <p className="flex items-center gap-1.5 font-medium text-brand-ink">
                  <Sparkles className="size-3.5" aria-hidden="true" /> Proposé par l'IA
                </p>
                {request.brief.summary && <p className="text-foreground">{request.brief.summary}</p>}
                {request.brief.illustration?.length > 0 && (
                  <p className="text-muted-foreground">
                    Dessin : {request.brief.illustration.join(", ")}
                    {request.brief.illustrations?.length ? "" : " (aucune illustration trouvée, motifs du thème)"}
                  </p>
                )}
                <div className="flex flex-wrap items-center gap-1.5">
                  {briefTheme && <Badge tone="brand">{briefTheme.label}</Badge>}
                  {briefStyle && <Badge tone="info">{briefStyle.label}</Badge>}
                  {parsed.writing && <Badge tone="info">Écriture : {parsed.writing.label}</Badge>}
                  {printedPalette &&
                    [...new Set([printedPalette.shirt, printedPalette.primary, printedPalette.secondary])].map((c) => (
                      <span key={c} className="size-4 rounded-full border border-border" style={{ backgroundColor: c }} title={c} />
                    ))}
                </div>
                {textClipped && (
                  <p className="text-warning" role="status">
                    Votre texte a été raccourci pour tenir sur le t-shirt.
                  </p>
                )}
              </div>
            ) : (
            <>
            {request.aiError && (
              <p className="text-xs text-warning" role="status">
                L'IA n'a pas pu répondre ({request.aiError}) : propositions du générateur intégré.
              </p>
            )}
            <div className="flex flex-wrap items-center gap-1.5 text-xs" aria-live="polite">
              <span className="text-muted-foreground">Compris :</span>
              <Badge tone={parsed.themeDetected ? "brand" : "neutral"}>{parsed.theme.label}</Badge>
              {parsed.style && <Badge tone="info">{parsed.style.label}</Badge>}
              {parsed.writing && <Badge tone="info">Écriture : {parsed.writing.label}</Badge>}
              {parsed.colors.map((c) => (
                <span key={c} className="size-4 rounded-full border border-border" style={{ backgroundColor: c }} title={c} />
              ))}
              {parsed.text && <Badge>« {parsed.text} »</Badge>}
            </div>
            {parsed.textTruncated && (
              <p className="text-xs text-warning" role="status">
                Votre texte a été raccourci à 40 caractères pour tenir sur le t-shirt.
              </p>
            )}
            </>
            )}
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-1" aria-label="Propositions">
              {proposals.map((p) => (
                <DesignCard
                  key={p.id}
                  design={p}
                  title={p.title}
                  subtitle={p.source === "ai" ? "Idée de l'IA" : p.themeLabel}
                  onApply={onApplyDesign}
                />
              ))}
            </ul>
            {credits.length > 0 && <p className="text-xs text-muted-foreground">Illustrations : {credits.join(" · ")}</p>}
          </>
        )}
      </Section>

      {/* 2. Slogans */}
      <Section
        icon={Type}
        title="Slogans"
        aside={
          <Button variant="ghost" size="sm" onClick={() => setSloganSeed((s) => s + 1)}>
            <RefreshCw /> Autres
          </Button>
        }
      >
        <p className="text-xs text-muted-foreground">Cliquez pour ajouter le slogan sur le t-shirt.</p>
        {request.brief?.slogans.length > 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Slogans de l'IA">
            {request.brief.slogans.map((s) => (
              <li key={`ai-${s}`}>
                <button
                  type="button"
                  onClick={() => onAddSlogan(s, request.placement ?? parsed.placement)}
                  className="flex items-center gap-1.5 rounded-[var(--radius-control)] border border-brand bg-brand-soft px-3 py-1.5 text-sm text-brand-ink hover:bg-brand hover:text-white"
                >
                  <Sparkles className="size-3.5" aria-hidden="true" /> {s}
                </button>
              </li>
            ))}
          </ul>
        )}
        <ul className="flex flex-wrap gap-2">
          {slogans.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => onAddSlogan(s, request.placement ?? parsed.placement)}
                className="rounded-[var(--radius-control)] border border-input px-3 py-1.5 text-sm hover:border-brand hover:text-brand-ink"
              >
                {s}
              </button>
            </li>
          ))}
        </ul>
      </Section>

      {/* 3. Variantes de couleurs */}
      <Section icon={Palette} title="Variantes de couleurs">
        {layers.length === 0 ? (
          <p className="text-sm text-muted-foreground">Ajoutez d'abord des éléments (ou appliquez une proposition).</p>
        ) : !variantSource ? (
          <Button variant="outline" className="w-full" onClick={() => setVariantSource({ layers, shirtColor })}>
            Proposer des déclinaisons
          </Button>
        ) : (
          <>
            {variantsOutdated && (
              <Button variant="ghost" size="sm" onClick={() => setVariantSource({ layers, shirtColor })}>
                <RefreshCw /> Actualiser avec le design actuel
              </Button>
            )}
            <ul className="grid grid-cols-2 gap-3" aria-label="Variantes de couleurs">
              {variants.map((v) => (
                <DesignCard
                  key={v.id}
                  design={v}
                  title={v.label}
                  onApply={(d) => {
                    onApplyDesign(d, { keepView: true });
                    setVariantSource(null);
                  }}
                />
              ))}
            </ul>
          </>
        )}
      </Section>

      {/* 4. Vérification */}
      <Section
        icon={CheckCircle2}
        title="Vérification"
        aside={
          issues.some((i) => i.level !== "info") ? (
            <Badge tone="warning">{issues.filter((i) => i.level !== "info").length} point(s)</Badge>
          ) : (
            <Badge tone="success">Prêt</Badge>
          )
        }
      >
        {issues.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-success">
            <CheckCircle2 className="size-4" aria-hidden="true" /> Contraste, tailles et placement : tout est bon pour l'impression.
          </p>
        ) : (
          <ul className="space-y-2" aria-label="Points à vérifier">
            {issues.map((issue, i) => {
              const Icon = ISSUE_ICON[issue.level];
              const content = (
                <>
                  <Icon className={cn("mt-0.5 size-4 shrink-0", ISSUE_TONE[issue.level])} aria-hidden="true" />
                  <span>{issue.message}</span>
                </>
              );
              return (
                <li key={i}>
                  {issue.layerId ? (
                    <button
                      type="button"
                      onClick={() => onSelectLayer(issue.layerId)}
                      className="flex w-full gap-2 rounded-[var(--radius-control)] p-2 text-left text-sm hover:bg-muted"
                      title="Sélectionner l'élément"
                    >
                      {content}
                    </button>
                  ) : (
                    <p className="flex gap-2 p-2 text-sm">{content}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
};

export default StudioPanel;
