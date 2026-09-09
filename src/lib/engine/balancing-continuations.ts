// BALANSERING OCH ÅTERÖPPNING — advancerns, öppnarens och svararens fortsättning
// när motståndarna KONKURRERAT vidare (deras dubbling eller höjning), plus den
// passade svararens svar på öppnarens ANDRA (återöppnings-)dubbling. Motorbytets
// etapp 4 familj 5 (2026-09-09). Kunskapsfunktioner för beslutstabellen
// (`auction-decide.ts`): EGEN hand + auktionsläget (`AuctionFacts`, läst ur
// auktionen ensam) → ett bud, eller null när regeln inte gäller läget. Ingen
// annan hand finns att läsa här.
//
// Kärnan är det gamla lagrets catch-all `offBookResponse` ("partnern visade en
// färg → höj med fit / egen färg / sang"), MEN bara för de lägen kartan gav
// familj 5: advancern och öppnaren/svararen efter att MOTSTÅNDARNA konkurrerat.
// Den rena advancern utan konkurrens (RHO passade) och de djupa OSTÖRDA resterna
// lämnas kvar i `offBookResponse` tills senare familjer. Höjningskunskapen
// (`raiseWithFit`, fit-raise.ts) och den svarslösa "egen färg / sang"-logiken
// (`respondWithoutFit` nedan, ordagrant flyttad ur `offBookResponse`) är
// oförändrad — bara formen är tabellens (hand + fakta) och lägena avgränsade.

import type { Bid, Hand } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseContractBid, PARTNER, SUIT_OF_LETTER, SUIT_STRAINS, type AuctionFacts } from './auction-facts'
import { cheapestBidIn, legalCalls, SWE_SYM } from './auction-rules'
import { answerReopeningDoubleCore } from './contested-continuations'
import { raiseWithFit } from './fit-raise'
import { hcp, isBalanced, lengths } from './hand'
import { asCall } from './overcall-continuations'
import { side } from './play'

/**
 * Står partnerns SENASTE kontraktsbud utgång eller högre, obestritt? Då hittar vi
 * inte på en "höjning"/flykt till en annan strain (5♣-ryckaren). Ordagrant ur
 * `offBookResponse` (auction-live.ts).
 */
function partnerGameBidStandsUnopposed(history: ResolvedCall[], seat: AuctionFacts['seat']): boolean {
  let partnerGameAt = -1
  for (const [idx, c] of history.entries()) {
    if (c.seat !== PARTNER[seat]) continue
    const cb = parseContractBid(c.bid)
    if (!cb) continue
    const trickScore = cb.level * (cb.strain === 'C' || cb.strain === 'D' ? 20 : 30) + (cb.strain === 'NT' ? 10 : 0)
    partnerGameAt = trickScore >= 100 ? idx : -1
  }
  if (partnerGameAt < 0) return false
  return !history.some((c, idx) => idx > partnerGameAt && side(c.seat) !== side(seat) && parseContractBid(c.bid))
}

/**
 * Inget fit för partnern: bjud en egen 4+ färg (billigaste läge) eller en
 * balanserad sang. Ordagrant flyttad ur `offBookResponse` (auction-live.ts),
 * men som ren funktion av hand + fakta. Bara när partnern redan bjudit (vår
 * sidas auktion) – vi hittar inte på inkliv från intet här.
 */
