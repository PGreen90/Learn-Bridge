// Tävlings-UI-polish steg 6 — "traveller": hela fältets resultat på EN bricka.
//
// Alla spelare möter samma 12 givar. Efter att man spelat en giv vill man se hur
// de andra gjorde den: deras kontrakt, resultat och matchpoäng. Den här modulen
// räknar det RENT ur de lagrade raderna (N/S-poäng + auktionen) — servern
// (api-src/giv-resultat.ts) sköter I/O + namn, den här funktionen är matematiken.
//
// Ren logik utan I/O; facit testar den isolerat (brickresultat.test.ts).

import type { Card, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { contractFromCalls } from './auction-live'
import { strategiFor, type Givtal, type TavlingsForm } from './matchpoints'
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
  /** Spelarens spelade kort i ordning (ur payload). Tom/saknad om okänd. */
  plays?: Card[]
}

/** En spelares färdiga travellerpost på brickan. Talet på brickan följer
 *  tävlingsformen (Dagens IMP, 2026-09-26): MP ger mp/max/procent, IMP ger imp;
 *  `tal` finns alltid (det som sorterar). */
export type Brickresultat = Givtal & {
  spelare: string
  /** Kontraktet spelaren nådde, eller null (utpassad giv). */
  kontrakt: KompaktKontrakt | null
  nsScore: number
  /** Påbyggnad 3 (2026-09-13): auktionen (kompakt, utan förklaringstext) +
   *  spelade kort + spelförarstick, så vem som helst kan stega igenom hur
   *  spelaren bjöd och spelade given. */
  history: ResolvedCall[]
  plays: Card[]
  declarerTricks: number | null
}

/** Auktionen i kompakt form: säte + bud + regelnamn (för ALERT) — aldrig den
 *  lagrade förklaringstexten (byggd av spelarens hand; klienten tolkar om
 *  systemiskt ur auktionen). Tål trasig indata → tom lista. */
export function kompaktHistorik(history: ResolvedCall[] | undefined): ResolvedCall[] {
  if (!Array.isArray(history)) return []
  return history.map((c) => (c.rule ? { seat: c.seat, bid: c.bid, rule: c.rule } : { seat: c.seat, bid: c.bid }))
}

/** Bygg travellern: talet per spelare på brickan (MP% eller cross-IMP efter
 *  `form`, default MP) + varje spelares kontrakt. Sorterad på talet (bäst
 *  först). Ren aritmetik + auktionstolkning. */
export function byggBrickresultat(rader: Brickrad[], form: TavlingsForm = 'mp'): Brickresultat[] {
  const utfall = strategiFor(form).perGiv(rader.map((r) => ({ spelare: r.spelare, poäng: r.nsScore })))
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
      const { spelare: _spelare, ...tal } = utfall[i]
      return {
        ...tal,
        spelare: r.spelare,
        kontrakt,
        nsScore: r.nsScore,
        history: kompaktHistorik(r.history),
        plays: Array.isArray(r.plays) ? r.plays : [],
        declarerTricks: r.declarerTricks,
      }
    })
    .sort((a, b) => b.tal - a.tal)
}
