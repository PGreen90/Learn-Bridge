// DUBBLINGSFAMILJEN — systembok §7.3, motorbytets etapp 4 familj 2
// (2026-09-08). Upplysningsdubblingen på VÅR sida: dubblingen efter två bjudna
// färger, advancerns svar (tvunget eller fritt), dubblarens fortsättningar
// (svaret på cuet, höjningen av svaret, det starka återbudet) och advancerns
// senare bud (stödstegen, domen på 3-hoppet). Kunskapsfunktioner för
// beslutstabellen (`auction-decide.ts`): EGEN hand + auktionsläget
// (`AuctionFacts`, läst ur auktionen ensam) → ett bud. Ingen annan hand finns
// att läsa här.
//
// Innehållet är detektorerna som förr låg i `auction-live.ts`
// (takeoutDoubleToAnswer, takeoutDoubleOverbidToAnswer, advancerCueToAnswer,
// doublerRaisesAdvance, maybeTakeoutOfResponse, ownStrongDoubleRebid,
// advanceStrongDoubleRebid, strongDoublerSecondRebid,
// answerStrongDoubleGameForce, advancerCompetesToFit med X på vår sida) — samma
// bridgekunskap, nu som rena funktioner av hand + fakta i stället för steg i
// en ordnad kö. Lägesläsarna exporteras så tabellraderna kan uttrycka sina
// lägen exakt.
//
// Nytt i familjen (facit-kön `motorbyte-facit.test.ts`): dubblaren höjer
// partnerns fria 2NT till 3NT med 14+ (frö 20270004), och advancern svarar
// dubblarens cue efter sin egen responsiva dubbling (frö 20270461). Den vanliga
// 4-4-dubblingen efter två bjudna färger var förr "live-only" (manuset
// modellerade bara den starka); nu är den ett beslut som alla andra.

import type { Bid, Hand, Seat, Suit } from '../../types/bridge'
import { parseContractBid, PARTNER, SUIT_OF_LETTER, SUIT_STRAINS, type AuctionFacts } from './auction-facts'
import { cheapestBidIn, legalCalls, letterOfSuit, prettyBid, SWE_SYM } from './auction-rules'
import { dummyPoints, startingPoints } from './evaluation'
import { hcp, lengths } from './hand'
import { advancerFreeBidAfterDouble, answerTakeoutDouble, doublerAnswersCue, responsiveDouble } from './doubles'
import { hasStopper, takeoutOfResponse } from './overcalls'
import { advancerCompetesToFit, advancerPrefersOvercallSuit, type Kunskap } from './overcall-continuations'
import { side } from './play'

/** Kunskap bara om budet är lagligt just nu — annars null (nästa regel, sedan det gamla lagret). */
function lawful(f: AuctionFacts, k: Kunskap | null): Kunskap | null {
  if (!k) return null
  if (k.call !== 'P' && !legalCalls(f.history, f.seat).includes(k.call as Bid)) return null
  return k
}

// ============================================================================
// Lägesläsare
// ============================================================================

/**
 * Dubblingsfamiljens läge: motståndarna öppnade i FÄRG, vår sida har dubblat.
 * `doubler` = den på vår sida som dubblade FÖRST i tid (upplysningsdubblingen;
 * en senare X är responsiv eller straff). Sang-öppningar (DONT, värde-X) och
 * dubblingar på vår egen öppning (negativ, stöd) är andra familjer.
 */
export function doubleFamily(f: AuctionFacts): { doubler: Seat; openSuit: Suit } | null {
  const open = f.opening
  if (!open || f.weOpened) return null
  const openSuit = SUIT_OF_LETTER[open.strain]
  if (!openSuit) return null
  const x = f.history.find((c) => side(c.seat) === side(f.seat) && c.bid === 'X')
  if (!x) return null
  return { doubler: x.seat, openSuit }
}

/**
 * Dubblingssitsen efter TVÅ bjudna färger (§7.3): motståndarna öppnade 1 i färg
 * och svarade 1 i ny färg (auktionens enda kontraktsbud, svaret senaste
 * icke-pass), vår sida har inte sagt ett ljud. Stolen direkt över svararen.
 */
export function takeoutOfResponseSeat(f: AuctionFacts): { openSuit: Suit; respSuit: Suit } | null {
  if (f.history.some((c) => side(c.seat) === side(f.seat) && c.bid !== 'P')) return null
  const bids = f.contractBids
  if (bids.length !== 2 || f.lastNonPass !== bids[1]) return null
  const [openBid, respBid] = bids
  if (side(openBid.seat) === side(f.seat) || respBid.seat !== PARTNER[openBid.seat]) return null
  const ob = parseContractBid(openBid.bid)!
  const rb = parseContractBid(respBid.bid)!
  if (ob.level !== 1 || rb.level !== 1) return null
  const openSuit = SUIT_OF_LETTER[ob.strain]
  const respSuit = SUIT_OF_LETTER[rb.strain]
  if (!openSuit || !respSuit || openSuit === respSuit) return null
  return { openSuit, respSuit }
}

