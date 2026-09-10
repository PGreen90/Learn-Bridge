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

import type { Bid, Deal, Hand, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { buildAuction } from './auction'
import { decideFromTable } from './auction-decide'
import { turnsToCalls } from './auction-contract'
import { allContractBids, cheapestBidIn, legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { isVulnerable } from './openings'
import {
  auctionFacts, isGameOrHigher, parseContractBid, strainRank, PARTNER, SUIT_OF_LETTER, SUIT_STRAINS,
  type AuctionFacts,
} from './auction-facts'
import { penaltyDouble } from './doubles'
import { raiseWithFit as raisePartnerSuit } from './fit-raise'
import { hcp, isBalanced, lengths } from './hand'
import { hasStopper } from './overcalls'
import { side } from './play'

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

// ---- Transferns utgångsval (felrapport #13) --------------------------------
//
// (Essfrågan 4NT/5NT, rättelsen över stoppet, 3NT-höjningen och 3NT-stoppen —
// alla slam-svar som fyrade när linjen tog slut — flyttade till beslutstabellen,
// raden *slam-forts*, motorbytet etapp 4 familj 8. `slamAskTrump` bor nu i
// `slam-answer-continuations.ts`.)

/**
 * Har partnern bett öppnaren VÄLJA UTGÅNG efter en Jacoby-transfer
 * (felrapport #13: transferns relä lästes som naturlig hjärter → 4♥ på en
 * 2-kortsfärg)? Mönstret (§5, ostört): `seat` öppnade 1NT/2NT, partnern
 * överförde (relät = färgen UNDER högfärgen), `seat` fullföljde transfern,
 * partnern bjöd 3NT = "pass med 2-korts stöd, 4M med 3+" och bara pass har
 * följt. Motståndarna ska ha varit tysta (inga kontraktsbud). Returnerar
 * transferns högfärg, annars null.
 */
function transferGameChoiceToAnswer(f: AuctionFacts): Suit | null {
  const { seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== '3NT') return null

  // Auktionens kontraktsbud i exakt denna ordning, alla från vår sida:
  // NT-öppning, relä, fullföljd transfer, 3NT.
  const bids = f.contractBids
  if (bids.length !== 4 || f.opponentsHaveBid) return null
  const [open, relay, complete, nt] = bids
  if (open.seat !== seat || (open.bid !== '1NT' && open.bid !== '2NT')) return null
  const level = open.bid === '1NT' ? 2 : 3
  if (relay.seat !== PARTNER[seat] || (relay.bid !== `${level}D` && relay.bid !== `${level}H`)) return null
  const target: Suit = relay.bid === `${level}D` ? 'hearts' : 'spades'
  if (complete.seat !== seat || complete.bid !== `${level}${letterOfSuit(target)}`) return null
  if (nt !== lastNonPass) return null
  return target
}

// ---- Off-book: svara historiedrivet på Syds egna bud (pivotens kärna) -------
//
// När Syd bjudit utanför systemlinjen (off-book) har partnern ingen kanonisk
// fortsättning. I stället för att tappa tråden och passa svarar vi som en
// förnuftig partner skulle: stöd partnerns färg om vi har fit (graderat efter
// styrka), annars en egen färg eller sang. Allt utläst ur historiken + den egna
// handen – aldrig ur den (nu ogiltiga) ideallinjen. Medvetet konservativt; varje
// regel ska vara TYDLIGT korrekt även om den är smal.

/**
 * Höjningen av partnerns färg med fit — kunskapen bor i `fit-raise.ts` (etapp 4
 * familj 3, 2026-09-08) så beslutstabellen läser samma dom; här bara
 * detektorformen (egen hand + fakta ur kontexten).
 */
function raiseWithFit(c: DetectorCtx, partnerSuit: { strain: string; level: number }): ResolvedCall | null {
  return raisePartnerSuit(c.hand, c.facts, partnerSuit)
}

/**
 * Inget fit för partnern: bjud en egen 4+ färg (billigaste läge) eller en
 * balanserad sang. Bara när partnern redan bjudit (det är VÅR sidas auktion) –
 * vi hittar inte på inkliv från intet här (det hör till §7-försvaret).
 */
function respondWithoutFit(
  c: DetectorCtx,
  partnerSuit: { strain: string; level: number },
): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const hand = deal.hands[seat]
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
    return SUIT_STRAINS.indexOf(a) - SUIT_STRAINS.indexOf(b) // 4-4: billigast (lägst rang) först
  })
  for (const st of candidates) {
    const bid = cheapestBidIn(history, seat, st)
    if (!bid) continue
    const level = Number(bid[0])
    // 1-läget: ny färg från 6+. 2-läget (måste gå upp): kräver 12+ (2/1-anda). Högre: avstå.
    if (level === 1 && points >= 6) {
      return { seat, bid, explanation: `Egen färg ${SWE_SYM[st]} (4+ kort) – naturligt svar utan stöd för partnern.` }
    }
    if (level === 2 && points >= 12) {
      return { seat, bid, explanation: `Egen färg ${SWE_SYM[st]} på 2-läget – 4+ kort och utgångsvärden.` }
    }
  }

  // (2) Balanserad sang (bara ostört) – nivå efter styrka.
  if (!f.opponentsHaveBid && isBalanced(hand)) {
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
 * Off-book-svaret (pivotens kärna). Partnern har bjudit men linjen gäller inte:
 * stöd partnerns färg vid fit, annars egen färg/sang. Returnerar null när läget
 * inte är tydligt nog – då passar boten (som förut).
 */
function offBookResponse(c: DetectorCtx): ResolvedCall | null {
  const { history, seat, facts: f } = c
  // Respektera partnerns AVSLUT: står partnerns eget utgångsbud (3NT/4M/5m+)
  // obestritt ska vi inte hitta på en "höjning"/flykt till en annan strain —
  // 5♣-ryckaren (fel färg-spåret fix 1) drog partnerns 3NT till 5♣. Slamsvar
  // (essfrågor m.m.) ligger i egna detektorer FÖRE denna och berörs inte.
  if (partnerGameBidStandsUnopposed(history, seat)) return null
  const partnerSuit = f.partnerLastSuit
  if (!partnerSuit) return null // partnern har inte visat en färg → vi hittar inte på något
  return raiseWithFit(c, partnerSuit) ?? respondWithoutFit(c, partnerSuit)
}

/** Är partnerns SENASTE kontraktsbud utgång eller högre, utan att någon motståndare bjudit över det? */
function partnerGameBidStandsUnopposed(history: ResolvedCall[], seat: Seat): boolean {
  let partnerGameAt = -1
  for (const [idx, c] of history.entries()) {
    if (c.seat !== PARTNER[seat]) continue
    const cb = parseContractBid(c.bid)
    if (!cb) continue
    const trickScore = cb.level * (cb.strain === 'C' || cb.strain === 'D' ? 20 : 30) + (cb.strain === 'NT' ? 10 : 0)
    partnerGameAt = trickScore >= 100 ? idx : -1 // senaste budet räknas
  }
  if (partnerGameAt < 0) return false
  return !history.some((c, idx) => idx > partnerGameAt && side(c.seat) !== side(seat) && parseContractBid(c.bid))
}

/**
 * Ett naturligt MINIMIBUD som hedrar ett krav (aldrig pass). Prioritet:
 *   1. rebjud en egen 5+ färg vi redan visat (visar verklig längd),
 *   2. stöd en färg partnern visat (3+ kort), billigast,
 *   3. en ny 4+ färg, billigast (längst, sedan lägst),
 *   4. billigaste sang,
 *   5. sista utväg: billigaste lagliga kontraktsbud (kravet får aldrig brytas).
 */
function forcedMinimumBid(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const hand = deal.hands[seat]
  const len = lengths(hand)
  const legal = legalCalls(history, seat)

  // 1) Rebjud egen 5+ färg vi redan bjudit. F5/E2 (frön 20262070/20261885):
  // det KONSTGJORDA 2♣-öppningsbudet räknas aldrig som bjuden klöver, och
  // högfärger går före minorer ("finaste färg" — en äkta 6-korts spader ska
  // rebjudas hellre än att "klövern" spränger 3NT).
  const firstContract = history.find((c) => parseContractBid(c.bid))
  const strong2C = firstContract?.bid === '2C' ? firstContract : null
  const rebidOrder = [...SUIT_STRAINS].sort(
    (a, b) => Number(b === 'H' || b === 'S') - Number(a === 'H' || a === 'S'),
  )
  for (const st of rebidOrder) {
    if (len[SUIT_OF_LETTER[st]] < 5) continue
    if (!history.some((c) => c.seat === seat && c !== strong2C && parseContractBid(c.bid)?.strain === st)) continue
    const bid = cheapestBidIn(history, seat, st)
    if (bid) return {
      seat, bid, rule: 'krav – rebjuder egen färg',
      explanation: `Auktionen är krav – jag får inte passa. Rebjuder min egna ${SWE_SYM[st]} (5+ kort).`,
    }
  }

  // 2) Stöd partnerns visade färg (3+ kort).
  const ps = f.partnerLastSuit
  if (ps && len[SUIT_OF_LETTER[ps.strain]] >= 3) {
    const bid = cheapestBidIn(history, seat, ps.strain)
    if (bid) return {
      seat, bid, rule: 'krav – stödjer partnern',
      explanation: `Auktionen är krav – jag får inte passa. Stöder partnerns ${SWE_SYM[ps.strain]} (3+ kort).`,
    }
  }

  // 3) En ny 4+ färg (längst först, sedan billigast).
  const newSuits = SUIT_STRAINS
    .filter((st) =>
      len[SUIT_OF_LETTER[st]] >= 4 &&
      !f.theirStrains.has(st) &&
      !history.some((c) => c.seat === seat && parseContractBid(c.bid)?.strain === st))
    .sort((a, b) => len[SUIT_OF_LETTER[b]] - len[SUIT_OF_LETTER[a]] || strainRank(a) - strainRank(b))
  for (const st of newSuits) {
    const bid = cheapestBidIn(history, seat, st)
    if (bid) return {
      seat, bid, rule: 'krav – ny färg',
      explanation: `Auktionen är krav – jag får inte passa. Visar en ny färg (${SWE_SYM[st]}, 4+ kort).`,
    }
  }

  // 4) Billigaste sang.
  const nt = (['1NT', '2NT', '3NT'] as Bid[]).find((b) => legal.includes(b))
  if (nt) return {
    seat, bid: nt, rule: 'krav – sang',
    explanation: `Auktionen är krav – jag får inte passa. Billigaste sang.`,
  }

  // 5) Sista utväg: billigaste lagliga kontraktsbud.
  const anyBid = allContractBids().find((b) => legal.includes(b))
  if (anyBid) return {
    seat, bid: anyBid, rule: 'krav – billigaste bud',
    explanation: `Auktionen är krav – jag får inte passa; billigaste möjliga bud.`,
  }
  return null
}

/**
 * Svararens fortsättning efter att FJÄRDE FÄRG (krav, §6.6) besvarats. Fjärde
 * färg lovar utgångsvärden, så svararen får ALDRIG passa öppnarens svar under
 * utgång (systemrevisorns fynd, frö 20260743: 33 hp dog i 2NT). Placerar utgång:
 * höjde öppnaren min högfärg → 4 i den (fit), annars 3NT (standardresolutionen –
 * alla fyra färger är nämnda och GF-värdena redan lovade). `auctionForce` täcker
 * medvetet inte fjärde färg; detta är dess motsvarighet för just den sekvensen.
 */
function placeGameAfterFourthSuit(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const contractBids = f.contractBids
  if (f.opponentsHaveBid) return null // ostört
  const fourth = [...contractBids].reverse().find((c) => c.seat === seat && c.rule === 'fjärde färg krav')
  if (!fourth) return null // det var JAG som bjöd fjärde färg
  const last = contractBids[contractBids.length - 1]
  if (last.seat !== PARTNER[seat]) return null // partnern (öppnaren) svarade sist
  if (contractBids.indexOf(last) <= contractBids.indexOf(fourth)) return null // svaret kom EFTER mitt bud
  if (history.slice(history.indexOf(last) + 1).some((c) => c.bid !== 'P')) return null // bara pass efter → min tur
  if (isGameOrHigher(last.bid as Bid)) return null // redan i/över utgång

  // Bara MODESTA utgångshänder placeras här. En stark hand (18+) har slamintresse
  // och fortsätter utreda via slam-/beskrivnings­maskineriet (t.ex. felrapport #42:
  // svararen har 21 hp och driver till 6NT — den får inte kapas i 3NT).
  if (hcp(deal.hands[seat]) >= 18) return null

  const legal = legalCalls(history, seat)
  const myFirst = contractBids.find((c) => c.seat === seat)!
  const myStrain = parseContractBid(myFirst.bid)!.strain
  const lastStrain = parseContractBid(last.bid)!.strain
  // Höjde öppnaren MIN första högfärg? → utgång i fiten.
  if ((myStrain === 'H' || myStrain === 'S') && lastStrain === myStrain) {
    const gameBid = `4${myStrain}` as Bid
    if (legal.includes(gameBid)) return {
      seat, bid: gameBid, rule: 'fjärde färg: utgång i fit',
      explanation: `Fjärde färg var krav; partnern höjde min ${SWE_SYM[myStrain]} → utgång ${gameBid}.`,
    }
  }
  if (legal.includes('3NT')) return {
    seat, bid: '3NT', rule: 'fjärde färg: placerar utgång',
    explanation: `Fjärde färg var krav (utgångsvärden); partnern har beskrivit sin hand → placerar 3NT.`,
  }
  return null
}

/**
 * Vakten som binder ihop det: är vår sida i krav och skulle annars passa, tvinga
 * fram ett naturligt minimibud i stället. Placeras SIST i off-book-kedjan (efter
 * offBookResponse) så den bara fångar det som annars blivit ett förbjudet pass.
 */
function honorForce(c: DetectorCtx): ResolvedCall | null {
  const { facts: f } = c
  if (!f.force) return null
  return forcedMinimumBid(c)
}

/**
 * Får `seat` STRAFFDUBBLA här (ägarbeslut 2026-07-04, poängarbetet)? Kraven —
 * medvetet stränga, så X:et aldrig kan förväxlas med en konventionell dubbling:
 *  - senaste icke-pass är motståndarnas FÄRGKONTRAKT på 3-läget eller högre
 *    (låga delkontrakt straffdubblas inte – för lite att vinna, X kan ge dem
 *    utgång; NT-kontrakt dubblas inte här),
 *  - vår sida har gjort MINST TVÅ kontraktsbud: då kan partnern omöjligt läsa
 *    X:et som upplysning/negativt/tvåfärgssvar (alla de detektorerna kräver
 *    max ett kontraktsbud från vår sida) – X:et står som straff,
 *  - handen håller `penaltyDouble`-kraven (2+ säkra trumfstick + 10+ hp).
 */
function maybePenaltyDouble(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || side(lastNonPass.seat) === side(seat)) return null
  const cb = parseContractBid(lastNonPass.bid)
  if (!cb || cb.strain === 'NT' || cb.level < 3) return null

  const ourContractBids = f.ourContractBids
  if (ourContractBids.length < 2) return null
  if (!legalCalls(history, seat).includes('X')) return null

  const ans = penaltyDouble(deal.hands[seat], SUIT_OF_LETTER[cb.strain])
  if (!ans) return null
  return { seat, bid: 'X', rule: ans.rule, explanation: ans.explanation }
}

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