function respondWithoutFit(
  hand: Hand,
  f: AuctionFacts,
  partnerSuit: { strain: string; level: number },
): ResolvedCall | null {
  const { history, seat } = f
  const points = hcp(hand)
  if (points < 6) return null // för svagt för att svara
  const len = lengths(hand)

  // (1) Egen 4+ färg – välj längst, sedan billigast. Ny färg = inte partnerns,
  // inte motståndarnas, inte en vi redan bjudit.
  const candidates = SUIT_STRAINS.filter((st) => {
    if (st === partnerSuit.strain) return false
    if (f.theirStrains.has(st)) return false
    if (history.some((c) => c.seat === seat && parseContractBid(c.bid)?.strain === st)) return false
    return len[SUIT_OF_LETTER[st]] >= 4
  }).sort((a, b) => {
    const byLen = len[SUIT_OF_LETTER[b]] - len[SUIT_OF_LETTER[a]]
    if (byLen !== 0) return byLen
    return SUIT_STRAINS.indexOf(a) - SUIT_STRAINS.indexOf(b) // 4-4: billigast först
  })
  for (const st of candidates) {
    const bid = cheapestBidIn(history, seat, st)
    if (!bid) continue
    const level = Number(bid[0])
    if (level === 1 && points >= 6) {
      return { seat, bid, explanation: `Egen färg ${SWE_SYM[st]} (4+ kort) – naturligt svar utan stöd för partnern.` }
    }
    if (level === 2 && points >= 12) {
      return { seat, bid, explanation: `Egen färg ${SWE_SYM[st]} på 2-läget – 4+ kort och utgångsvärden.` }
    }
  }

  // (2) Balanserad sang – bara i en HELT ostörd auktion (ingen motståndare har
  // sagt ett ljud, dubbling inräknad). Familj 5:s catch-all används alltid i
  // konkurrens (advancern/öppnaren/svararen efter deras aktion), så den här
  // grenen tänder aldrig här — en naturlig sang i konkurrens ägs av det gamla
  // lagrets sang-/NT-återbudsdetektorer (offBookResponse-porten hade `opponentsHaveBid`
  // som inte räknade en ren dubbling, och bjöd då 3NT i en dubblad auktion).
  const untouched = !f.history.some((c) => side(c.seat) !== side(f.seat) && c.bid !== 'P')
  if (untouched && isBalanced(hand)) {
    const ntLevel = points >= 13 ? 3 : points >= 11 ? 2 : 1
    const bid = `${ntLevel}NT` as Bid
    if (legalCalls(history, seat).includes(bid)) {
      const range = ntLevel === 1 ? '6–10 hp' : ntLevel === 2 ? '11–12 hp' : '13+ hp'
      return { seat, bid, explanation: `${ntLevel} sang – balanserad hand (${range}), inget stöd för partnern.` }
    }
  }
  return null
}

/**
 * Har motståndarna KONKURRERAT (dubblat eller bjudit igen) EFTER partnerns
 * första kontraktsbud (inklivet / öppningen)? Det är familj 5:s gräns: den rena
 * advancern/svararen utan konkurrens (RHO passade) ligger kvar i det gamla
 * lagret tills senare familjer.
 */
function opponentsCompetedAfter(f: AuctionFacts, ourFirst: ResolvedCall): boolean {
  const idx = f.history.indexOf(ourFirst)
  if (idx < 0) return false
  return f.history.slice(idx + 1).some((c) => side(c.seat) !== side(f.seat) && c.bid !== 'P')
}

// Artificiella krav som ÄGS av det gamla lagrets FORCED-detektorer
// (fourthSuitToAnswer / placeGameAfterFourthSuit / nmfToAnswer /
// nmfPlacementToAnswer). De körs EFTER tabellen, så en generell "höj partnerns
// färg" i öppnaren-/svararen-stört får inte kapa dem: partnerns senaste färg är
// då konstlad (fjärde färg) och ska besvaras/placeras, inte höjas som trumf.
const ARTIFICIAL_FORCE_RULES = new Set(['fjärde färg krav', 'New Minor Forcing'])

/**
 * Väntar ett artificiellt krav på svar/placering (fjärde färg eller NMF, av mig
 * eller partnern)? Då lämnar vi beslutet åt det gamla lagrets FORCED-detektorer,
 * precis som förr (offBookResponse låg efter dem i kedjan). Läser regeln ur
 * BETYDELSELAGRET (auktionen ensam), inte ur cachen.
 */
function outstandingArtificialForce(f: AuctionFacts): boolean {
  const { history } = f
  const myLast = [...f.ourContractBids].reverse().find((c) => c.seat === f.seat)
  const partnerLast = [...f.ourContractBids].reverse().find((c) => c.seat === f.partner)
  for (const c of [myLast, partnerLast]) {
    if (!c) continue
    const rule = f.meaning(history.indexOf(c)).rule
    if (rule && ARTIFICIAL_FORCE_RULES.has(rule)) return true
  }
  return false
}

/**
 * Kärnan (ordagrant `offBookResponse`): partnern visade en färg → höj med fit
 * (`raiseWithFit`, som bär K3/spärr/balanserings-nyanserna) eller bjud egen
 * färg/sang. Står partnerns utgångsbud obestritt hittar vi inte på något.
 * `honorForce` (det gamla lagrets sista vakt) körs FORTFARANDE efter tabellen
 * för de lägen den här ger null, precis som förr — därför tar vi inte in
 * kravvakten här (annars skulle den flytta företräde). Ett utestående
 * artificiellt krav lämnas åt FORCED-detektorerna (se `outstandingArtificialForce`).
 */