/**
 * Är `seat` TVUNGEN att svara på partnerns upplysningsdubbling? Mönstret är:
 *   (motst. öppnar färg) – X (partner = upplysning) – pass (din RHO) – seat
 * En upplysningsdubbling ber partnern bjuda sin längsta objudna färg; passar
 * RHO är partnern skyldig att svara (även med 0 hp). Kraven:
 *  - partnerns senaste icke-pass-bud är ett X (och bara pass har följt sedan),
 *  - vår sida har inte själv bjudit ett kontraktsbud (så X:et är take-out),
 *  - motståndarna har öppnat i en färg (den dubblade färgen).
 * Returnerar deras (dubblade) färg, annars null (= ingen påtvingad svarsplikt).
 */
export function takeoutDoubleToAnswer(f: AuctionFacts): { suit: Suit; level: number; bidSuits: Suit[]; balancing: boolean } | null {
  const { history, seat } = f
  const lastNonPass = f.lastNonPass
  // Senaste icke-pass måste vara PARTNERNS dubbling (annars: RHO bjöd → ej tvång).
  if (!lastNonPass || lastNonPass.seat !== PARTNER[seat] || lastNonPass.bid !== 'X') return null
  // Har vår sida redan bjudit ett kontraktsbud är X:et inte en ren take-out.
  if (history.some((c) => side(c.seat) === side(seat) && parseContractBid(c.bid))) return null
  // Deras dubblade färg = SENASTE motståndarfärgen; nivån = HÖGSTA (så svaret blir
  // lagligt även när en svag tvåa dubblats, R1-fynd #5). `bidSuits` = ALLA färger
  // de bjudit, så advancern aldrig svarar i en av dem (t.ex. öppnarens ruter efter
  // 1♦–1♥–X). Ett NT-bud är ingen take-out-färg → hoppas över.
  let their: Suit | null = null
  let level = 1
  const bidSuits: Suit[] = []
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (cb && side(c.seat) !== side(seat)) {
      const suit = SUIT_OF_LETTER[cb.strain]
      if (suit) {
        their = suit
        level = Math.max(level, cb.level)
        if (!bidSuits.includes(suit)) bidSuits.push(suit)
      }
    }
  }
  if (!their) return null
  // STRAFF, inte upplysning (felrapport #50): en dubbling av motståndarnas
  // game-nivå (4+ i färg) är straffdubbling – partnern passar och försvarar, den
  // pullar aldrig till en egen (kanske singel-) färg. Upplysningsdubblingar –
  // inklusive av en spärröppning på 3-läget, som besvaras på 4-läget – ligger
  // kvar (level ≤ 3). (Nord drog Syds straff-X av 4♠ till 5♦ på en singel ♦Q.)
  if (level >= 4) return null
  // Var X:et en BALANSERING (deras öppning, två pass, partnerns X i utpassnings-
  // läget)? Då är golvet sänkt ~3 hp (§7.6 "låna en kung") och advancern ska
  // räkna av den lånade kungen i sitt svar (F3/C12, 2026-08-07).
  const openIdx = f.opening?.index ?? -1
  const balancing =
    history[openIdx + 1]?.bid === 'P' &&
    history[openIdx + 2]?.bid === 'P' &&
    history[openIdx + 3]?.seat === PARTNER[seat] &&
    history[openIdx + 3]?.bid === 'X'
  return { suit: their, level, bidSuits, balancing }
}

/**
 * Har motståndarna BJUDIT ÖVER partnerns upplysningsdubbling (etapp 6 hål 2)?
 * Mönstret: de öppnar i färg (1–2-läget) – partnern X (upplysning) – RHO
 * höjer/bjuder nytt/redubblar – `seat`. `takeoutDoubleToAnswer` kräver att X:et
 * är senaste icke-pass, så här försvann svaret helt förr. Läget är FRITT (utom
 * över XX = tvångsflykt) — advancern talar värde-/formstyrt via
 * `advancerFreeBidAfterDouble`. Kraven:
 *  - vår sida har inga kontraktsbud; vårt enda icke-pass är partnerns X,
 *  - efter X:et har de gjort EXAKT en aktion (bud eller XX) = senaste icke-pass,
 *  - deras öppning är i färg på 1–2-läget (3+ = spärr, hål 4 — rörs inte här).
 */
export function takeoutDoubleOverbidToAnswer(
  f: AuctionFacts,
): { doubledSuit: Suit; openLevel: number; theirSuits: Suit[]; lastBid: string } | null {
  const { history, seat } = f
  const lastNonPass = f.lastNonPass
  if (!lastNonPass || side(lastNonPass.seat) === side(seat)) return null
  if (lastNonPass.bid !== 'XX' && !parseContractBid(lastNonPass.bid)) return null

  // Vår sida: exakt ETT icke-pass, och det är partnerns X (inga egna kontraktsbud).
  const ourNonPass = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourNonPass.length !== 1 || ourNonPass[0].bid !== 'X' || ourNonPass[0].seat !== PARTNER[seat]) return null
  const xIdx = history.indexOf(ourNonPass[0])

  // Efter X:et: exakt EN motståndaraktion (den senaste icke-passen).
  const afterX = history.slice(xIdx + 1).filter((c) => c.bid !== 'P')
  if (afterX.length !== 1 || afterX[0] !== lastNonPass) return null

  // Deras öppning: auktionens första kontraktsbud, i färg, 1–2-läget.
  const bids = f.contractBids
  if (bids.length === 0 || side(bids[0].seat) === side(seat)) return null
  const openCb = parseContractBid(bids[0].bid)!
  const doubledSuit = SUIT_OF_LETTER[openCb.strain]
  if (!doubledSuit || openCb.level > 2) return null

  const theirSuits: Suit[] = []
  let openLevel = openCb.level
  for (const c of bids) {
    if (side(c.seat) === side(seat)) return null // (paranoia: inga egna kontraktsbud)
    const cb = parseContractBid(c.bid)!
    const s = SUIT_OF_LETTER[cb.strain]
    if (s && !theirSuits.includes(s)) theirSuits.push(s)
    if (c !== lastNonPass) openLevel = Math.max(openLevel, cb.level)
  }
  return { doubledSuit, openLevel, theirSuits, lastBid: lastNonPass.bid }
}

