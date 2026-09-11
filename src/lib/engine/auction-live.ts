// Logiklagret bakom budlådan i "Spela kort": en LEVANDE budgivning som växer ett
// bud i taget runt bordet, i stället för en färdiggenererad auktion.
//
// Fyra rena, testbara delar:
//   - legalCalls       – vilka bud som är tillåtna just nu (bridge-reglerna)
//   - auctionComplete  – är budgivningen slut (tre pass efter ett bud / passat ut)?
//   - contractFromCalls – slutkontraktet ur en färdig budföljd (spelförare m.m.)
//   - decideCall       – "bot-hjärnan": vad bjuder datorn på en plats just nu?
//
// `decideCall` frågar beslutstabellen (`auction-decide.ts`: egen hand +
// auktionen → ett bud, stol för stol) och vaktar budet mot bridge-reglerna.
// Täcker tabellen inte läget passar stolen. Det gamla manuslagret revs i
// motorbytets etapp 5 (2026-09-11); hela beslutet bor nu i tabellen.

import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { decideFromTable } from './auction-decide'
import { legalCalls } from './auction-rules'
import { isVulnerable } from './openings'
import { auctionFacts } from './auction-facts'

// ---- Bridge-reglerna ------------------------------------------------------
// Utbrutna till `auction-rules.ts` (etapp 4 familj 1, 2026-09-08) så att
// beslutstabellen och dess kunskapsmoduler når `legalCalls` utan att importera
// det gamla lagret. Re-exporteras här så budlådans användare inte märker det.
export { auctionComplete, legalCalls, seatToAct } from './auction-rules'

// ---- Slutkontraktet ur en färdig budföljd ---------------------------------

// EN sanningskälla: härledningen bor i auction-contract.ts (delas med
// `finalContract`). Re-exporteras här så budlådans användare (Play.tsx m.fl.)
// hittar den bland de övriga auktionsverktygen.
export { contractFromCalls } from './auction-contract'

// ---- Bot-hjärnan -----------------------------------------------------------
// `decideCall` frågar beslutstabellen (`auction-decide.ts`) stol för stol och
// vaktar dess bud mot bridge-reglerna. Det gamla manuslagret (`buildAuction`-
// linjen, detektorkedjan, `divergedFromLine`, `open`-flaggan) revs i motorbytets
// etapp 5 session B (2026-09-11): linjen byggdes ur tabellen, så den kunde aldrig
// ge något tabellen inte redan gett. Kvar: fakta → tabell → laglighetsvakt → pass.

export function decideCall(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall {
  return decideCallTraced(deal, history, seat).call
}

/**
 * Ett bud med sin KÄLLA — var i motorn beslutet togs. Motorbytets mätrigg
 * (docs/motorbyte-plan.md etapp 0): auktionsdumpen skriver källan per bud så
 * att diffen mellan två körningar visar inte bara ATT ett bud ändrats utan
 * vilken väg som tog det, och så att familjernas ordning i etapp 4 kan mätas
 * (hur ofta varje rad faktiskt avgör ett bud). Källorna (sedan etapp 5 rivningen):
 *   'tabell:<rad>'         beslutstabellen (auction-decide.ts) gav budet
 *   '<bud> → pass'         tabellraden gav ett OLAGLIGT bud → laglighetsvakten passade
 *   'pass (ingen regel)'   ingen rad täckte läget → stolen passar
 * Själva beslutet är oförändrat — `decideCall` är bara `.call` av detta.
 */
export interface TracedCall {
  call: ResolvedCall
  källa: string
}

export function decideCallTraced(deal: Deal, history: ResolvedCall[], seat: Seat): TracedCall {
  const pass: ResolvedCall = { seat, bid: 'P' }
  const hand = deal.hands[seat]
  const facts = auctionFacts(history, seat)

  // BESLUTSTABELLEN FÖRST (motorbytet etapp 3, docs/motorbyte-plan.md §2):
  // egen hand + auktionen hittills → ett bud, stol för stol. Täcker tabellen
  // läget avgörs budet här, utan manus och utan att någon annan hand finns
  // att läsa. Resten av funktionen är det gamla lagret, som rivs familj för
  // familj tills tabellen täcker allt.
  const tabell = decideFromTable(hand, facts, isVulnerable(seat, deal.vulnerability))
  if (tabell) {
    // Bridge-regeln vaktar tabellen: ett olagligt bud (kunskapsfunktionen
    // räknade inte med läget) blir pass med källan märkt, så att dumparna
    // avslöjar hålet i stället för att bordet kraschar.
    if (tabell.call.bid === 'P' || legalCalls(history, seat).includes(tabell.call.bid)) return tabell
    return { call: pass, källa: `${tabell.källa} (olagligt ${tabell.call.bid} → pass)` }
  }

  // Täcker tabellen inte läget passar stolen. Det gamla manuslagret
  // (`buildAuction`-linjen + detektorkedjan) är rivet sedan motorbytets etapp 5
  // session B (2026-09-11): linjen byggdes ur `decideFromTable` stol för stol, så
  // manuset kunde aldrig ge något tabellen inte redan gett — det fyllde bara pass.
  return { call: pass, källa: 'pass (ingen regel)' }
}
