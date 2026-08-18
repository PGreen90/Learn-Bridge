// Facit för Beslut B etapp 2 steg 1: buntningen (scripts/build-api.mjs) ska ge
// SJÄLVSTÄNDIGA api/*.js som Node kör direkt — dvs. exakt det fyndet från
// etapp 0 sa krävdes (motorns extensionslösa importer måste buntas, annars
// ERR_MODULE_NOT_FOUND i Vercels Node-körning). Testet kör det RIKTIGA byggsteget
// (samma som Vercel kör via `npm run build`) och kontrollerar de skarpa
// funktionerna: att bunten importerar rent under Node och inte har kvar en enda
// relativ import att resolva i körmiljön.
//
// (Tidigare provades detta via en tillfällig `motorprov`-endpoint som körde
// motorn utan auth; den togs bort när hämtningsvägen fanns. Nu vaktar vi de
// riktiga funktionerna i stället — de läser miljövariabler först INNE i handlern,
// så själva importen är biverkningsfri och går att prova utan hemligheter.)

import { describe, test, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'

const FUNKTIONER = [
  'bord',
  'dagens-logg',
  'dagens-tavling',
  'generera-dagens-givar',
  'giv-resultat',
  'skicka-in',
  'topplista',
]

describe('api-buntning (Beslut B etapp 2 steg 1)', () => {
  beforeAll(() => {
    // Kör det riktiga byggskriptet. Kastar (och fäller testet) om buntningen
    // misslyckas — t.ex. om motorns importkedja inte går att resolva.
    execFileSync(process.execPath, ['scripts/build-api.mjs'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    })
  })

  test.each(FUNKTIONER)('%s: buntas till en självständig api/%s.js', (namn) => {
    const out = join(process.cwd(), 'api', `${namn}.js`)
    expect(existsSync(out), `byggsteget ska ha skrivit api/${namn}.js`).toBe(true)

    // Kärnan i etapp 0-fyndet: ingen kvarvarande relativ import (`./`/`../`) —
    // sådana kraschar Node ESM på servern. node:*/paket-importer är OK.
    const kod = readFileSync(out, 'utf8')
    const relativa = kod.match(/\bfrom\s+['"]\.\.?\//g)
    expect(relativa, `api/${namn}.js har kvar relativa importer: ${relativa}`).toBeNull()
  })

  test.each(FUNKTIONER)('%s: bunten importerar rent under Node och exporterar en handler', async (namn) => {
    const out = join(process.cwd(), 'api', `${namn}.js`)
    // Cache-buster så watch-läge inte serverar en gammal import. Importen är
    // biverkningsfri (miljövariabler läses först inne i handlern).
    const mod: { default: unknown } = await import(pathToFileURL(out).href + `?v=${Date.now()}`)
    expect(typeof mod.default).toBe('function')
  })
})