/**
 * Har partnern CUE-BJUDIT deras färg efter en dubbling på vår sida? Två
 * mönster, samma svar:
 *  · min upplysningsdubbling – partnerns cue (utgångskrav, svar på X:et),
 *  · partnerns upplysningsdubbling – min RESPONSIVA dubbling – partnerns cue
 *    (dubblaren med 12+ svarar den responsiva dubblingen med cue, frö
 *    20270461 — förr saknades svaret på det cuet helt).
 * Kraven: deras 1-lägesöppning i färg (svaga tvåor har egen cue-väg), vår
 * sidas enda kontraktsbud är partnerns cue i en av deras färger, alla våra
 * icke-pass före cuet är dubblingar, och efter cuet bara pass och deras
 * straff-X (deras X tar ingen budyta och friar mig inte från kravet).
 */
export function cueAfterOurDoubleToAnswer(
  f: AuctionFacts,
): { theirSuits: Suit[]; cueBid: string } | null {
  const { history, seat } = f
  const ourNonPass = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourNonPass.length < 2) return null
  const cueCall = ourNonPass[ourNonPass.length - 1]
  if (cueCall.seat !== PARTNER[seat] || !parseContractBid(cueCall.bid)) return null
  if (ourNonPass.slice(0, -1).some((c) => c.bid !== 'X')) return null
  const cueIdx = history.indexOf(cueCall)
  if (history.slice(cueIdx + 1).some((c) => c.bid !== 'P' && !(c.bid === 'X' && side(c.seat) !== side(seat)))) return null

  // Deras öppning: första kontraktsbudet, i färg, 1-läget.
  const bids = f.contractBids
  if (bids.length === 0 || side(bids[0].seat) === side(seat)) return null
  const openCb = parseContractBid(bids[0].bid)!
  if (openCb.level !== 1 || !SUIT_OF_LETTER[openCb.strain]) return null

  const theirSuits: Suit[] = []
  for (const c of bids) {
    if (side(c.seat) === side(seat)) continue
    const s = SUIT_OF_LETTER[parseContractBid(c.bid)!.strain]
    if (s && !theirSuits.includes(s)) theirSuits.push(s)
  }
  // Partnerns bud måste vara ett CUE (i en av deras färger).
  const cueSuit = SUIT_OF_LETTER[parseContractBid(cueCall.bid)!.strain]
  if (!cueSuit || !theirSuits.includes(cueSuit)) return null

  return { theirSuits, cueBid: cueCall.bid }
}

// ============================================================================
// Dubblingssitsen (raden *dubbling*)
// ============================================================================

/**
 * Upplysningsdubbling när de bjudit TVÅ 1-lägesfärger (1♦–P–1♥–?): X lovar
 * 4-4 i de två objudna färgerna från 10 hp, eller den starka 17+-enfärgshanden
 * (X + egen färg nästa varv). Handbedömningen är `takeoutOfResponse`
 * (`overcalls.ts`); pass är också ett beslut, så funktionen svarar alltid.
 */
export function takeoutOfResponseBid(hand: Hand, f: AuctionFacts): Kunskap | null {
  const s = takeoutOfResponseSeat(f)
  if (!s) return null
  const r = takeoutOfResponse(hand, s.openSuit, s.respSuit)
  return { call: r.call, rule: r.rule, explanation: r.explanation }
}

// ============================================================================
// Advancerns svar (raden *x-svar*)
// ============================================================================

/**
 * Advancern svarar partnerns upplysningsdubbling: tvunget (RHO passade —
 * `answerTakeoutDouble`, aldrig pass) eller fritt när de bjöd över X:et:
 * först den RESPONSIVA dubblingen (§7.4: svararen höjde öppningsfärgen till 2-läget,
 * 7+ hp med stöd i de objudna — samma företräde som manusets konkurrensrond
 * gav den), sedan `advancerFreeBidAfterDouble`; ger schemat inget bud är pass
 * rätt (tunna händer tiger i ett fritt läge).
 */
