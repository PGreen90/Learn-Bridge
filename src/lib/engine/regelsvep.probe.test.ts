// REGELSVEPET (2026-07-25) — vilka budregler använder motorn FAKTISKT?
//
// Bakgrund: `lebensohl.ts` var byggd, enhetstestad och nedskriven i systemboken
// — men ingen produktionsfil importerade den, så bottarna spelade den aldrig.
// Enhetstester kan inte upptäcka det (de anropar modulen direkt). Svepet kan:
// det låter motorn bjuda tusentals givar och räknar vilka regelnamn som
// verkligen faller ut. En konvention som står i boken men saknas i listan är
// antingen bortkopplad eller onåbar.
//
// Körs ALDRIG i `npm test`/deploygrinden (skipIf) — bara på begäran:
//   PowerShell:  $env:SVEP='1'; npx vitest run src/lib/engine/regelsvep.probe.test.ts
//   Bash:        SVEP=1 npx vitest run src/lib/engine/regelsvep.probe.test.ts
//
// Rattar: SVEP_DEALS (antal givar, standard 3000), SVEP_SEED (frö).
// Resultatet skrivs till `revisor-output/regelsvep.txt` (gitignorad mapp).
import { it, expect } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dealFromSeed, botAuction } from './revisor'

const DEALS = Number(process.env.SVEP_DEALS ?? 3000)
const SEED = Number(process.env.SVEP_SEED ?? 20260721)

it.skipIf(!process.env.SVEP)('regelsvep: räkna regelnamn i levande auktioner', () => {
  const tally = new Map<string, number>()
  let auktionsfel = 0

  for (let i = 0; i < DEALS; i++) {
    const history = botAuction(dealFromSeed(SEED + i))
    if (!history) {
      auktionsfel++
      continue
    }
    for (const call of history) {
      const rule = (call as { rule?: string }).rule
      if (rule) tally.set(rule, (tally.get(rule) ?? 0) + 1)
    }
  }

  const sorterat = [...tally.entries()].sort((a, b) => b[1] - a[1])
  const rader = [
    `=== REGELSVEP: ${DEALS} givar från frö ${SEED} ===`,
    `${sorterat.length} olika regler användes · ${auktionsfel} auktioner tog aldrig slut`,
    '',
    ...sorterat.map(([regel, n]) => String(n).padStart(6) + '  ' + regel),
  ]
  mkdirSync('revisor-output', { recursive: true })
  writeFileSync('revisor-output/regelsvep.txt', rader.join('\n'), 'utf8')

  expect(auktionsfel).toBe(0)
})
