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
import { botAvvikelser, type GranskadPayload } from './tavlingsgranskning'

const IN = process.env.OMPROV_FIL ?? ''
const UT = process.env.OMPROV_UT ?? ''

it.skipIf(!IN || !UT)('omprov av inskick mot den här commitens motor', { timeout: 0 }, () => {
  const secret = process.env.DAILY_SEED_SECRET
  if (!secret) throw new Error('DAILY_SEED_SECRET saknas i omprovets miljö')
  const { datum, inskick } = JSON.parse(readFileSync(IN, 'utf8')) as {
    datum: string
    inskick: Array<{ id: string; board: number; payload: GranskadPayload | null }>
  }
  const resultat: Record<string, string[]> = {}
  for (const i of inskick) {
    const deal = dealFromSeed(seedForBoard(secret, datum, i.board), i.board)
    const playSeed = playSeedForBoard(secret, datum, i.board)
    resultat[i.id] = botAvvikelser(deal, playSeed, i.payload, botCardSmart)
  }
  writeFileSync(UT, JSON.stringify({ resultat }))
})