export function advancerAnswersDouble(hand: Hand, f: AuctionFacts): Kunskap | null {
  const t = takeoutDoubleToAnswer(f)
  if (t) {
    const r = answerTakeoutDouble(hand, t.suit, t.level, t.bidSuits, t.balancing)
    return lawful(f, { call: r.call, rule: r.rule, explanation: r.explanation })
  }
  const o = takeoutDoubleOverbidToAnswer(f)
  if (o) {
    // Responsiv bara efter SVARARENS höjning (bokens exempel, manusets gamla räckvidd) — inte öppnarens rebud.
    if (o.lastBid === `2${letterOfSuit(o.doubledSuit)}` && f.lastNonPass?.seat === PARTNER[f.opening!.seat]) {
      const resp = responsiveDouble(hand, o.doubledSuit)
      if (resp) return lawful(f, { call: resp.call, rule: resp.rule, explanation: resp.explanation })
    }
    const r = advancerFreeBidAfterDouble(hand, o.doubledSuit, o.openLevel, o.theirSuits, o.lastBid)
    if (r) return lawful(f, { call: r.call, rule: r.rule, explanation: r.explanation })
    return {
      call: 'P', rule: 'pass',
      explanation: `Motståndarna bjöd över partnerns upplysningsdubbling – svarstvånget är borta, och handen har inget fritt bud → pass.`,
    }
  }
  return null
}

// ============================================================================
// Cuet efter en dubbling på vår sida (båda raderna)
// ============================================================================

/**
 * Svaret på partnerns cue efter en dubbling på vår sida (utgångskrav — får
 * aldrig passas): cuet jagar högfärgsfiten, så billigaste 4-korts högfärg visas
 * först; utan 4-korts högfärg 3NT med stopp, annars längsta objudna färg
 * (`doublerAnswersCue`). Samma svar oavsett om jag är dubblaren eller den
 * responsiva dubblaren som får dubblarens cue.
 */
export function answerCueAfterDouble(hand: Hand, f: AuctionFacts): Kunskap | null {
  const a = cueAfterOurDoubleToAnswer(f)
  if (!a) return null
  const r = doublerAnswersCue(hand, a.theirSuits, a.cueBid)
  const fam = doubleFamily(f)
  const iDoubledFirst = fam?.doubler === f.seat
  return lawful(f, {
    call: r.call,
    rule: iDoubledFirst ? r.rule : 'svar på dubblarens cue',
    explanation: iDoubledFirst ? r.explanation : `Dubblarens cue efter min responsiva dubbling är krav – ${r.explanation.replace(/^Partnerns cue är krav – /, '')}`,
  })
}

// ============================================================================
// Dubblarens fortsättningar (raden *x-dubblaren*)
// ============================================================================

/**
 * DUBBLAREN väger höjningen av advancerns färgsvar (etapp 6 hål 2, del 2).
 * Svaret lovar bara ~6–9 (fritt icke-hopp), 9–11 (hoppet) eller 0+
 * (tvångsflykt över deras XX). Skalan:
 *  - flykt över XX → höj aldrig (svaret lovar inga poäng),
 *  - partnerns HOPP (9–11): utgång i högfärg med 15+ stödpoäng, annars pass,
 *  - fritt icke-hopp (~6–9): utgång med 19+ (högfärg) / 21+ (lågfärg),
 *    enkel höjning (inbjudan) med 16–18, annars pass,
 *  - 17+ hp släpps vidare till det starka X-flödet (`ownStrongDoubleRebid`).
 * Explicit pass (inte null) när vakten avböjer — annars tar en fit-blaster över.
 */