function partnerSuitResponse(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  if (partnerGameBidStandsUnopposed(f.history, f.seat)) return null
  if (outstandingArtificialForce(f)) return null
  const partnerSuit = f.partnerLastSuit
  if (!partnerSuit) return null // partnern har inte visat en färg → vi hittar inte på något
  return raiseWithFit(hand, f, partnerSuit) ?? respondWithoutFit(hand, f, partnerSuit)
}

/**
 * ADVANCERN när de konkurrerat (familj 5, situation a — kartans "advancern efter
 * deras X/höjning"): motståndarna öppnade, partnern klev in (vår sidas första
 * kontraktsbud), och de har dubblat eller höjt/bjudit igen efter inklivet.
 * Placeras SIST i raden *advance2* (efter straffdubblingen, preferensen, "tävla
 * till fiten" och cue-fortsättningen), så den bara fångar det som annars föll
 * till `offBookResponse`. Konkurrensgränsen är familj 5:s: den rena advancern
 * (RHO passade) ligger kvar i det gamla lagret tills senare familjer.
 */
export function advancerActsInCompetition(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  const open = f.opening
  if (!open || f.weOpened) return null
  const partnerOvercall = f.ourContractBids[0]
  if (!partnerOvercall || partnerOvercall.seat !== f.partner) return null
  if (!opponentsCompetedAfter(f, partnerOvercall)) return null
  return partnerSuitResponse(hand, f)
}

/**
 * ÖPPNAREN när de konkurrerat (familj 5, situation b — kartans "öppnaren efter
 * deras X + höjning", `1x–(X)–2x–…`): placeras SIST i raden *öppnaren-stört*,
 * efter familj 4:s hela kedja. Raden *öppnaren-stört*:s läge (`openerContestedSeat`)
 * garanterar redan konkurrens (motståndarna har bjudit eller dubblat), så ingen
 * extra gräns behövs. Kravvakten (`honorForce`) körs efter för de null-fallen.
 */
export function openerActsInCompetition(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  return partnerSuitResponse(hand, f)
}

/**
 * K1-RESTEN (familj 5, situation c): den negativa dubblaren möter öppnarens
 * ANDRA (återöppnings-)dubbling. `responderAnswersReopeningDouble` (familj 4)
 * tar bara svararens FÖRSTA tur, så den som redan dubblat negativt föll förr till
 * `offBookResponse` (och passade den forcerande andra dubblingen — pliktsvepets
 * K1-rest). Öppnarens andra X är lika upplysande som den första: en FIT måste nå
 * utgång (graderad höjning `raiseWithFit`, inte bara billig preferens), annars
 * det tvingande svaret (`answerReopeningDoubleCore`: färg utanför deras / sang /
 * straffpass). Passet är därmed borta utom som äkta straffpass.
 */
export function responderAnswersSecondDouble(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  const open = f.opening
  if (!open || open.seat !== f.partner) return null
  const myActions = f.history.filter((c) => c.seat === f.seat && c.bid !== 'P')
  if (myActions.length === 0 || myActions.some((c) => c.bid !== 'X')) return null // bara eget/egna X
  const last = f.lastNonPass
  if (!last || last.seat !== f.partner || last.bid !== 'X') return null // partnerns senaste = X (andra dubblingen)
  if (f.history.slice(f.history.indexOf(last) + 1).some((c) => c.bid !== 'P')) return null // min tur
  const partnerSuit = f.partnerLastSuit
  if (partnerSuit) {
    const raise = raiseWithFit(hand, f, partnerSuit) // graderad fithöjning FÖRST (fit → utgång)
    if (raise) return raise
  }
  const core = answerReopeningDoubleCore(hand, f)
  return core ? asCall(f.seat, core) : null
}

/**
 * SVARAREN när de konkurrerat (familj 5 — balanserings-/återöppningssvaren och
 * K1-resten). Placeras SIST i raden *svararen-stört*; radens läge
 * (`responderContestedSeat`) garanterar konkurrens. K1-resten
 * (`responderAnswersSecondDouble`) prövas först — den är forcerande och får inte
 * kapas av den allmänna kärnan (som kan passa en svag hand).
 */
export function responderActsInCompetition(hand: Hand, f: AuctionFacts): ResolvedCall | null {
  return responderAnswersSecondDouble(hand, f) ?? partnerSuitResponse(hand, f)
}