/**
 * Vad datorn bjuder på `seat` givet budgivningen så här långt. Bygger parets
 * kanoniska systemlinje med `buildAuction` och spelar upp den bud för bud – men
 * BARA så länge den verkliga budföljden följer linjen. Två lägen lämnar linjen
 * och svarar historiedrivet i stället för att tappa tråden:
 *  1. **Off-book:** Syd har bjudit något annat än linjen (`divergedFromLine`).
 *  2. **Konkurrens:** linjen tog slut men auktionen är fortfarande ÖPPEN
 *     (`built.open`). `buildAuction` modellerar bara EN konkurrensrond, så utan
 *     detta skulle störda auktioner dö ut direkt – nu konkurrerar både partnern
 *     och motståndarna vidare (stöd m. fit / egen färg / pass).
 * Skillnaden mot en FÄRDIG linje (`built.open === false`): där är de extra
 * turerna bara avslutande pass och boten ska passa.
 */
/**
 * Partnerns 3NT efter fullföljd transfer = välj utgång (felrapport #13): 4 i
 * högfärgen med 3-korts stöd, annars pass (3NT står).
 */
function answerTransferGameChoice(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const transferMajor = transferGameChoiceToAnswer(f)
  if (!transferMajor) return null
  const support = lengths(deal.hands[seat])[transferMajor]
  if (support >= 3) {
    const bid = `4${letterOfSuit(transferMajor)}` as Bid
    if (legalCalls(history, seat).includes(bid)) {
      return {
        seat, bid, rule: 'till spel',
        explanation: `partnerns 3NT efter transfern = välj utgång: 3+ stöd i ${SWE_SYM[letterOfSuit(transferMajor)]} → 4 ${SWE_SYM[letterOfSuit(transferMajor)]} (5-3-fiten före sang).`,
      }
    }
  }
  return {
    seat, bid: 'P', rule: 'pass',
    explanation: `partnerns 3NT efter transfern = välj utgång: utan 3-stöd i ${SWE_SYM[letterOfSuit(transferMajor)]} → pass (3NT står).`,
  }
}

