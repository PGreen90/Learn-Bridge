// SEN CUE EFTER DERAS 1NT-SVAR (felrapport #110, ägarens struktur 2026-11-10):
//
//   (1m) – pass – (1NT) – pass – (pass) – 2m – (pass) – ?
//
// Handen som passade över öppningen kommer tillbaka med en cue i öppnarens
// lågfärg när de stannat i 1NT. En 5-5-hand hade bjudit Michaels direkt, så
// den sena cuen lovar BÅDA HÖGFÄRGERNA, MINST 4-4, och 13+ hp.
//   • Advancern får ALDRIG passa: preferens på 2-läget till den längre
//     högfärgen (lika längd → hjärter, den billigare). Avslut, kan vara 0 poäng.
//     INGET spärrhopp — partnern kan ha bara fyra kort.
//   • Cue 3m = 8+ hp och 3+ stöd i en högfärg: utgångsintresse, krav.
//   • Gäller lika efter 1♣ och 1♦.
// Fortsättningen efter cuen är min tolkning tills ägaren sagt annat (flaggad i
// rapporten): inklivaren 13–14 → 3♥ (minimum, säger inget om högfärgerna),
// 15+ → 3♠ (maximum, utgångskrav); advancern placerar i sin fit. Inklivaren
// passar den tvingade preferensen.
// Ärlig inferens: bara egen hand + auktionen. Blandar sig motståndarna i efter
// cuen svarar modulen null (övriga regler gäller).

