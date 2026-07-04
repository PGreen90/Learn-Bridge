import { describe, test, expect } from 'vitest'
// Läs vite.config.ts som råtext via Vites `?raw` (typad som string av
// vite/client) → inget behov av node:fs/@types/node bara för det här testet.
import viteConfigSource from '../vite.config.ts?raw'

// R5-fynd #2: Vite `base` MÅSTE matcha repo-namnet ("/Learn-Bridge/"), annars
// blir HELA sidan blank på GitHub Pages. CLAUDE.md kallar det "det vanligaste
// deploy-felet". Detta vaktest låser värdet så en refaktor av vite.config.ts
// inte kan bryta det obemärkt (bygget blir grönt även med fel base → bara ett
// test fångar det). Körs i CI-test-jobbet → blank-sida-felet fångas före live.
describe('deploy-konfiguration', () => {
  test('Vite base matchar repo-namnet /Learn-Bridge/ (annars blank Pages-sida)', () => {
    expect(viteConfigSource).toContain("base: '/Learn-Bridge/'")
  })
})
