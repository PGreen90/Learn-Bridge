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
    // offline. Service worker + manifest genereras vid bygget.
    // 2026-08-02 (granskningens Etapp A): "autoUpdate" → "prompt". autoUpdate
    // lät en ny version ta över TYST mitt i en session, vilket kunde ge
    // chunk-fel (vit sida) i öppna flikar. Nu visar appen en diskret
    // "Ny version finns"-rad i stället (registreringen: src/pwa-update.ts,
    // därför injectRegister: false — vi anropar registerSW själva).
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        // Stabil identitet: utan id räknas ett framtida byte av start_url som
        // en HELT NY app för alla som redan lagt rebidz på hemskärmen.
        id: '/',
        name: 'rebidz – spela och lär dig bridge',
        short_name: 'rebidz',
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
        // woff2 (granskningen 2026-08-02): utan den precachades inte
        // typsnitten, så guldserifen föll tillbaka på systemtypsnitt offline.
        globPatterns: ['**/*.{js,css,html,svg,png,ico,wasm,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    // R5-fynd #3: .claude/worktrees/ innehåller parallella Claude Code-worktrees
    // med egna kopior av testerna – uteslut dem så `npm test` bara kör DENNA
    // arbetskopia (annars körs samma test dubbelt och kan flagga fel giv).
    exclude: [...configDefaults.exclude, '.claude/**'],
    // 2026-07-28: full parallellism svälte de tunga DDS-testerna på CPU så att
    // deras timeouts small slumpvis (samma klass av myntkast-grind som lagades
    // 2026-07-28 — fast CPU-svält i stället för slumpgivar). Provat på ägarens
    // maskin: obegränsat = rött, 50 % = rött, 4 arbetare = grönt. Fast tak 4
    // gör `npm test` deterministiskt igen (verifiera med: npm test).
    maxWorkers: 4,
    // Samma dag, del 2: Vercels byggare har färre kärnor än ägarens dator och
    // föll ÄNDÅ på timeouts (deploy dpl_9nYKc…). En tidsgräns ska fånga
    // HÄNGNINGAR, inte straffa långsamma maskiner — därför generös global
    // gräns; de tyngsta DDS-testerna har egna, ännu högre, i sina filer.
    testTimeout: 60_000,
  },
})