export function doublerWeighsAdvance(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  // Vår sida: exakt två icke-pass — mitt X (först) och partnerns färgbud.
  const ourNonPass = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourNonPass.length !== 2) return null
  if (ourNonPass[0].seat !== seat || ourNonPass[0].bid !== 'X') return null
  const advCall = ourNonPass[1]
  if (advCall.seat !== PARTNER[seat] || !parseContractBid(advCall.bid)) return null

  // Turen: senaste icke-pass är partnerns svar, eller deras bud EFTER svaret.
  const lastNonPass = f.lastNonPass
  if (!lastNonPass) return null
  const advIdx = history.indexOf(advCall)
  if (lastNonPass !== advCall && !(side(lastNonPass.seat) !== side(seat) && history.indexOf(lastNonPass) > advIdx)) return null

  // Deras färgöppning på 1–2-läget (3+ = spärr, hål 4 — rörs inte här).
  const bids = f.contractBids
  if (side(bids[0].seat) === side(seat)) return null
  const openCb = parseContractBid(bids[0].bid)!
  if (!SUIT_OF_LETTER[openCb.strain] || openCb.level > 2) return null

  // Partnerns färg måste vara OBJUDEN av dem (cue har egen väg).
  const theirSuits = new Set<Suit>()
  for (const c of bids) {
    if (side(c.seat) === side(seat)) continue
    const s = SUIT_OF_LETTER[parseContractBid(c.bid)!.strain]
    if (s) theirSuits.add(s)
  }
  const advSuit = SUIT_OF_LETTER[parseContractBid(advCall.bid)!.strain]
  if (!advSuit || theirSuits.has(advSuit)) return null

  if (hcp(hand) >= 17) return null // starka X-flödet tar över

  const decline = (why: string): Kunskap => ({ call: 'P', rule: 'dubblaren nöjer sig', explanation: why })

  // Flykt över deras XX lovar INGA poäng → höj aldrig.
  const xxEscape = history.some((c, i) => i < advIdx && c.bid === 'XX' && side(c.seat) !== side(seat))
  if (xxEscape) return decline('Partnerns flykt över redubblingen var tvingad (lovar inga poäng) – pass.')

  const support = lengths(hand)[advSuit]
  if (support < 3) return decline(`Utan stöd i partnerns ${SWE_SYM[letterOfSuit(advSuit)]} – pass.`)

  // Hopp eller ej: partnerns svar mot billigaste möjliga nivån vid den punkten.
  let prevLevel = 0
  let prevRank = -1
  for (let i = 0; i < advIdx; i++) {
    const cb = parseContractBid(history[i].bid)
    if (!cb) continue
    prevLevel = cb.level
    prevRank = SUIT_STRAINS.indexOf(cb.strain as (typeof SUIT_STRAINS)[number])
  }
  const advCb = parseContractBid(advCall.bid)!
  const advRank = SUIT_STRAINS.indexOf(advCb.strain as (typeof SUIT_STRAINS)[number])
  const minLevel = advRank > prevRank ? Math.max(prevLevel, 1) : prevLevel + 1
  const wasJump = advCb.level > minLevel

  const sp = dummyPoints(hand, advSuit).dummyPoints
  const isMajor = advSuit === 'hearts' || advSuit === 'spades'
  const legal = legalCalls(history, seat)
  const gameBid = `${isMajor ? 4 : 5}${letterOfSuit(advSuit)}` as Bid

  if (wasJump) {
    // Partnerns hopp = 9–11 (inbjudan): acceptera i högfärg med 15+.
    if (sp >= 15 && isMajor && legal.includes(gameBid)) {
      return { call: gameBid, rule: 'dubblaren accepterar inbjudan', explanation: `Utgångsvärden mot partnerns hoppbud (9–11) → utgång ${gameBid}.` }
    }
    return decline(`Minimum – avböjer partnerns inbjudan (accept kräver 15+).`)
  }

  // Fritt icke-hopp = ~6–9.
  if (sp >= (isMajor ? 19 : 21) && legal.includes(gameBid)) {
    return { call: gameBid, rule: 'dubblaren bjuder utgång', explanation: `Utgångsvärden mot partnerns fria svar (~6–9) → utgång ${gameBid}.` }
  }
  if (sp >= 16) {
    const raise = cheapestBidIn(history, seat, letterOfSuit(advSuit))
    if (raise && parseContractBid(raise)!.level < (isMajor ? 4 : 5) && legal.includes(raise)) {
      return { call: raise, rule: 'dubblaren höjer (inbjudan)', explanation: `Inbjudan med 3+ stöd → ${prettyBid(raise)} (mot partnerns fria svar).` }
    }
  }
  return decline(`Minimum – partnerns fria svar lovar ~6–9, utgång kräver mer.`)
}

/**
 * Dubblaren efter advancerns 2NT (frö 20270004, facit-kön): partnerns 2NT över
 * min upplysningsdubbling visar 9–11 balanserat med stopp i deras färg
 * (fritt när de bjöd över X:et, hopp när de passade). Med 14+ hp mot det
 * finns utgången → 3NT; annars pass (uttryckligt — förr saknades regeln och
 * 14-poängaren passade). Bara mot deras 1–2-lägesöppning i färg.
 */
export function doublerAnswersAdvancers2NT(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const ourNonPass = history.filter((c) => side(c.seat) === side(seat) && c.bid !== 'P')
  if (ourNonPass.length !== 2 || ourNonPass[0].seat !== seat || ourNonPass[0].bid !== 'X') return null
  const nt = ourNonPass[1]
  if (nt.seat !== PARTNER[seat] || nt.bid !== '2NT') return null
  const last = f.lastNonPass
  if (!last) return null
  if (last !== nt && !(side(last.seat) !== side(seat) && history.indexOf(last) > history.indexOf(nt))) return null
  const open = f.opening
  if (!open || open.level > 2) return null
  const p = hcp(hand)
  if (p >= 14 && legalCalls(history, seat).includes('3NT')) {
    return { call: '3NT', rule: 'dubblaren höjer till 3NT', explanation: `Partnerns 2NT visade 9–11 med stopp i deras ${SWE_SYM[open.strain]}; med 14+ hp mot det → 3NT.` }
  }
  return { call: 'P', rule: 'dubblaren nöjer sig', explanation: `Partnerns 2NT visade 9–11 – utgång kräver 14+ hos mig → pass.` }
}

/**
 * Står `seat`s egen 17+ UPPLYSNINGSDUBBLING och väntar på det starka återbudet?
 * Mönstret (ägarregel, felrapport #23): motståndaren öppnade 1 i färg, VÅR X är
 * mitt enda egna bud hittills (jag har ännu inte visat färg), och nu är det min
 * tur igen. Med 17+ hp och en lång egen färg "överröstar" jag partnern och bjuder
 * min färg – det är signalen för den starka enfärgshanden som var för stark för
 * ett enkelt inkliv. Jag visar färgen BILLIGAST (rondkrav) och hoppar aldrig rakt
 * till utgång: partnerns svar var framtvingat och kan vara 0 hp (ägarbeslut
 * 2026-07-05). Game/delkontrakt avgörs på nästa varv utifrån partnerns svar.
 */
