/*
 * Exporte la consigne et le schéma JSON du « brief » IA (src/ai/brief.js) pour le serveur Django,
 * qui interroge Ollama avec exactement la même question que l'IA du navigateur.
 *   npm run ai:spec   (à relancer après toute modification de brief.js ; un test vérifie la synchro)
 */
import { writeFileSync } from "node:fs";
import { buildAiSpec } from "../src/ai/spec.js";

const file = new URL("../../ecommerce_backend/store/ai_spec.json", import.meta.url);
writeFileSync(file, JSON.stringify(buildAiSpec(), null, 2) + "\n");
console.log("Consigne IA exportée →", file.pathname);
