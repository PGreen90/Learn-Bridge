// OMPROV I EN ÄLDRE MOTORVERSION — nattgranskningens löpare (2026-09-20).
//
// Körs ALDRIG för hand och aldrig i `npm test` (skipIf): nattgranskningen
// (tavlingsgranskning.probe.test.ts) checkar ut en äldre commit i ett eget
// git-arbetsträd, kopierar in DEN HÄR filen + tavlingsgranskning.ts och kör den
// där — så `botCardSmart` nedan är DEN commitens motor, inte dagens. Svaret per
// inskick (avvikelser mot den motorn; tom lista = den versionen lade korten)
// skrivs till OMPROV_UT.
//
// Eftersom filen körs i ÄLDRE träd: importera bara motorns långlivade moduler.

import { it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { playSeedForBoard, seedForBoard } from '../../../api-src/_lib/seed'
import { dealFromSeed } from './deal'
import { botCardSmart } from './play-bot'
import { decideCall } from './auction-live'
import { botAvvikelser, budAvvikelser, type BudMotor, type GranskadPayload } from './tavlingsgranskning'

const IN = process.env.OMPROV_FIL ?? ''
const UT = process.env.OMPROV_UT ?? ''

it.skipIf(!IN || !UT)('omprov av inskick mot den här commitens motor', { timeout: 0 }, async () => {
  const secret = process.env.DAILY_SEED_SECRET
  if (!secret) throw new Error('DAILY_SEED_SECRET saknas i omprovets miljö')
  // `datum` är sedan Dagens IMP (2026-09-26) FRÖNYCKELN: datumet för MP,
  // "datum#imp" för IMP. seedForBoard hashar strängen rakt av i alla versioner.
  const { datum, inskick } = JSON.parse(readFileSync(IN, 'utf8')) as {
    datum: string
    inskick: Array<{ id: string; board: number; payload: GranskadPayload | null }>
  }
  // Budmotorn i DEN HÄR versionen: har den tänkande bottar (botBud, 2026-09-24)
  // räknas de tänkta buden om med DD; äldre versioner budar bara ur tabellen.
  let budMotor: BudMotor = (d, h, s) => decideCall(d, h, s).bid
  try {
    const r = (await import('./resonemang')) as { botBud?: (d: unknown, h: unknown, s: unknown, o?: unknown) => { bid: string } }
    const dd = (await import('./revisor-dds')) as { getDds: () => Promise<unknown>; computeOracle: (dds: unknown, d: unknown) => { solve: unknown } }
    if (typeof r.botBud === 'function') {
      const dds = await dd.getDds()
      const botBud = r.botBud
      budMotor = (d, h, s) => botBud(d, h, s, (x: unknown) => dd.computeOracle(dds, x).solve).bid
    }
  } catch {
    /* äldre motor utan resonemangslagret → tabellen */
  }
  const resultat: Record<string, string[]> = {}
  for (const i of inskick) {
    const deal = dealFromSeed(seedForBoard(secret, datum, i.board), i.board)
    const playSeed = playSeedForBoard(secret, datum, i.board)
    resultat[i.id] = [...budAvvikelser(deal, i.payload, budMotor), ...botAvvikelser(deal, playSeed, i.payload, botCardSmart)]
  }
  writeFileSync(UT, JSON.stringify({ resultat }))
})