export function ownStrongDoubleRebid(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || side(open.seat) === side(seat) || open.level !== 1) return null
  // Mitt enda egna icke-pass-bud hittills = X (upplysningsdubblingen).
  const myActions = history.filter((c) => c.seat === seat && c.bid !== 'P')
  if (myActions.length !== 1 || myActions[0].bid !== 'X') return null

  // ALLA färger motståndarna bjudit (öppning + ev. svarsfärg) – vår färg måste
  // vara en OBJUDEN (annars "återbjuder" den starka handen deras egen färg, t.ex.
  // hjärter efter 1♦–1♥–X).
  const theirSuits = new Set<Suit>()
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (cb && side(c.seat) !== side(seat)) {
      const s = SUIT_OF_LETTER[cb.strain]
      if (s) theirSuits.add(s)
    }
  }

  if (hcp(hand) < 17) return null
  const len = lengths(hand)
  // Min längsta egna 5+ OBJUDNA färg; lika längd → högre rankad.
  let suit: Suit | null = null
  for (const st of SUIT_STRAINS) {
    const s = SUIT_OF_LETTER[st]
    if (theirSuits.has(s) || len[s] < 5) continue
    if (!suit || len[s] > len[suit] || (len[s] === len[suit] && st > letterOfSuit(suit))) suit = s
  }
  if (!suit) return null

  const letter = letterOfSuit(suit)
  const legal = legalCalls(history, seat)

  // Visa färgen BILLIGAST (rondkrav; jag "överröstar" partnern). Ägarbeslut
  // 2026-07-05: hoppa ALDRIG rakt till utgång här – partnerns svar var
  // framtvingat och kan vara 0 hp, så ett game-hopp kan bli katastrof. Grunden i
  // systemet är att ta det långsamt: X + egen färg är redan rondkrav och visar
  // den starka handen; game/delkontrakt avgörs på nästa varv utifrån partnerns svar.
  const bid = cheapestBidIn(history, seat, letter)
  if (!bid || !legal.includes(bid)) return null
  return {
    call: bid, rule: 'starkt återbud',
    explanation: `17+ hp – jag bjuder min egna ${SWE_SYM[letter]} över dubblingen (för stark för ett enkelt inkliv, rondkrav – game avgörs nästa varv).`,
  }
}

// ---- Den starka upplysningsdubblingens fortsättning (flerronds, ägarbeslut
//      2026-07-05) ----------------------------------------------------------
// Efter (1x)–X–(P)–svar–(P)–egen färg (det starka återbudet, se
// `ownStrongDoubleRebid`) fortsätter auktionen KONTROLLERAT i stället för att dö:
//   • partnern (advancern) MÅSTE svara på återbudet (stöd-stege eller, utan stöd,
//     eget/näst längsta objudna – tvång, lovar inga poäng),
//   • den starka handen dömer på nästa varv (5-korts / <22 TP = lägsta nivå;
//     6+ & 22+ TP = hopp till 3-läget = utgångskrav),
//   • advancern svarar 3-hoppet (3NT nekar / 4M med 1–2 korts stöd).
// TP = startpoäng (`startingPoints`). Läget läses ur `facts.strongDouble`.

/**
 * ADVANCERN svarar på det starka återbudet (tvång – får aldrig passa). Med 3-korts
 * stöd en stödstege graderad efter hp (0–3 = enkel höjning, 4–6 = hopphöjning,
 * 7–9 = utgång, 10+ = cue m. slamintresse); utan stöd bjuder advancern om sin egen
 * färg (5+) eller näst längsta objudna färg – lovar då INGA poäng. Ägarbeslut
 * 2026-07-05. Kör bara på advancerns FÖRSTA svar på återbudet (Part 2).
 */
