/** Consigne + schéma du brief, tels qu'envoyés au modèle (navigateur ou serveur Ollama). */
import { BRIEF_SCHEMA, buildBriefMessages } from "./brief.js";

export const TEXT_LABEL = "Texte imposé : ";

export function buildAiSpec() {
  const [system] = buildBriefMessages("");
  return { system: system.content, text_label: TEXT_LABEL, schema: BRIEF_SCHEMA };
}
