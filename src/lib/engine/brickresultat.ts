// Tävlings-UI-polish steg 6 — "traveller": hela fältets resultat på EN bricka.
//
// Alla spelare möter samma 12 givar. Efter att man spelat en giv vill man se hur
// de andra gjorde den: deras kontrakt, resultat och matchpoäng. Den här modulen
// räknar det RENT ur de lagrade raderna (N/S-poäng + auktionen) — servern
// (api-src/giv-resultat.ts) sköter I/O + namn, den här funktionen är matematiken.
//
// Ren logik utan I/O; facit testar den isolerat (brickresultat.test.ts).

import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { contractFromCalls } from './auction-live'
import { matchpointsForBoard } from './matchpoints'
import type { Strain } from './play'

/** Kompakt kontrakt + resultat (matchar klientens GivKontrakt). */
export interface KompaktKontrakt {
  level: number
  strain: Strain
  doubled?: 'X' | 'XX'
  declarer: Seat
  /** Spelförarens över-/understick mot kontraktet. */
  diff: number
}

/** En spelares rå rad på en bricka (som servern läser den ur daily_results). */
export interface Brickrad {
  spelare: string
  nsScore: number
  declarerTricks: number | null
  passedOut: boolean
  history: ResolvedCall[]
}

/** En spelares färdiga travellerpost på brickan. */
export interface Brickresultat {
  spelare: string
  /** Kontraktet spelaren nådde, eller null (utpassad giv). */
  kontrakt: KompaktKontrakt | null
  nsScore: number
  mp: number
  max: number
  procent: number
}

/** Bygg travellern: matchpoäng per spelare på brickan + varje spelares kontrakt.
 *  Sorterad på procent (bäst först). Ren aritmetik + auktionstolkning. */
export function byggBrickresultat(rader: Brickrad[]): Brickresultat[] {
  const mp = matchpointsForBoard(rader.map((r) => ({ spelare: r.spelare, poäng: r.nsScore })))
  return rader
    .map((r, i) => {
      let kontrakt: KompaktKontrakt | null = null
      if (!r.passedOut) {
        const c = contractFromCalls(r.history)
        if (c && r.declarerTricks != null) {
          kontrakt = {
            level: c.level,
            strain: c.strain,
            doubled: c.doubled,
            declarer: c.declarer,
            diff: r.declarerTricks - (6 + c.level),
          }
        }
      }
      return {
        spelare: r.spelare,
        kontrakt,
        nsScore: r.nsScore,
        mp: mp[i].mp,
        max: mp[i].max,
        procent: mp[i].procent,
      }
    })
    .sort((a, b) => b.procent - a.procent)
}
