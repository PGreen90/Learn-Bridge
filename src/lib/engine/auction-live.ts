// Logiklagret bakom budlådan i "Spela kort": en LEVANDE budgivning som växer ett
// bud i taget runt bordet, i stället för en färdiggenererad auktion.
//
// Fyra rena, testbara delar:
//   - legalCalls       – vilka bud som är tillåtna just nu (bridge-reglerna)
//   - auctionComplete  – är budgivningen slut (tre pass efter ett bud / passat ut)?
//   - contractFromCalls – slutkontraktet ur en färdig budföljd (spelförare m.m.)
//   - decideCall       – "bot-hjärnan": vad bjuder datorn på en plats just nu?
//
// `decideCall` frågar FÖRST beslutstabellen (`auction-decide.ts`: egen hand +
// auktionen → ett bud, motorbytet etapp 3). Täcker tabellen inte läget tar det
// gamla lagret vid: manusets konkurrensrond (`buildAuction`, spelas upp bud
// för bud så länge historiken följer den) och detektorkedjan. Sedan familj 6
// (2026-09-05) avgör manuset inga bud i ostörda auktioner — bara `open`.

import type { Deal, Hand, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { buildAuction } from './auction'
import { decideFromTable } from './auction-decide'
import { turnsToCalls } from './auction-contract'
import { legalCalls } from './auction-rules'
import { isVulnerable } from './openings'
import { auctionFacts, type AuctionFacts } from './auction-facts'

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

// ---- Tvåfärgsinkliv (Michaels / ovanlig 2NT, §7.2) i den levande auktionen --

/**
 * Är `bid` ett TVÅFÄRGSINKLIV över motståndarnas 1-lägesöppning i `openStrain`?
 * Michaels-cue = 2 i DERAS färg; ovanlig 2NT = 2NT. Båda är konstgjorda och
 * lovar 5-5 i två ANDRA färger.
 */

// ---- (Off-book-svaren flyttade till beslutstabellen, motorbytet slutkärnan) -
// `offBookResponse`/`honorForce` är sedan etapp 5 familj 3 (2026-09-11) raderna
// *partner-färg* / *krav-minimibud* SIST i tabellen (`auction-decide.ts`),
// gatade med faktumet `!partnerSignedOff` i stället för manusets `built.open`.
// Kunskapen bor i `balancing-continuations.ts` (`partnerSuitResponse`),
// `fit-raise.ts` (`raiseWithFit`) och `catch-all-continuations.ts`
// (`forcedMinimumBid`). CONTESTED_DETECTORS är därför tom.

// ---- Bot-hjärnan -----------------------------------------------------------

/**
 * Har den VERKLIGA budföljden lämnat den kanoniska systemlinjen? Den jämförs
 * bud för bud så långt de överlappar; en motsägelse (Syd bjöd något annat än
 * linjen) = off-book. Att historiken bara är LÄNGRE än linjen (de avslutande
 * passen i en färdig auktion) räknas INTE som off-book – men ett RIKTIGT bud
 * bortom linjens slut (t.ex. en balansering där modellen trodde given passades
 * ut, felrapport #5) gör det: då gäller linjen inte längre.
 */
function divergedFromLine(history: ResolvedCall[], line: ResolvedCall[]): boolean {
  const overlap = Math.min(history.length, line.length)
  for (let i = 0; i < overlap; i++) {
    if (history[i].bid !== line[i].bid) return true
  }
  for (let i = line.length; i < history.length; i++) {
    if (history[i].bid !== 'P') return true
  }
  return false
}

// ---- F2: den datadrivna detektorkedjan -------------------------------------
// Kedjan i decideCall var tidigare två listor av anonyma funktioner där
// ordningskraven ("måste ligga FÖRE …") bara fanns i kommentarer. Nu är varje
// detektor DATA med ett unikt `id` och sina före-krav i `before`; kedjevakten
// `detector-chain.test.ts` gör sviten röd om en omflyttning bryter ett krav.
// Själva budlogiken är oförändrad — run-funktionerna är samma anrop som förr.

/** Allt en detektor behöver veta om läget — räknas fram EN gång per beslut. */
export interface DetectorCtx {
  deal: Deal
  history: ResolvedCall[]
  seat: Seat
  /** Egen hand (`deal.hands[seat]`), förberäknad. */
  hand: Hand
  /** Auktionsläget (faktalagret, etapp 2) – räknas EN gång per beslut. */
  facts: AuctionFacts
}

/** Ett steg i detektorkedjan: namn + ordningskrav + själva logiken. */
export interface LiveDetector {
  /** Unikt namn, normalt = detektorfunktionens namn. Används i före-kraven. */
  id: string
  /** Id:n som måste ligga SENARE i kedjan än den här (vaktas av kedjevakten). */
  before?: readonly string[]
  run: (c: DetectorCtx) => ResolvedCall | null
}

// ---- Tvingande svar (gäller ÄVEN on-book) ----------------------------------
// Linjen gav inget bud för oss här. Vissa lägen är ändå rondkrav: partnern får
// ALDRIG lämnas att passa bort en upplysning/fjärde färg. Prövas i ordning;
// första detektorn som ger ett lagligt bud vinner.
export const FORCED_DETECTORS: readonly LiveDetector[] = [
  // (TOM sedan motorbytet etapp 5 familj 2, 2026-09-10.) Min egen fjärde färg
  // (§6.6) placeras nu i beslutstabellen (raden *fjärde-färg-placering*);
  // partnerns fjärde färg / NMF besvaras i raden *tredje*; §7.6-försvaret mot
  // deras svaga tvåa/spärr i raden *försvar-svag2* (familj 7). Inga tvingande
  // svar återstår i det gamla lagret.
]

// ---- Historiedrivna svar när linjen inte styr längre -----------------------
// Off-book (Syd bjöd eget) eller en öppen konkurrensauktion som linjen bara
// modellerat en rond av. ORDNINGEN ÄR BETYDELSEFULL: flera steg måste ligga
// FÖRE det generella off-book-svaret näst sist (annars läser det ett konstgjort
// relä/cue som en naturlig färg och stöder/passar fel). Ordningskraven står som
// DATA i `before` och vaktas av kedjevakten — en ny konvention läggs på rätt
// plats i listan MED sina före-krav ifyllda, inte sist av bekvämlighet.
export const CONTESTED_DETECTORS: readonly LiveDetector[] = [
  // (DONT-försvaret mot deras 1NT + advancern/rättelsen flyttade till
  // beslutstabellen, raderna *försvar-1nt* / *dont-advance*, motorbytet etapp 4
  // familj 6, 2026-09-09.)
  // (Essfrågan 4NT/5NT, rättelsen över stoppet och 3NT-stoppen flyttade till
  // beslutstabellen, raden *slam-forts*, motorbytet etapp 4 familj 8.)
  // (Straffdubblingen av deras höga färgkontrakt (felrapport #13-transfern med
  // dess utgångsval, och 2/1-utgången efter höjt fritt bud, felrapport #27)
  // flyttade till beslutstabellen — raderna *straff-x*/*transfer-utgång*/
  // *2/1-utgång*, motorbytet etapp 5 familj 2, 2026-09-10.)
  // (Öppnarens återbud efter partnerns 2-över-1 (felrapport #58), svararens
  // placering efter NMF-svaret (§5.7), svaret på 2♣–2♦–2NT, och hela
  // off-book-sangsystemet (felrapport #41) besvaras nu i beslutstabellen
  // (raderna *återbud*/*tredje*/*svar2*/*svar*): de gamla detektorerna fyrade
  // aldrig längre (auktions- och avvikelsedump 0), rivna motorbytet etapp 5.)
  // (Kaptenens kvantitativa höjning av partnerns naturliga 3NT till 6NT,
  // felrapport #42, flyttade till beslutstabellen, raden *slam-forts*,
  // motorbytet etapp 4 familj 8.)
  // (Det generella off-book-svaret `offBookResponse` och kravvakten `honorForce`
  // flyttade till beslutstabellen som raderna *partner-färg* / *krav-minimibud*
  // SIST, gatade med faktumet `!partnerSignedOff`, motorbytet etapp 5 familj 3,
  // 2026-09-11. CONTESTED_DETECTORS är därför TOM — listan och grinden nedan
  // står kvar till session B, då manuset rivs; de kan då bara ge pass.)
]

export function decideCall(deal: Deal, history: ResolvedCall[], seat: Seat): ResolvedCall {
  return decideCallTraced(deal, history, seat).call
}

/**
 * Ett bud med sin KÄLLA — var i motorn beslutet togs. Motorbytets mätrigg
 * (docs/motorbyte-plan.md etapp 0): auktionsdumpen skriver källan per bud så
 * att diffen mellan två körningar visar inte bara ATT ett bud ändrats utan
 * vilken väg som tog det, och så att familjernas ordning i etapp 4 kan mätas
 * (hur ofta varje detektor faktiskt avgör ett bud). Källorna:
 *   'tabell:<familj>'      beslutstabellen (auction-decide.ts) — den nya motorn
 *   'ingen öppning'        ingen stol öppnar → alla passar
 *   'manus'                budet lästes ur `buildAuction`-linjen
 *   'väckning'             linjens pass byttes mot väckning efter spärrhöjning
 *   'konkurrens-slam'      competitiveRKCPlace/competitiveSlamTry
 *   'detektor:<id>'        en detektor i FORCED_/CONTESTED_DETECTORS
 *   'pass (ingen regel)'   ingen regel hade något att säga
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

  const built = buildAuction(deal)
  if (!built) return { call: pass, källa: 'ingen öppning' } // ingen öppnar given → alla passar

  const line = turnsToCalls(built.turns, deal.dealer)
  const offBook = divergedFromLine(history, line)
  const c: DetectorCtx = { deal, history, seat, hand, facts }

  // Följ linjen så länge den verkliga budföljden inte motsagt den. (Försvaret
  // mot deras spärrhöjning — förr en väckning som bröt linjens inbakade pass —
  // är sedan familj 7 en tabellrad som frågas FÖRST, ovan.)
  if (!offBook) {
    const next = line[history.length]
    if (next && next.seat === seat) {
      return { call: next, källa: 'manus' }
    }
  }

  // (Konkurrens-slaminvitet — etapp 7 hål D — är sedan etapp 4 familj 1 en
  // tabellrad, `konkurrens-slam`, med samma företräde som steget hade här.
  // Dubblingsfamiljen — svaret på X, dubblarens vakter, det starka X-flödet —
  // är sedan etapp 4 familj 2 raderna *dubbling*/*x-svar*/*x-dubblaren*/
  // *x-advancern*, med samma företräde som detektorerna hade.)

  // Tvingande svar — gäller ÄVEN on-book (kedjan FORCED_DETECTORS ovan).
  for (const d of FORCED_DETECTORS) {
    const call = d.run(c)
    if (call) return { call, källa: `detektor:${d.id}` }
  }

  // Konkurrenskedjan CONTESTED_DETECTORS — bara när linjen inte styr längre:
  // off-book, eller en ÖPPEN auktion som linjen bara modellerat en rond av.
  const lineExhaustedOpen = !offBook && history.length >= line.length && built.open
  if (offBook || lineExhaustedOpen) {
    for (const d of CONTESTED_DETECTORS) {
      const call = d.run(c)
      if (call) return { call, källa: `detektor:${d.id}` }
    }
  }

  return { call: pass, källa: 'pass (ingen regel)' }
}