export function advanceStrongDoubleRebid(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const ctx = f.strongDouble
  if (!ctx || ctx.role !== 'advancer') return null
  // Part 2: dubblaren har gjort ETT återbud, advancern har svarat X:et EN gång
  // (tvångssvaret) och ska nu svara själva återbudet.
  if (ctx.doublerBids.length !== 1 || ctx.advancerBids.length !== 1) return null

  const p = hcp(hand)
  const len = lengths(hand)
  const suit = ctx.doublerSuit
  const letter = letterOfSuit(suit)
  const support = len[suit]
  const legal = legalCalls(history, seat)
  const shownLevel = ctx.doublerBids[0].level
  const isMajor = suit === 'hearts' || suit === 'spades'
  const gameLevel = isMajor ? 4 : 5

  // Partnerns återbud nådde redan utgång → tvånget är uppfyllt. Höj ALDRIG
  // förbi utgång på stödstege/tvångssvar (samma princip som felrapport #33);
  // slamutredning hör inte hemma i det här tvångsläget.
  if (shownLevel >= gameLevel) return null

  const bidAt = (level: number): Bid | null => {
    const b = `${level}${letter}` as Bid
    return legal.includes(b) ? b : null
  }

  if (support >= 3) {
    // Stödstege (hp): 0–3 enkel höjning, 4–6 hopphöjning, 7–9 utgång, 10+ cue.
    if (p >= 10) {
      const cue = cheapestBidIn(history, seat, ctx.openStrain)
      if (cue && legal.includes(cue)) {
        return { call: cue, rule: 'stöd-cue (slamintresse)', explanation: `Utgångsvärden + 3+ stöd i ${SWE_SYM[letter]} → cue i deras färg = utgång + slamintresse.` }
      }
    }
    const target = p >= 7 ? gameLevel : p >= 4 ? Math.min(shownLevel + 2, gameLevel) : Math.min(shownLevel + 1, gameLevel)
    const bid = bidAt(target) ?? bidAt(shownLevel + 1)
    if (bid) {
      const label = target >= gameLevel ? 'utgång' : p >= 4 ? 'hopphöjning (inbjudan)' : 'enkel höjning (minimum)'
      return { call: bid, rule: `stödhöjning – ${label}`, explanation: `3+ stöd → ${prettyBid(bid)} (${label}; tvunget svar på det starka återbudet).` }
    }
  }

  // Utan 3-korts stöd: bjud om egen färg (5+), annars näst längsta OBJUDNA färg.
  // Tvång – lovar inga poäng. (Fri-bud senare = värden, hanteras av andra varv.)
  const firstSuit = SUIT_OF_LETTER[ctx.advancerBids[0].strain]
  const unbid = SUIT_STRAINS.map((st) => SUIT_OF_LETTER[st])
    .filter((s) => !ctx.theirSuits.has(s) && s !== suit)
    .sort((a, b) => len[b] - len[a] || SUIT_STRAINS.indexOf(letterOfSuit(b)) - SUIT_STRAINS.indexOf(letterOfSuit(a)))
  let chosen: Suit | null = null
  if (firstSuit && len[firstSuit] >= 5) chosen = firstSuit
  else chosen = unbid.find((s) => s !== firstSuit) ?? unbid[0] ?? firstSuit ?? null
  if (chosen) {
    const bid = cheapestBidIn(history, seat, letterOfSuit(chosen))
    if (bid && legal.includes(bid)) {
      const same = chosen === firstSuit
      return { call: bid, rule: 'tvångssvar (utan stöd)', explanation: `Utan stöd i ${SWE_SYM[letter]} → ${same ? `bjuder om min ${SWE_SYM[letterOfSuit(chosen)]} (5+)` : `näst längsta objudna (${SWE_SYM[letterOfSuit(chosen)]})`} = tvång, lovar inga poäng.` }
    }
  }
  // Nödfall (ingen färg att visa): ge minsta stöd i dubblarens färg (fortsatt tvång).
  const fallback = cheapestBidIn(history, seat, letter)
  if (fallback && legal.includes(fallback)) {
    return { call: fallback, rule: 'tvångssvar (preferens)', explanation: `Inget eget bud → minsta preferens i ${SWE_SYM[letter]} (tvunget svar).` }
  }
  return null
}

/**
 * Den STARKA HANDEN (dubblaren) dömer på sitt andra återbud efter advancerns svar.
 * Höjde advancern dubblarens färg (stöd) hanteras det längre ned; visade advancern
 * INGET stöd (bjöd egen/annan färg) gäller ägarbeslutet 2026-07-05: bjud om färgen
 * på LÄGSTA nivå (5-korts, eller 6+ men < 22 TP), eller HOPPA till 3-läget =
 * utgångskrav (6+ korts färg OCH ≥ 22 TP). TP = startpoäng.
 */
export function strongDoublerSecondRebid(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const ctx = f.strongDouble
  if (!ctx || ctx.role !== 'doubler') return null
  // Part 3: dubblaren har gjort ETT återbud, advancern har svarat på det (2 bud).
  if (ctx.doublerBids.length !== 1 || ctx.advancerBids.length !== 2) return null

  const len = lengths(hand)
  const suit = ctx.doublerSuit
  const letter = letterOfSuit(suit)
  const legal = legalCalls(history, seat)
  const isMajor = suit === 'hearts' || suit === 'spades'
  const gameLevel = isMajor ? 4 : 5
  const shownLevel = ctx.doublerBids[0].level

  // Höjde advancern VÅR färg? (stöd visat) → döm game efter partnerns visade spann.
  const advancerRaised = SUIT_OF_LETTER[ctx.advancerBids[1].strain] === suit
  const advancerCued = ctx.theirSuits.has(SUIT_OF_LETTER[ctx.advancerBids[1].strain] ?? ('' as Suit))
  if (advancerRaised || advancerCued) {
    // ⚠️ KONSERVATIV DEFAULT (ägaren ska finslipa i spel, se 👀 Bevaka): en cue
    // (slamintresse) eller redan nådd utgång får aldrig passas – annars stannar vi.
    const raiseLevel = advancerRaised ? ctx.advancerBids[1].level : 0
    if (raiseLevel >= gameLevel) return null // partnern bjöd redan utgång → passa (annan logik/pass)
    const game = `${gameLevel}${letter}` as Bid
    if (advancerCued && legal.includes(game)) {
      return { call: game, rule: 'accepterar (minimum)', explanation: `Partnerns cue visade slamintresse; med minimum stannar jag i utgång ${game}.` }
    }
    // Höjning under utgång (2M minimum / 3M inbjudan): acceptera utgång med tillägg.
    const p = hcp(hand)
    const accept = raiseLevel >= shownLevel + 2 ? p >= 18 : p >= 21
    if (accept && legal.includes(game)) {
      return { call: game, rule: 'accepterar utgång', explanation: `Utgångsvärden mittemot partnerns stödhöjning → utgång ${game}.` }
    }
    return null // minimum → passa höjningen (delkontrakt)
  }

  // Advancern visade INGET stöd (bjöd egen/annan färg). Ägarbeslut 2026-07-05:
  const tp = startingPoints(hand).startingPoints
  const sixPlus = len[suit] >= 6
  if (sixPlus && tp >= 22 && shownLevel === 1) {
    const jump = `3${letter}` as Bid
    if (legal.includes(jump)) {
      return { call: jump, rule: 'starkt återbud (utgångskrav)', explanation: `6+ ${SWE_SYM[letter]} (≥22 med fördelning) → hopp till ${prettyBid(jump)} = utgångskrav.` }
    }
  }
  // Annars: bjud om färgen på lägsta nivå (ej krav; delkontrakt mot en tom partner).
  const low = cheapestBidIn(history, seat, letter)
  if (low && legal.includes(low)) {
    return { call: low, rule: 'starkt återbud (lägsta)', explanation: `6+ ${SWE_SYM[letter]} – bjuder om färgen lägst (${prettyBid(low)}); ej utgångskrav mot ett tvångssvar.` }
  }
  return null
}

