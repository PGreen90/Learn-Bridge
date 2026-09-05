// KIKVAKTEN (motorbytet, docs/motorbyte-plan.md §2): ärlig inferens bevisad
// av maskinen. Ett beslut får bara bero på EGEN hand + auktionen hittills.
//
// Två delar:
//   (1) Betydelselagret — `meaningOf(history, index)` tar ingen giv alls, så
//       vakten är trivial: den låser signaturen och kör lagret över ett brett
//       fält auktioner för att visa att det aldrig behöver en hand (och aldrig
//       kastar). Byggd i etapp 1.
//   (2) Beslutsfunktionen — `decideCall(deal, history, seat)` ska ge SAMMA bud
//       när de tre andra händerna byts mot slumpkort. Skarp FAMILJ FÖR FAMILJ
//       under etapp 3 (familj 1 öppningsvarvet sedan 2026-09-04); hela
//       auktionen (`it.todo`) när etapp 3 är klar. Tills dess finns MÄTLÄGET
//       som visar hur ofta dagens manus-motor byter bud när de andra händerna
//       byts — det är måttet på hur mycket manuset "kikar":
//
//   $env:KIKVAKT='1'; npx vitest run src/lib/engine/kikvakt.test.ts
//   $env:KIKVAKT_RANGE='20270001-20270300'   (standard)
//   Utdata: revisor-output/kikvakt.txt
import { describe, expect, it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import type { Card, Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { meaningOf } from './auction-meaning'
import { decideCallTraced } from './auction-live'
import { mulberry32 } from './deal'
import { botAuction, dealFromSeed } from './revisor'

const SEATS: Seat[] = ['N', 'E', 'S', 'W']

/** Given med `seat`s hand orörd och de tre andra händerna slumpade om ur samma 39 kort. */
function omgivnaAndra(deal: Deal, seat: Seat, rng: () => number): Deal {
  const andra = SEATS.filter((s) => s !== seat)
  const kort: Card[] = andra.flatMap((s) => deal.hands[s])
  for (let i = kort.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[kort[i], kort[j]] = [kort[j], kort[i]]
  }
  const hands = { ...deal.hands }
  andra.forEach((s, k) => {
    hands[s] = kort.slice(k * 13, k * 13 + 13)
  })
  return { ...deal, hands }
}

describe('kikvakten (1): betydelselagret läser bara auktionen', () => {
  it('meaningOf tar (history, index) — ingen giv, ingen hand', () => {
    expect(meaningOf.length).toBe(2)
  })

  it('ger en betydelse för varje bud i 300 botauktioner utan att se en enda hand', () => {
    for (let seed = 20270001; seed <= 20270300; seed++) {
      const history = botAuction(dealFromSeed(seed))
      if (!history) continue
      // Regeln bortskalad = människans bud: betydelsen ska ändå finnas.
      const nakna = history.map((c) => ({ seat: c.seat, bid: c.bid }) as ResolvedCall)
      nakna.forEach((_, i) => {
        const m = meaningOf(nakna, i)
        expect(m.text.length).toBeGreaterThan(0)
        expect(m.källa).toBe('härledd')
      })
    }
  })
})

describe('kikvakten (2): beslutet läser bara egen hand + auktionen', () => {
  it.todo('decideCall ger samma bud när de tre andra händerna byts mot slumpkort (skarp för HELA auktionen när etapp 3 är klar)')

  // Skarp familj för familj (etapp 3): varje bud beslutstabellen tagit över
  // (källa `tabell:<familj>`) ska överleva att de andra händerna byts — och
  // tabellen ska svara likadant (samma källa) med de bytta händerna. Testet
  // växer av sig självt när nya rader läggs till: varje bud med källa
  // tabell:* i botauktionerna prövas (familj 1 öppningsvarvet, familj 2 svaret, …).
  it('tabellens bud: samma bud och källa när de tre andra händerna byts (300 givar)', () => {
    let bud = 0
    const perKälla = new Map<string, number>()
    for (let seed = 20270001; seed <= 20270300; seed++) {
      const deal = dealFromSeed(seed)
      const history = botAuction(deal)
      if (!history) continue
      for (let i = 0; i < history.length; i++) {
        const seat = history[i].seat
        const ursprung = decideCallTraced(deal, history.slice(0, i), seat)
        if (!ursprung.källa.startsWith('tabell:')) continue // det gamla lagret (t.ex. motståndarnas pass) mäts i mätläget
        const annan = decideCallTraced(omgivnaAndra(deal, seat, mulberry32(seed * 64 + i)), history.slice(0, i), seat)
        expect(annan.källa, `frö ${seed} bud ${i + 1}`).toBe(ursprung.källa)
        expect(annan.call.bid, `frö ${seed} bud ${i + 1}`).toBe(history[i].bid)
        bud++
        perKälla.set(ursprung.källa, (perKälla.get(ursprung.källa) ?? 0) + 1)
      }
    }
    expect(bud).toBeGreaterThan(300)
    expect(perKälla.get('tabell:öppning') ?? 0).toBeGreaterThan(200)
    expect(perKälla.get('tabell:svar') ?? 0).toBeGreaterThan(100)
    expect(perKälla.get('tabell:slam') ?? 0).toBeGreaterThan(0) // familj 5: slamsekvensernas turer
    expect(perKälla.get('tabell:svar3') ?? 0).toBeGreaterThan(0)
  })

  it.skipIf(process.env.KIKVAKT !== '1')('MÄTLÄGE: hur ofta byter dagens motor bud när de andra händerna byts?', { timeout: 0 }, () => {
    const m = /^(\d+)-(\d+)$/.exec(process.env.KIKVAKT_RANGE ?? '20270001-20270300')!
    const [från, till] = [Number(m[1]), Number(m[2])]
    const perKälla = new Map<string, { lika: number; olika: number; exempel?: string }>()
    let bud = 0
    let olika = 0
    for (let seed = från; seed <= till; seed++) {
      const deal = dealFromSeed(seed)
      const history = botAuction(deal)
      if (!history) continue
      history.forEach((call, i) => {
        const seat = call.seat
        const ursprung = decideCallTraced(deal, history.slice(0, i), seat)
        const rng = mulberry32(seed * 64 + i)
        const annan = decideCallTraced(omgivnaAndra(deal, seat, rng), history.slice(0, i), seat)
        const k = perKälla.get(ursprung.källa) ?? { lika: 0, olika: 0 }
        bud++
        if (annan.call.bid === call.bid) k.lika++
        else {
          k.olika++
          olika++
          k.exempel ??= `frö ${seed} bud ${i + 1}: ${seat} ${call.bid} [${call.rule ?? '—'}] → ${annan.call.bid} [${annan.call.rule ?? '—'}] <${annan.källa}>`
        }
        perKälla.set(ursprung.källa, k)
      })
    }
    const rader = [
      `KIKVAKTEN, mätläge — frön ${från}–${till}: ${bud} bud, ${olika} byter bud när de andra händerna byts (${((100 * olika) / Math.max(1, bud)).toFixed(1)} %)`,
      '',
      'Per källa (var beslutet togs i dagens motor): lika / olika',
      ...[...perKälla]
        .sort((a, b) => b[1].olika - a[1].olika)
        .map(([källa, k]) => `  ${källa.padEnd(48)} ${String(k.lika).padStart(6)} / ${String(k.olika).padStart(5)}${k.exempel ? `   t.ex. ${k.exempel}` : ''}`),
    ]
    mkdirSync('revisor-output', { recursive: true })
    writeFileSync('revisor-output/kikvakt.txt', rader.join('\n'), 'utf8')
  })
})