/**
 * Har VÅR 2-över-1-svarare (utgångskrav) fått sin färg HÖJD av öppnaren, så att
 * svararen nu måste placera minst utgång i stället för att passa (felrapport #27)?
 * Ett 2-över-1-svar (ny lägre färg på 2-läget, ostört) är utgångskrav i hela
 * systemet – svararen får ALDRIG passa under utgång. Uppstår off-book när Syd
 * öppnade den svagare handen (motorns linje hade partnern som öppnare), så den
 * on-book-fortsättningen aldrig fyrar. Mönster: motståndarna helt tysta (ostört),
 * VÅR 1-färgsöppning, partnerns svar = ny lägre färg på 2-läget (äkta 2/1),
 * öppnaren höjde den färgen, det är svararens tur (bara pass efter höjningen) och
 * höjningen ligger under utgång. Returnerar den överenskomna färgen, annars null.
 */
function twoOverOneRaiseToAnswer(f: AuctionFacts): { strain: string } | null {
  const { history, seat } = f
  // Ostört: motståndarna får inte ha gjort något kontraktsbud (då gäller ej rent 2/1).
  if (f.opponentsHaveBid) return null
  const open = f.opening
  if (!open || open.level !== 1 || open.strain === 'NT') return null
  if (side(open.seat) !== side(seat)) return null // VÅR öppning
  const opener = open.seat
  const responder = PARTNER[opener]
  if (seat !== responder) return null // svararen (2/1-budaren) själv placerar
  const ourBids = f.ourContractBids
  if (ourBids.length !== 3) return null
  const [openC, respC, raiseC] = ourBids
  if (openC.seat !== opener || respC.seat !== responder || raiseC.seat !== opener) return null
  const rb = parseContractBid(respC.bid)!
  // Äkta 2/1: ny färg (≠ öppningsfärgen), 2-läget, LÄGRE rang än öppningen.
  if (rb.strain === 'NT' || rb.level !== 2 || rb.strain === open.strain) return null
  const openRank = SUIT_STRAINS.indexOf(open.strain as (typeof SUIT_STRAINS)[number])
  const respRank = SUIT_STRAINS.indexOf(rb.strain as (typeof SUIT_STRAINS)[number])
  if (openRank < 0 || respRank < 0 || respRank >= openRank) return null
  // Öppnaren HÖJDE svararens färg (samma strain, högre nivå).
  const raiseBid = parseContractBid(raiseC.bid)!
  if (raiseBid.strain !== rb.strain || raiseBid.level <= rb.level) return null
  const raiseIdx = history.indexOf(raiseC)
  if (history.slice(raiseIdx + 1).some((c) => parseContractBid(c.bid))) return null // bara pass efter höjningen
  const isMajor = rb.strain === 'H' || rb.strain === 'S'
  const gameLevel = isMajor ? 4 : 5
  if (raiseBid.level >= gameLevel) return null // redan utgång/över → inget att tvinga
  return { strain: rb.strain }
}

