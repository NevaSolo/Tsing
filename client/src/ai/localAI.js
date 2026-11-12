/*
 * IA locale (WebLLM) : détection, téléchargement unique du modèle, génération d'un brief.
 * Tout s'exécute dans le navigateur du visiteur (WebGPU) : aucune clé, aucun serveur, aucune donnée envoyée.
 * Les seuls téléchargements sont la bibliothèque et les fichiers du modèle (Hugging Face), une fois, puis en cache.
 *
 * WebLLM (≈ 6 Mo) n'est importé qu'à l'activation : ouvrir le Studio ne le télécharge pas.
 */
import { BRIEF_SCHEMA, buildBriefMessages, normalizeBrief } from "./brief.js";

/** Modèle retenu après mesure sur machine modeste (voir ai-bench.html) — Apache 2.0. */
export const MODEL_ID = "Qwen3.5-2B-q4f16_1-MLC";
export const MODEL_LABEL = "Qwen3.5 2B";
/** Mémoire graphique annoncée par WebLLM pour ce modèle. */
export const MODEL_VRAM_MB = 2245;

/**
 * Délai maximal d'une génération. La PREMIÈRE après chargement est plus lente (préparation du GPU,
 * compilation de la grammaire du schéma JSON) : mesuré > 120 s sur carte intégrée, puis ≈ 80 s.
 */
const GENERATION_TIMEOUT_MS = 150_000;
/** IA du serveur : processeur, ≈ 60 s (≈ 100 s modèle à recharger) ; le serveur abandonne à 170 s. */
const SERVER_TIMEOUT_MS = 185_000;
const FIRST_GENERATION_TIMEOUT_MS = 300_000;
let warmedUp = false;
/**
 * Chargement sans aucun signe de progression pendant ce délai = bloqué. WebLLM ne signale la progression
 * qu'à la fin de chaque fichier ; le premier pèse ≈ 250 Mo (≈ 20 min à 0,2 Mo/s), les 30 suivants 20 à 30 Mo.
 */
const LOAD_STALL_MS = 40 * 60_000;

/** Traduit les messages de progression de WebLLM (en anglais) pour l'interface. */
export function describeProgress(text = "") {
  let m;
  if (/^Start to fetch params/.test(text)) return "Téléchargement du modèle : premier bloc en cours…";
  if ((m = text.match(/^Fetching param cache\[(\d+)\/(\d+)\]: (\d+)MB fetched/))) {
    return `Téléchargement : ${m[3]} Mo reçus (fichier ${m[1]} sur ${m[2]})`;
  }
  if ((m = text.match(/^Loading model from cache\[(\d+)\/(\d+)\]/))) return `Chargement en mémoire graphique (${m[1]}/${m[2]})`;
  if ((m = text.match(/^Loading GPU shader modules\[(\d+)\/(\d+)\]/))) return `Préparation de la carte graphique (${m[1]}/${m[2]})`;
  if (/^Finish loading/.test(text)) return "Prêt.";
  return text;
}
/** Indice « modèle déjà téléchargé » : évite d'importer WebLLM juste pour interroger son cache. */
const CACHED_FLAG = "tsing.ai.cachedModel";

// ------------------------------------------------------------------ État observable (pour React)

let state = { status: "idle", progress: 0, detail: "", error: null, cached: false };
const listeners = new Set();
const setState = (patch) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};
export const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const getState = () => state;

// Outils de diagnostic (développement uniquement) : état lisible depuis la console / les tests.
if (import.meta.env?.DEV && typeof window !== "undefined") window.__tsingAI = { getState, trace: [] };
const trace = (msg) =>
  import.meta.env?.DEV && typeof window !== "undefined" && window.__tsingAI?.trace.push(`${Math.round(performance.now() / 1000)}s ${msg}`);

