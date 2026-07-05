import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// VIKTIGT: hostas nu på Vercel, som serverar appen från roten på domänen.
// Därför base = "/" (inte längre "/Learn-Bridge/" som på GitHub Pages, där
// sidan låg under repo-namnet). Fel base här = blank sida. Låst av vaktestet
// src/deploy-config.test.ts.
export default defineConfig({
  base: '/',
  plugins: [
    react(),
    tailwindcss(),
    // PWA (Steg A Del 3): gör appen installerbar ("Lägg till på hemskärmen") +
    // offline. Service worker + manifest genereras vid bygget. autoUpdate =
    // ny version tas i bruk automatiskt vid nästa öppning (ingen "uppdatera"-knapp).
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'RebidZ – spela och lär dig bridge',
        short_name: 'RebidZ',
        description: 'Spela och lär dig bridge (2/1-systemet) direkt i webbläsaren.',
        lang: 'sv',
        theme_color: '#064e3b',
        background_color: '#064e3b',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precacha app-skalet + alla byggda tillgångar → funkar offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,wasm}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    // R5-fynd #3: .claude/worktrees/ innehåller parallella Claude Code-worktrees
    // med egna kopior av testerna – uteslut dem så `npm test` bara kör DENNA
    // arbetskopia (annars körs samma test dubbelt och kan flagga fel giv).
    exclude: [...configDefaults.exclude, '.claude/**'],
  },
})