/**
 * Svararen sätter utgång efter att öppnaren höjt vår 2/1-färg (felrapport #27):
 * högfärg → 4M; lågfärg → 3NT med stopp i de objudna färgerna, annars 5m.
 * Utgångskravet får aldrig passas.
 */
function answerTwoOverOneRaise(c: DetectorCtx): ResolvedCall | null {
  const { deal, history, seat, facts: f } = c
  const info = twoOverOneRaiseToAnswer(f)
  if (!info) return null
  const hand = deal.hands[seat]
  const legal = legalCalls(history, seat)
  const isMajor = info.strain === 'H' || info.strain === 'S'
  if (isMajor) {
    const bid = `4${info.strain}` as Bid
    if (!legal.includes(bid)) return null
    return {
      seat, bid, rule: '2/1 utgångskrav',
      explanation: `Vårt 2-över-1-svar var utgångskrav och partnern höjde min ${SWE_SYM[info.strain]} → jag sätter utgång ${prettyBid(bid)} (pass förbjudet).`,
    }
  }
  // Lågfärgs-2/1: 3NT om vi stoppar de objudna färgerna, annars 5m.
  const open = f.opening!
  const bidStrains = new Set<string>([open.strain, info.strain])
  const unbid = SUIT_STRAINS.filter((st) => !bidStrains.has(st))
  if (unbid.every((st) => hasStopper(hand, SUIT_OF_LETTER[st])) && legal.includes('3NT' as Bid)) {
    return {
      seat, bid: '3NT', rule: '2/1 utgångskrav',
      explanation: `Vårt 2-över-1 var utgångskrav; med stopp i de objudna färgerna → 3NT (pass förbjudet).`,
    }
  }
  const bid = `5${info.strain}` as Bid
  if (!legal.includes(bid)) return null
  return {
    seat, bid, rule: '2/1 utgångskrav',
    explanation: `Vårt 2-över-1 var utgångskrav och partnern höjde min ${SWE_SYM[info.strain]} → utgång ${prettyBid(bid)} (pass förbjudet).`,
  }
}