/**
 * ADVANCERN svarar den starka handens 3-hopp (utgångskrav). Ägarbeslut 2026-07-05:
 * nekar helt stöd och är svagast möjliga → 3NT; med 1–2 korts stöd i färgen → bjud
 * utgång i färgen (minimum men utgång). Kör bara efter ett 3-läges-hopp i dubblarens
 * färg (Part 4).
 */
export function answerStrongDoubleGameForce(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const ctx = f.strongDouble
  if (!ctx || ctx.role !== 'advancer') return null
  // Part 4: dubblaren har gjort TVÅ återbud, advancern svarat EN gång på återbudet.
  if (ctx.doublerBids.length !== 2 || ctx.advancerBids.length !== 2) return null
  const suit = ctx.doublerSuit
  const letter = letterOfSuit(suit)
  const second = ctx.doublerBids[1]
  const support = lengths(hand)[suit]
  const legal = legalCalls(history, seat)
  const game = `${suit === 'hearts' || suit === 'spades' ? 4 : 5}${letter}` as Bid

  // Gren A: HOPPET till 3-läget i dubblarens färg (från ett 1-läges återbud) = krav.
  if (second.strain === letter && second.level === 3 && ctx.doublerBids[0].level === 1) {
    if (support >= 1 && legal.includes(game)) {
      return { call: game, rule: 'utgång (1–2 korts stöd)', explanation: `Utgångskravet accepteras: stöd i ${SWE_SYM[letter]} → ${prettyBid(game)} (minimum men utgång).` }
    }
    if (legal.includes('3NT')) {
      return { call: '3NT', rule: 'nekar stöd (3NT)', explanation: `Nekar helt stöd i ${SWE_SYM[letter]}, svagast möjliga → 3NT.` }
    }
    return null
  }

  // Gren B (Speldiagnosen S0, frö 20260772): dubblarens andra återbud var LÅGT
  // (ej krav) — men en advancer som ÖPPNADE med CUE har redan visat värden och
  // får inte lämna auktionen regellöst. Utan fixen höjde motorn i stället
  // regellöst till 4♥ på A9 DUBBELTON mot visade fyra (4-2-utgång, 6 bet), och
  // med enbart fit-vakten blev det regellös PASS på 14 hp. Domen: 3-korts stöd →
  // utgång i färgen; annars 12+ hp med stopp i deras färg(er) → 3NT (facit på
  // given: 3NT jämnt hem). I övrigt: lämna vidare (pass är rätt mot minimum).
  const gameLevel = suit === 'hearts' || suit === 'spades' ? 4 : 5
  const advancerFirst = SUIT_OF_LETTER[ctx.advancerBids[0].strain]
  const advancerCuedFirst = !!advancerFirst && ctx.theirSuits.has(advancerFirst)
  if (second.strain !== letter || second.level >= gameLevel || !advancerCuedFirst) return null
  const p = hcp(hand)
  if (support >= 3 && legal.includes(game)) {
    return { call: game, rule: 'cue-advancerns dom (utgång)', explanation: `Cuen visade redan mina värden; med stöd i ${SWE_SYM[letter]} → utgång ${game}.` }
  }
  const stoppAlla = [...ctx.theirSuits].every((s) => hasStopper(hand, s))
  if (p >= 12 && stoppAlla && legal.includes('3NT')) {
    return { call: '3NT', rule: 'cue-advancerns dom (3NT)', explanation: `Cuen visade redan mina värden; utan fit i ${SWE_SYM[letter]} men med stopp i deras färg → 3NT.` }
  }
  return null
}

// ============================================================================
// Sist i båda raderna: preferens och "tävla till fiten" (samma funktioner som
// inklivsfamiljen; det gamla lagret körde dem EFTER dubblarens vakter när
// någon på vår sida dubblat — samma ordning här).
// ============================================================================

export function doubleSideCompetes(hand: Hand, f: AuctionFacts): Kunskap | null {
  return advancerPrefersOvercallSuit(hand, f) ?? advancerCompetesToFit(hand, f)
}

