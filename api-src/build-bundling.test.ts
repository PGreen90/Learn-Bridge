// Facit för Beslut B etapp 2 steg 1: buntningen (scripts/build-api.mjs) ska ge
// en SJÄLVSTÄNDIG api/*.js som Node kör direkt — dvs. exakt det fyndet från
// etapp 0 sa krävdes (motorns extensionslösa importer måste buntas). Testet kör
// det RIKTIGA byggsteget (samma som Vercel kör via `npm run build`) och kör sedan
// den buntade funktionen precis som Vercels Node-körning gör.

import { describe, test, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

describe('api-buntning (Beslut B etapp 2 steg 1)', () => {
  test('motorprov: byggsteget ger en självständig fil som kör motorn under Node', async () => {
    // Kör det riktiga byggskriptet. Kastar (och fäller testet) om buntningen
    // misslyckas — t.ex. om motorns importkedja inte går att resolva.
    execFileSync(process.execPath, ['scripts/build-api.mjs'], {
      cwd: process.cwd(),
      stdio: 'pipe',
    })

    const out = join(process.cwd(), 'api', 'motorprov.js')
    expect(existsSync(out), 'byggsteget ska ha skrivit api/motorprov.js').toBe(true)

    // Importera och kör den buntade funktionen precis som Vercel gör.
    // Cache-buster så watch-läge inte serverar en gammal import.
    const mod: { default: (req: unknown, res: unknown) => void } = await import(
      pathToFileURL(out).href + `?v=${Date.now()}`
    )

    let body = ''
    const res = {
      statusCode: 0,
      setHeader() {},
      end(b: string) {
        body = b
      },
    }
    mod.default({}, res)

    const data = JSON.parse(body)
    expect(res.statusCode).toBe(200)
    expect(data.ok).toBe(true)
    // Motorn gav faktiskt en komplett giv: 13 kort per hand.
    expect(data.kortPerHand).toEqual({ N: 13, E: 13, S: 13, W: 13 })
  })
})