// R1 Fynd #2 (flerronds-konkurrens, del C): advancern TÄVLAR upp till fiten på
// 3-läget efter motståndarnas fitvisande höjning. Roten (proben, giv #263): partnern
// klev in 2♥ (bra 6+ färg), motståndarna hittade sin fit (1♠–…–2♠), men advancern med
// 3-korts stöd (= 9-korts fit) PASSADE. Lagen om totala stick: 9 trumf → tävla till
// 3-läget. Skilt från raiseWithFit (som kräver 4-korts stöd för ett 2-läges inkliv och
// hade bjudit 4♥ inbjudande = överbud). Ägarregel: 3-korts stöd + motståndarna har
// hittat sin fit → tävla 3M; genuina utgångsvärden (13+ stödpoäng) → utgång; svag → pass.

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
  // Min EGEN fjärde färg har besvarats — placera utgång, passa aldrig kravet.
  { id: 'placeGameAfterFourthSuit',
    run: (c) => placeGameAfterFourthSuit(c) },
  // (Partnerns fjärde färg / New Minor Forcing besvaras nu i beslutstabellen,
  // raden *tredje* — de gamla detektorerna fourthSuitToAnswer/nmfToAnswer fyrade
  // aldrig längre (auktions- och avvikelsedump 0), rivna motorbytet etapp 5.)
  // (§7.6-försvaret mot deras svaga tvåa/spärr — även spärrhöjningen 2♠–P–3♠ —
  // flyttade till beslutstabellen, raden *försvar-svag2*, motorbytet etapp 4
  // familj 7, 2026-09-09; väckningen behövs inte längre — tabellen frågas FÖRST.)
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
  // Straffdubbla motståndarnas höga färgkontrakt när handen sätter det
  // (poängarbetet 2026-07-04): 2+ säkra trumfstick + 10+ hp.
  { id: 'maybePenaltyDouble',
    run: (c) => maybePenaltyDouble(c) },
  // Partnerns 3NT efter fullföljd transfer = VÄLJ UTGÅNG (felrapport #13).
  // Måste ligga FÖRE off-book-svaret (som annars stöder transferns relä).
  { id: 'answerTransferGameChoice', before: ['offBookResponse'],
    run: (c) => answerTransferGameChoice(c) },
  // (Störningen över VÅRT 1NT — Lebensohl, värde-X och flykt-straffet — flyttade
  // till beslutstabellen, raden *vårt-1nt-stört*, motorbytet etapp 4 familj 6,
  // 2026-09-09.)
  // (Störningen av VÅR svaga tvåa/spärr och advancerns svar på partnerns
  // tvåfärgs-CUE över deras svaga tvåa flyttade till beslutstabellen, raden
  // *svag2-fortsättning*, motorbytet etapp 4 familj 7, 2026-09-09.)
  // Vårt 2-över-1 var utgångskrav och öppnaren höjde vår färg (felrapport
  // #27): svararen sätter minst utgång, passar aldrig. Uppstår off-book (Syd
  // öppnade svagare handen). Måste ligga FÖRE off-book-svaret (som annars
  // vägrar höja en redan bjuden färg och passar).
  { id: 'answerTwoOverOneRaise', before: ['offBookResponse'],
    run: (c) => answerTwoOverOneRaise(c) },
  // (Öppnarens återbud efter partnerns 2-över-1 (felrapport #58), svararens
  // placering efter NMF-svaret (§5.7), svaret på 2♣–2♦–2NT, och hela
  // off-book-sangsystemet (felrapport #41) besvaras nu i beslutstabellen
  // (raderna *återbud*/*tredje*/*svar2*/*svar*): de gamla detektorerna fyrade
  // aldrig längre (auktions- och avvikelsedump 0), rivna motorbytet etapp 5.)
  // (Kaptenens kvantitativa höjning av partnerns naturliga 3NT till 6NT,
  // felrapport #42, flyttade till beslutstabellen, raden *slam-forts*,
  // motorbytet etapp 4 familj 8.)
  // Generellt historiedrivet off-book-svar (fångar fit/egen färg/sang).
  { id: 'offBookResponse', before: ['honorForce'],
    run: (c) => offBookResponse(c) },
  // SISTA VAKTEN: är vår sida i krav och skulle annars passa → tvinga fram ett
  // naturligt minimibud (grunden bakom "krav får aldrig passas"). Ostörda 2/1,
  // ny färg och reverse; ersätter behovet av en detektor per felrapport.
  { id: 'honorForce',
    run: (c) => honorForce(c) },
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
