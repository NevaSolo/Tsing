import { rmSync } from 'node:fs'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Le modèle de l'IA locale (public/models, ≈ 1 Go) n'est PAS copié dans le build par défaut :
 * sans lui, le site prend le modèle sur Hugging Face. Pour l'inclure : AI_BUNDLE=1 npm run build.
 */
const skipBundledModel = () => ({
  name: 'tsing-skip-bundled-model',
  apply: 'build',
  closeBundle() {
    if (process.env.AI_BUNDLE === '1') return
    rmSync(fileURLToPath(new URL('./dist/models', import.meta.url)), { recursive: true, force: true })
  },
})

export default defineConfig({
  plugins: [react(), tailwindcss(), skipBundledModel()],
  // WebLLM est importé dynamiquement (à l'activation de l'IA) : sans ceci, Vite le découvre en cours de
  // session en dev et recharge la page, ce qui interrompt le chargement du modèle.
  optimizeDeps: { include: ['@mlc-ai/web-llm'] },
})
