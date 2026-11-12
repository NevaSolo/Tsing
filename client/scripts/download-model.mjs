/*
 * Télécharge UNE FOIS le modèle de l'IA locale dans public/models/ : le site le sert ensuite lui-même
 * (plus de dépendance à Hugging Face, chargement en quelques secondes en local).
 *
 *   npm run ai:download
 *
 * - Reprise : les fichiers déjà complets sont ignorés, relancez simplement la commande après une coupure.
 * - Les fichiers de poids sont enregistrés en « .data » au lieu de « .bin » : les gestionnaires de
 *   téléchargement (IDM…) interceptent les .bin et bloquent le chargement dans le navigateur.
 * - ready.json n'est écrit qu'à la fin : l'application n'utilise la copie locale que si elle est complète.
 */
import { createWriteStream, existsSync, mkdirSync, renameSync, statSync, writeFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

// À garder en phase avec src/ai/localAI.js (MODEL_ID) et la version de @mlc-ai/web-llm.
const MODEL_ID = "Qwen3.5-2B-q4f16_1-MLC";
const REPO = `https://huggingface.co/mlc-ai/${MODEL_ID}/resolve/main/`;
const MODEL_LIB = "Qwen3.5-2B-q4f16_1_cs1k-webgpu.wasm";
const LIB_URL = `https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_87/base/${MODEL_LIB}`;
const META_FILES = ["mlc-chat-config.json", "tokenizer.json", "tokenizer_config.json", "vocab.json", "merges.txt"];
const CONCURRENCY = 3;

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "models");
// L'URL locale contient « /resolve/main/ » : WebLLM l'utilise alors telle quelle.
const modelDir = join(root, MODEL_ID, "resolve", "main");
const libDir = join(root, "libs");
mkdirSync(modelDir, { recursive: true });
mkdirSync(libDir, { recursive: true });
rmSync(join(root, MODEL_ID, "ready.json"), { force: true });

const mb = (n) => `${(n / 2 ** 20).toFixed(0)} Mo`;
let done = 0;
let total = 0;
const t0 = Date.now();
const report = () => {
  const s = (Date.now() - t0) / 1000;
  const speed = done / Math.max(1, s);
  const left = total > done ? Math.round((total - done) / Math.max(1, speed) / 60) : 0;
  process.stdout.write(`\r${mb(done)} / ${mb(total)} · ${(speed / 2 ** 20).toFixed(2)} Mo/s · reste ≈ ${left} min   `);
};

async function download(url, dest, expectedSize) {
  if (expectedSize && existsSync(dest) && statSync(dest).size === expectedSize) {
    done += expectedSize;
    return;
  }
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const part = `${dest}.part`;
      let received = 0;
      const counter = new TransformStream({
        transform(chunk, ctrl) {
          received += chunk.byteLength;
          done += chunk.byteLength;
          ctrl.enqueue(chunk);
        },
      });
      try {
        await pipeline(Readable.fromWeb(res.body.pipeThrough(counter)), createWriteStream(part));
      } catch (err) {
        done -= received;
        throw err;
      }
      if (expectedSize && received !== expectedSize) {
        done -= received;
        throw new Error(`taille reçue ${received}, attendue ${expectedSize}`);
      }
      renameSync(part, dest);
      return;
    } catch (err) {
      if (attempt >= 5) throw new Error(`${url} : ${err.message}`);
      console.log(`\nNouvel essai (${attempt}/5) pour ${url.split("/").pop()} : ${err.message}`);
      await new Promise((r) => setTimeout(r, 3000 * attempt));
    }
  }
}

// 1. Petits fichiers (configuration, tokenizer) et bibliothèque WebGPU du modèle.
for (const f of META_FILES) await download(REPO + f, join(modelDir, f));
await download(LIB_URL, join(libDir, MODEL_LIB));

// 2. Index des poids : on le réécrit avec l'extension .data.
const cache = await (await fetch(REPO + "tensor-cache.json")).json();
const shards = cache.records.map((r) => ({ remote: r.dataPath, local: r.dataPath.replace(/\.bin$/, ".data"), size: r.nbytes }));
cache.records = cache.records.map((r) => ({ ...r, dataPath: r.dataPath.replace(/\.bin$/, ".data") }));
writeFileSync(join(modelDir, "tensor-cache.json"), JSON.stringify(cache));

// 3. Poids (≈ 1 Go), quelques fichiers en parallèle.
total = shards.reduce((n, s) => n + s.size, 0);
console.log(`Modèle ${MODEL_ID} : ${shards.length} fichiers, ${mb(total)} → ${modelDir}`);
const timer = setInterval(report, 1000);
const queue = [...shards];
await Promise.all(
  Array.from({ length: CONCURRENCY }, async () => {
    for (let s = queue.shift(); s; s = queue.shift()) await download(REPO + s.remote, join(modelDir, s.local), s.size);
  })
);
clearInterval(timer);
report();

// 4. Copie complète : l'application peut l'utiliser.
writeFileSync(
  join(root, MODEL_ID, "ready.json"),
  JSON.stringify({ model_id: MODEL_ID, model_lib: `libs/${MODEL_LIB}`, bytes: total, downloadedAt: new Date().toISOString() })
);
console.log(`\nTerminé en ${Math.round((Date.now() - t0) / 60000)} min. Le site charge maintenant l'IA depuis /models/.`);
