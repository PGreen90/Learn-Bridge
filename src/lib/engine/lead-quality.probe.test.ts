// UTSPELS-A/B-PROBE: budstyrt utspel (openingLeadWithAuction, hål A–G) vs det
// gamla BUDBLINDA utspelet (openingLeadChoice). Körs ALDRIG i vanliga npm test /
// deploygrinden (skipIf) – bara på begäran:
//
//   PowerShell:  $env:LEADAB='1'; npx vitest run src/lib/engine/lead-quality.probe.test.ts
//   Bash:        LEADAB=1 npx vitest run src/lib/engine/lead-quality.probe.test.ts
//
// Rattar: LEADAB_DEALS (antal givar, standard 120), LEADAB_SEED (basfrö, standard
// 20260729 – behåll för jämförbara mätningar).
//
// VAD MÄTS: aggregerad stickeffekt av det nya budstyrda utspelet. För varje giv
// spelas HELA given av den skarpa boten (Monte-Carlo) på två sätt som skiljer sig
// åt i EXAKT ETT kort – utspelet i trick 1:
//   • budstyrt (A/ny):  botCardSmart(calls) leder ut via openingLeadWithAuction.
//   • budblindt (B/gml): botCardReasoned leder ut via openingLeadChoice; RESTEN av
//                        given spelas identiskt med botCardSmart(calls).
// Spelförarens stick jämförs. LÄGRE spelförarstick med budstyrt = bättre försvar.
//
// ISOLERING & DETERMINISM:
//   • Utspelet (trick 1) använder ALDRIG Monte-Carlo → utspelskortet i båda lägena
//     räknas fram helt utan slump. Skiljer de sig inte åt är hela utspelet identiskt
//     och given bidrar exakt 0 – då hoppas den DYRA dubbla genomspelningen över.
//   • Bara när kortet SKILJER sig spelas given ut två gånger, båda under SAMMA
//     mockade slump (mulberry32, nollställd till givens frö före varje läge). Allt
//     som är gemensamt drar samma slumptal → enda variabeln är utspelskortet.
// Resultatet skrivs till TEMP/leadab.txt (vitest sväljer console.log i den här repon).

import { afterEach, it, vi } from 'vitest'
import { writeFileSync } from 'node:fs'
import { botCardReasoned, botCardSmart } from './play-bot'
import { contractResult, isComplete, playCard, startPlay, type Contract } from './play'
import { contractFromCalls } from './auction-contract'
import { botAuction, dealFromSeed } from './revisor'
import type { Card, Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'

/** Deterministisk PRNG (mulberry32) – samma stabilisering som teknik-/establish-testerna. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SUIT_GLYPH: Record<string, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }
const cardStr = (c: Card) => `${SUIT_GLYPH[c.suit]}${c.rank}`

/**
 * Spela hela given med bot-hjärnan; returnera spelförarens stick. `bidDriven`
 * styr ENBART utspelet i trick 1: true → botCardSmart(calls) (budstyrt), false →
 * botCardReasoned (budblindt). Alla senare kort spelas i båda lägena av
 * botCardSmart(calls), så bara utspelskortet skiljer.
 */
function declarerTricks(deal: Deal, contract: Contract, calls: ResolvedCall[], bidDriven: boolean): number {
  let st = startPlay(deal, contract)
  let guard = 0
  while (!isComplete(st) && guard++ < 60) {
    const seat = st.toAct
    const opening = st.completedTricks.length === 0 && st.currentTrick.length === 0
    const card = opening && !bidDriven ? botCardReasoned(st, seat).card : botCardSmart(st, seat, calls)
    st = playCard(st, card)
  }
  return contractResult(st).declarerTricks
}

const DEALS = Number(process.env.LEADAB_DEALS ?? 120)
const SEED = Number(process.env.LEADAB_SEED ?? 20260729)

it.skipIf(!process.env.LEADAB)(
  `utspel A/B (budstyrt vs budblindt): ${DEALS} givar, frö ${SEED}`,
  { timeout: 0 },
  () => {
    const t0 = Date.now()
    let played = 0 // givar med giltigt kontrakt
    let changed = 0 // givar där utspelskortet skilde sig
    let sumDriven = 0 // spelförarstick (budstyrt) på de ÄNDRADE givarna
    let sumBlind = 0 // spelförarstick (budblindt) på de ÄNDRADE givarna
    const rows: string[] = []

    for (let i = 0; i < DEALS; i++) {
      const seed = SEED + i
      const deal = dealFromSeed(seed)
      const calls = botAuction(deal)
      const contract = calls && contractFromCalls(calls)
      if (!contract || !calls) continue
      played++

      // Utspelskorten (deterministiska, ingen Monte-Carlo på trick 1).
      const st0 = startPlay(deal, contract)
      const leader: Seat = st0.toAct
      const drivenLead = botCardSmart(st0, leader, calls)
      const blindLead = botCardReasoned(st0, leader).card
      if (drivenLead.suit === blindLead.suit && drivenLead.rank === blindLead.rank) continue // identiskt utspel → 0

      // Utspelet skiljer sig → spela ut båda under samma nollställda slump.
      vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed))
      const driven = declarerTricks(deal, contract, calls, true)
      vi.spyOn(Math, 'random').mockImplementation(mulberry32(seed))
      const blind = declarerTricks(deal, contract, calls, false)
      vi.restoreAllMocks()

      changed++
      sumDriven += driven
      sumBlind += blind
      const delta = driven - blind // negativt = budstyrt sänkte spelförarstick = bättre försvar
      rows.push(
        `${seed}: ${contract.level}${contract.strain} by ${contract.declarer} | ` +
          `utspel budblindt ${cardStr(blindLead)} → budstyrt ${cardStr(drivenLead)} | ` +
          `decl budstyrt ${driven} vs budblindt ${blind} (${delta > 0 ? '+' : ''}${delta})`,
      )
    }

    const secs = ((Date.now() - t0) / 1000).toFixed(1)
    const net = sumDriven - sumBlind // negativt = budstyrt bättre för försvaret (färre spelförarstick)
    const worse = rows.filter((r) => /\(\+\d+\)$/.test(r)).length
    const better = rows.filter((r) => /\(-\d+\)$/.test(r)).length
    const report =
      `UTSPEL A/B (budstyrt vs budblindt): ${played} givar spelbara, ${changed} fick ändrat utspel, ${secs}s\n` +
      `Spelförarstick på de ${changed} ändrade givarna: budstyrt=${sumDriven}, budblindt=${sumBlind}, ` +
      `netto budstyrt−budblindt=${net > 0 ? '+' : ''}${net}\n` +
      `(NEGATIVT netto = budstyrt utspel sänkte spelförarens stick = bättre försvar)\n` +
      `Riktning per ändrad giv: ${better} bättre (färre decl-stick), ${worse} sämre, ${changed - better - worse} lika\n\n` +
      rows.join('\n') +
      '\n'
    writeFileSync(process.env.TEMP + '/' + (process.env.LEADAB_OUT ?? 'leadab.txt'), report)
    // eslint-disable-next-line no-console
    console.log(report)
  },
)

afterEach(() => vi.restoreAllMocks())
