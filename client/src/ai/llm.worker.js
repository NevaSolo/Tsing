/* Web Worker : le modèle de langage tourne ici, hors du fil principal (l'interface reste fluide). */
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (message) => handler.onmessage(message);
