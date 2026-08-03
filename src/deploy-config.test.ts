import { describe, test, expect } from 'vitest'
// Läs vite.config.ts som råtext via Vites `?raw` (typad som string av
// vite/client) → inget behov av node:fs/@types/node bara för det här testet.
import viteConfigSource from '../vite.config.ts?raw'
import indexHtmlSource from '../index.html?raw'
// ?url på en fil i public/ ger dess adress — men för att vakta att FILEN
// finns räcker inte det (adressen blir en sträng oavsett). fs används i stället.
import { existsSync } from 'node:fs'

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

  // Etapp A 2026-08-02: länkförhandsvisningen. Utan og:image visar chattappar
  // en tom ruta när någon delar en rebidz-länk — Dagens giv-delningen bygger
  // på att länken ser lockande ut. Taggen och själva bildfilen hör ihop:
  // en absolut og:image-adress mot en fil som inte finns är värre än ingen alls.
  test('og:-taggarna finns i index.html och pekar på en bild som finns', () => {
    expect(indexHtmlSource).toContain('property="og:title"')
    expect(indexHtmlSource).toContain('property="og:image"')
    expect(indexHtmlSource).toContain('https://rebidz.com/og-image.jpg')
    expect(existsSync('public/og-image.jpg')).toBe(true)
  })

  // Typsnitten ska med i offline-precachen (woff2) — annars tappar den
  // installerade appen guldserifen (varumärket) utan nät.
  test('woff2 ingår i service workerns precache-mönster', () => {
    expect(viteConfigSource).toMatch(/globPatterns.*woff2/)
  })
})