const readCachedFlag = () => {
  try {
    return localStorage.getItem(CACHED_FLAG) === MODEL_ID;
  } catch {
    return false;
  }
};
const writeCachedFlag = (cached) => {
  try {
    if (cached) localStorage.setItem(CACHED_FLAG, MODEL_ID);
    else localStorage.removeItem(CACHED_FLAG);
  } catch {
    /* stockage indisponible : on retéléchargera simplement l'indice */
  }
};

// ------------------------------------------------------------------ Support

/** Vérifie que cet appareil peut faire tourner le modèle (WebGPU + demi-précision). */
export async function detectSupport() {
  if (typeof navigator === "undefined" || !navigator.gpu) {
    return { supported: false, reason: "Votre navigateur ne prend pas en charge WebGPU (essayez Chrome ou Edge récents sur ordinateur)." };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
    if (!adapter) return { supported: false, reason: "Aucune carte graphique compatible WebGPU n'a été trouvée." };
    if (!adapter.features.has("shader-f16")) {
      return { supported: false, reason: "Votre carte graphique ne gère pas les calculs en demi-précision requis par le modèle." };
    }
    return { supported: true };
  } catch (err) {
    return { supported: false, reason: `WebGPU indisponible : ${err?.message ?? err}` };
  }
}

let webllm = null;
const loadLibrary = async () => (webllm ??= await import("@mlc-ai/web-llm"));

/**
 * IA du serveur Tsing (Ollama) : si le serveur en propose une, elle est prête tout de suite
 * (rien à télécharger, fonctionne sur tous les navigateurs) et remplace l'IA du navigateur.
 */
async function serverAI() {
  try {
    const { default: api } = await import("../lib/api"); // import différé : module testé sous Node
    const { data } = await api.get("/ai/config/");
    return data?.enabled ? data : null;
  } catch {
    return null;
  }
}

/** Initialise l'état : IA du serveur, sinon support + modèle déjà téléchargé ? (sans rien télécharger). */
export async function checkAvailability() {
  if (state.status !== "idle") return state;
  setState({ status: "checking" });
  const server = await serverAI();
  if (server && state.status === "checking") {
    setState({ status: "ready", engine: "server", serverModel: server.model, error: null });
    return state;
  }
  const support = await detectSupport();
  // Un chargement a pu démarrer pendant la détection : ne pas l'écraser.
  if (state.status !== "checking") return state;
  if (!support.supported) {
    setState({ status: "unsupported", error: support.reason });
    return state;
  }
  const [cached, local] = await Promise.all([readCachedFlag() || probeModelCache(), findLocalModel()]);
  if (state.status !== "checking") return state;
  setState({ status: "available", cached, bundled: Boolean(local) });
  return state;
}

/**
 * Copie du modèle servie par le site lui-même (npm run ai:download → public/models/), ou null.
 * Plus rapide et sans dépendance à Hugging Face ; sinon on retombe sur Hugging Face.
 */
let localModelPromise = null;
export function findLocalModel() {
  localModelPromise ??= (async () => {
    if (typeof window === "undefined") return null;
    try {
      const base = new URL(`${import.meta.env?.BASE_URL ?? "/"}models/`, window.location.href);
      const res = await fetch(new URL(`${MODEL_ID}/ready.json`, base), { cache: "no-store" });
      if (!res.ok) return null;
      // ready.json n'existe qu'une fois la copie complète (en dev, un fichier absent renvoie index.html : json() échoue).
      const info = await res.json();
      if (info.model_id !== MODEL_ID) return null;
      return { model: new URL(`${MODEL_ID}/resolve/main/`, base).href, model_lib: new URL(info.model_lib, base).href };
    } catch {
      return null;
    }
  })();
  return localModelPromise;
}

/** Configuration WebLLM : l'entrée officielle du modèle, avec les adresses locales si la copie existe. */
async function appConfigFor(lib) {
  const local = await findLocalModel();
  const entry = lib.prebuiltAppConfig.model_list.find((m) => m.model_id === MODEL_ID);
  if (!local || !entry) return undefined;
  return { ...lib.prebuiltAppConfig, model_list: [{ ...entry, ...local }] };
}