import type { Bid, Hand, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { PARTNER, type AuctionFacts } from './auction-facts'
import { legalCalls } from './auction-rules'
import { hcp, lengths } from './hand'
import type { Kunskap } from './overcall-continuations'
import { side } from './play'

/** Ägarens trösklar 2026-11-10 (hp). `max`/`utgangMotMin` är motorns tolkning. */
export const SEN_CUE = {
  golv: 13, // cuen lovar 13+ hp
  cue: 8, // advancerns cue: 8+ hp med 3+ stöd
  max: 15, // inklivaren efter cuen: 15+ = maximum (utgångskrav)
  utgangMotMin: 12, // advancern bjuder utgång även mot minimum
} as const

export interface SenCueLage {
  ink: Seat
  adv: Seat
  /** Deras lågfärg som bokstav ('C' / 'D'). */
  theirL: 'C' | 'D'
  /** Vår sidas bud efter cuen, i ordning (advancern först). */
  ours: ResolvedCall[]
  /** Har motståndarna bjudit något annat än pass efter cuen? */
  stort: boolean
}

/** Läser läget ur en ren historik (delas med betydelselagret). `forSeat` = den som frågar. */
export function senCueLage(history: ResolvedCall[], forSeat: Seat): SenCueLage | null {
  const start = history.findIndex((c) => c.bid !== 'P')
  if (start < 0 || history.length < start + 6) return null
  const [o, p1, r, p2, p3, cue] = history.slice(start, start + 6)
  if (o.bid !== '1C' && o.bid !== '1D') return null
  if (p1.bid !== 'P' || r.bid !== '1NT' || p2.bid !== 'P' || p3.bid !== 'P') return null
  if (cue.bid !== `2${o.bid[1]}`) return null
  if (side(cue.seat) !== side(forSeat)) return null
  const tail = history.slice(start + 6)
  return {
    ink: cue.seat,
    adv: PARTNER[cue.seat],
    theirL: o.bid[1] as 'C' | 'D',
    ours: tail.filter((c) => side(c.seat) === side(forSeat)),
    stort: tail.some((c) => side(c.seat) !== side(forSeat) && c.bid !== 'P'),
  }
}

const SYM: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' }
const NAMN: Record<'hearts' | 'spades', string> = { hearts: 'hjärter', spades: 'spader' }
const L: Record<'hearts' | 'spades', string> = { hearts: 'H', spades: 'S' }

/** Advancerns fit: den längre högfärgen, lika → hjärter (den billigare). */
function fit(hand: Hand): 'hearts' | 'spades' {
  const len = lengths(hand)
  return len.spades > len.hearts ? 'spades' : 'hearts'
}

/** Ingången från raden *sen-cue*. null → övriga regler. */
export function senCueContinues(hand: Hand, f: AuctionFacts): Kunskap | null {
  const l = senCueLage(f.history, f.seat)
  if (!l || l.stort) return null
  const p = hcp(hand)
  const legal = legalCalls(f.history, f.seat)
  const n = l.ours.length
  const cue = `3${l.theirL}`
  const pass = (rule: string, explanation: string): Kunskap => ({ call: 'P', rule, explanation })

  if (f.seat === l.adv) {
    const s = fit(hand)
    const len = lengths(hand)
    if (n === 0) {
      if (p >= SEN_CUE.cue && len[s as Suit] >= 3 && legal.includes(cue as Bid)) {
        return { call: cue, rule: 'advance sen cue: cue (utgångsintresse)', explanation: `${SEN_CUE.cue}+ hp och 3+ stöd i en av partnerns högfärger → cue 3${SYM[l.theirL]}: utgångsintresse, krav. Partnern visar minimum eller maximum.` }
      }
      const pref = `2${L[s]}`
      return { call: pref, rule: 'advance sen cue: preferens', explanation: `Partnerns sena cue visar båda högfärgerna (minst 4-4, ${SEN_CUE.golv}+ hp) och får inte passas → preferens till ${NAMN[s]} på lägsta nivå, 2${SYM[L[s]]} (avslut; lika längd → hjärter).` }
    }
    if (n === 2 && l.ours[0].bid === cue) {
      const svar = l.ours[1].bid
      const utgang = `4${L[s]}`
      if (svar === '3S' && legal.includes(utgang as Bid)) {
        return { call: utgang, rule: 'sen cue: utgång efter cue', explanation: `Partnern visade maximum (${SEN_CUE.max}+ hp) → 4${SYM[L[s]]} i min fit.` }
      }
      if (svar === '3H') {
        if (p >= SEN_CUE.utgangMotMin && legal.includes(utgang as Bid)) {
          return { call: utgang, rule: 'sen cue: utgång efter cue', explanation: `Partnern visade minimum, men ${SEN_CUE.utgangMotMin}+ hp och fit → 4${SYM[L[s]]}.` }
        }
        return s === 'hearts'
          ? pass('sen cue: stannar efter cue', 'Partnern visade minimum och budet ligger i min fit → pass.')
          : { call: '3S', rule: 'sen cue: stannar efter cue', explanation: 'Partnern visade minimum; min fit är spader → 3♠ (till spel).' }
      }
      return null
    }
    return null
  }

  if (f.seat === l.ink) {
    if (n === 1) {
      const a = l.ours[0].bid
      if (a === cue) {
        return p >= SEN_CUE.max
          ? { call: '3S', rule: 'sen cue: maximum efter cue', explanation: `Partnerns cue frågar efter styrkan: ${SEN_CUE.max}+ hp → 3♠ (maximum, utgångskrav — partnern väljer utgång i sin fit).` }
          : { call: '3H', rule: 'sen cue: minimum efter cue', explanation: `Partnerns cue frågar efter styrkan: ${SEN_CUE.golv}–${SEN_CUE.max - 1} hp → 3♥ (minimum; säger inget om vilken högfärg som är bäst).` }
      }
      if (a === '2H' || a === '2S') {
        return pass('sen cue: passar avslutet', 'Partnerns preferens var tvingad och kan vara 0 poäng → pass.')
      }
      return null
    }
    // Senare turer: partnern har placerat kontraktet → pass.
    if (n >= 2 && l.ours[0].bid === cue && /^[34][HS]$/.test(l.ours[n - 1].bid)) {
      return pass('pass', 'Partnern har placerat kontraktet → pass.')
    }
  }
  return null
}
