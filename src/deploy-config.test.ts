import { describe, test, expect } from 'vitest'
// Läs vite.config.ts som råtext via Vites `?raw` (typad som string av
// vite/client) → inget behov av node:fs/@types/node bara för det här testet.
import viteConfigSource from '../vite.config.ts?raw'

// R5-fynd #2 (uppdaterat vid Vercel-flytten 2026-07-05): Vite `base` MÅSTE
// matcha var appen serveras, annars blir HELA sidan blank. På Vercel serveras
// appen från domänens rot → base = "/" (på gamla GitHub Pages låg den under
// repo-namnet → "/Learn-Bridge/"). Detta vaktest låser värdet så en refaktor av
// vite.config.ts inte kan bryta det obemärkt (bygget blir grönt även med fel
// base → bara ett test fångar det). Körs i grinden före deploy → blank-sida-
// felet fångas före live.
describe('deploy-konfiguration', () => {
  test('Vite base = "/" (Vercel serverar från roten; annars blank sida)', () => {
    expect(viteConfigSource).toContain("base: '/'")
  })
})