/** Les poids du modèle sont-ils déjà dans le cache du navigateur ? (lecture directe, sans WebLLM) */
async function probeModelCache() {
  try {
    if (typeof caches === "undefined" || !(await caches.has("webllm/model"))) return false;
    const keys = await (await caches.open("webllm/model")).keys();
    const found = keys.some((req) => req.url.includes(MODEL_ID) && req.url.includes("params_shard"));
    if (found) writeCachedFlag(true);
    return found;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ Moteur

let enginePromise = null;
let worker = null;
/** Interrompt le chargement en cours (défini pendant loadModel). */
let abortLoad = null;

const killWorker = (w) => {
  try {
    w?.terminate();
  } catch {
    /* déjà arrêté */
  }
  if (worker === w) worker = null;
};

/** Télécharge (la première fois) et charge le modèle dans un Web Worker. */
export function loadModel() {
  if (enginePromise) return enginePromise;
  setState({ status: "loading", progress: 0, detail: "Préparation…", error: null, loadStartedAt: Date.now() });
  trace("loadModel: début");
  let myWorker = null;
  let stallTimer = null;
  enginePromise = (async () => {
    const lib = await loadLibrary();
    myWorker = worker = new Worker(new URL("./llm.worker.js", import.meta.url), { type: "module" });
    // WebLLM n'écoute pas les erreurs du Worker : sans ceci, un Worker qui plante laisserait « chargement » à vie.
    let fail;
    const failure = new Promise((_, reject) => {
      fail = reject;
    });
    failure.catch(() => {}); // pas de rejet non géré si le chargement a réussi
    abortLoad = () => fail(new DOMException("Chargement annulé", "AbortError"));
    myWorker.addEventListener("error", (e) => fail(new Error(e?.message || "Le processus de l'IA s'est arrêté.")), { once: true });
    myWorker.addEventListener("messageerror", () => fail(new Error("Message illisible du processus de l'IA.")), { once: true });
    // Chien de garde : réarmé à chaque signe de progression.
    const arm = () => {
      clearTimeout(stallTimer);
      stallTimer = setTimeout(() => fail(new Error("Le chargement ne progresse plus.")), LOAD_STALL_MS);
    };
    arm();
    const appConfig = await appConfigFor(lib);
    trace(`source : ${appConfig ? "copie du projet" : "Hugging Face"}`);
    const engine = await Promise.race([
      lib.CreateWebWorkerMLCEngine(myWorker, MODEL_ID, {
        appConfig,
        initProgressCallback: (report) => {
          arm();
          trace(`progress ${report.progress.toFixed(3)} ${report.text.slice(0, 80)}`);
          setState({ progress: report.progress, detail: describeProgress(report.text) });
        },
      }),
      failure,
    ]);
    clearTimeout(stallTimer);
    abortLoad = null;
    writeCachedFlag(true);
    warmedUp = false;
    setState({ status: "ready", progress: 1, detail: "", cached: true });
    return engine;
  })().catch((err) => {
    clearTimeout(stallTimer);
    abortLoad = null;
    killWorker(myWorker); // libère la mémoire (et le GPU) de la tentative ratée
    enginePromise = null;
    if (err?.name === "AbortError") {
      // Annulé par l'utilisateur : les fichiers déjà reçus restent en cache, la reprise ira plus vite.
      setState({ status: "available", progress: 0, detail: "", error: null });
      throw err;
    }
    const message = String(err?.message ?? err);
    setState({
      status: "error",
      error: /memory|OOM|out of memory|device lost|allocation/i.test(message)
        ? "La carte graphique manque de mémoire pour ce modèle."
        : `Le chargement de l'IA a échoué : ${message.slice(0, 160)}`,
    });
    throw err;
  });
  return enginePromise;
}

/**
 * Génère un brief à partir d'une demande. Lance une erreur si l'IA n'est pas prête, si la génération
 * dépasse le délai, si elle est annulée, ou si la réponse est inutilisable (l'appelant bascule alors
 * sur le générateur par mots-clés).
 */
export async function generateBrief(prompt, { text, signal } = {}) {
  if (state.engine === "server") return generateOnServer(prompt, { text, signal });
  if (!enginePromise) throw new Error("IA non chargée");
  const engine = await enginePromise;
  if (signal?.aborted) throw new DOMException("Génération annulée", "AbortError");
  setState({ status: "generating" });
  let timer;
  const onAbort = () => engine.interruptGenerate();
  signal?.addEventListener("abort", onAbort);
  try {
    const request = engine.chat.completions.create({
      messages: buildBriefMessages(prompt, { text }),
      response_format: { type: "json_object", schema: JSON.stringify(BRIEF_SCHEMA) },
      max_tokens: 320,
      temperature: 0.7,
    });
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        engine.interruptGenerate();
        reject(new Error("L'IA a mis trop de temps à répondre."));
      }, warmedUp ? GENERATION_TIMEOUT_MS : FIRST_GENERATION_TIMEOUT_MS);
    });
    // Le moteur doit avoir réellement terminé avant d'accepter une nouvelle demande.
    request.catch(() => {});
    const reply = await Promise.race([request, timeout]);
    if (signal?.aborted) throw new DOMException("Génération annulée", "AbortError");
    const choice = reply.choices?.[0];
    warmedUp = true;
    const brief = normalizeBrief(choice?.message?.content);
    if (!brief) throw new Error("Réponse de l'IA inutilisable.");
    return { brief, usage: reply.usage, finish: choice.finish_reason };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
    if (state.status === "generating") setState({ status: "ready" });
  }
}

