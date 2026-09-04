// BESLUTSTABELLEN — steg 3 "val" i den nya beslutsfunktionen
// (docs/motorbyte-plan.md §2, etapp 3). Varje stol bjuder som en människa:
// EGEN hand + auktionen hittills → ett bud. Ingen annan hand finns att läsa här,
// och det är konstruktionen som garanterar ärlig inferens (kikvakten,
// `kikvakt.test.ts`, bevisar det för varje familj som flyttar in).
//
// Tabellen växer familj för familj (etapp 3: den ostörda linjen, etapp 4:
// konkurrensen). En rad = ett LÄGE (ett villkor på fakta ur `auction-facts.ts`)
// → en kunskapsfunktion (openings.ts, responses*.ts, rebids.ts …). Lägena ska
// vara exakta och inbördes uteslutande, så ordningen i tabellen är ointressant;
// första rad vars läge stämmer väljer budet. Stämmer ingen rad svarar tabellen
// null och det gamla lagret (manus + detektorer i `auction-live.ts`) tar vid —
// tills alla familjer flyttat och det lagret rivs (etapp 5).
//
// Familjer som flyttat in:
//   1. Öppningen (2026-09-04): ingen har öppnat → `classifyOpening` med
//      position 1–4 i varvet från given och stolens sårbarhet.

import type { Hand } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import type { AuctionFacts } from './auction-facts'
import { classifyOpening } from './openings'

/** Ett beslutat bud. `uncertain` följer med från kunskapsfunktionen (manusets `AuctionTurn` visar den). */
export interface DecidedCall extends ResolvedCall {
  uncertain?: boolean
}

/** Tabellens svar: budet + källan (`tabell:<familj>`, syns i auktionsdumpen). */
export interface Decision {
  call: DecidedCall
  källa: string
}

/** Allt en stol får veta: egen hand, auktionsläget (ur auktionen ensam) och sin sårbarhet. */
export interface Situation {
  hand: Hand
  facts: AuctionFacts
  vulnerable: boolean
}

interface Row {
  /** Familjens namn — blir källan `tabell:<id>`. */
  id: string
  /** Läget: när gäller raden? Bara fakta, aldrig handen. */
  läge: (f: AuctionFacts) => boolean
  /** Valet: kunskapsfunktionen som ger budet ur handen + läget. */
  välj: (s: Situation) => DecidedCall
}

/** Position i varvet från given (1:a–4:e hand) — bara meningsfull innan någon öppnat. */
function position(f: AuctionFacts): 1 | 2 | 3 | 4 {
  return (f.history.length + 1) as 1 | 2 | 3 | 4
}

const TABELL: Row[] = [
  // Familj 1 — öppningen. Ingen har öppnat (inga kontraktsbud; X/XX kan inte
  // komma före ett bud), så stolen är i öppningsposition. Positionen styr
  // lättöppningen i 3:e hand och regeln om 15 i 4:e (systemboken §3).
  {
    id: 'öppning',
    läge: (f) => f.opening === null,
    välj: ({ hand, facts, vulnerable }) => {
      const o = classifyOpening(hand, vulnerable, position(facts))
      return { seat: facts.seat, bid: o.call, rule: o.rule, explanation: o.explanation, uncertain: o.uncertain }
    },
  },
]

/**
 * Tabellens beslut för stolen i `facts.seat`, eller null när ingen rad täcker
 * läget än (då gäller det gamla lagret). Läser aldrig någon annan hand.
 */
export function decideFromTable(hand: Hand, facts: AuctionFacts, vulnerable: boolean): Decision | null {
  for (const row of TABELL) {
    if (!row.läge(facts)) continue
    return { call: row.välj({ hand, facts, vulnerable }), källa: `tabell:${row.id}` }
  }
  return null
}