/** Brief demandé à l'IA du serveur (Ollama) ; mêmes filtres que l'IA du navigateur (normalizeBrief). */
async function generateOnServer(prompt, { text, signal } = {}) {
  const { default: api } = await import("../lib/api");
  setState({ status: "generating" });
  try {
    const { data } = await api.post("/ai/brief/", { prompt, text: text ?? "" }, { signal, timeout: SERVER_TIMEOUT_MS });
    const brief = normalizeBrief(data.brief);
    if (!brief) throw new Error("Réponse de l'IA inutilisable.");
    return { brief, model: data.model, seconds: data.seconds };
  } catch (err) {
    if (signal?.aborted) throw new DOMException("Génération annulée", "AbortError");
    const status = err?.response?.status;
    throw new Error(
      status === 429
        ? "Trop de demandes à l'IA : patientez une minute."
        : err?.response?.data?.detail ?? (err?.code === "ECONNABORTED" ? "L'IA a mis trop de temps à répondre." : err.message)
    );
  } finally {
    if (state.status === "generating") setState({ status: "ready" });
  }
}

/** Arrête un chargement en cours (téléchargement compris). */
export function cancelLoad() {
  abortLoad?.();
}

/** Libère la mémoire graphique et arrête le Worker (le modèle reste en cache disque). */
export async function unloadModel() {
  const pending = enginePromise;
  const w = worker;
  enginePromise = null;
  if (pending) {
    try {
      const engine = await pending;
      await engine.unload();
    } catch {
      /* déjà libéré ou chargement raté */
    }
  }
  killWorker(w); // toujours, même si unload() a échoué
  setState({ status: "available", progress: 0, detail: "" });
}

/** Supprime le modèle du cache du navigateur. Renvoie true si la suppression a réussi. */
export async function deleteModel() {
  await unloadModel();
  setState({ status: "deleting" });
  try {
    const lib = await loadLibrary();
    await lib.deleteModelAllInfoInCache(MODEL_ID, await appConfigFor(lib));
    writeCachedFlag(false);
    setState({ status: "available", cached: false, error: null });
    return true;
  } catch {
    setState({
      status: "available",
      error: "Suppression du modèle impossible. Réessayez, ou videz les données du site dans les paramètres du navigateur.",
    });
    return false;
  }
}
