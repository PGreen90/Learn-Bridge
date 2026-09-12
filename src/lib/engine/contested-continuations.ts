// ÖPPNARENS OCH SVARARENS FORTSÄTTNING NÄR DE STÖRT VÅR ÖPPNING — systembok
// §5.4, §5.5, §5.8, §5.9, §5.10 och §7.4; motorbytets etapp 4 familj 4
// (2026-09-08). Kunskapsfunktioner för beslutstabellen (`auction-decide.ts`):
// EGEN hand + auktionsläget (`AuctionFacts`, läst ur auktionen ensam) → ett
// bud, eller null när regeln inte gäller läget. Ingen annan hand finns att
// läsa här.
//
// Innehållet är de tolv detektorerna som förr låg i `auction-live.ts`
// (answerCueRaise, openerCompetesAfterRaise/answerOpenerMaximal,
// openerStrongNTAfterMinorRaise/answerOpenerNTInvite, openerRaisesFreeBid/
// responderAfterFreeBidRaise/openerAnswersFreeBidInvite,
// openerRondTwoInCompetition, openerReopensAfterPartnerPass,
// openerReopensBalancing, answerCueBidderRebid) — samma bridgekunskap, nu
// som rena funktioner av hand + fakta — plus det som saknades:
//   · öppnarens återbud efter partnerns fria bud UTAN fit (§5.5: fritt bud
//     är rondkrav — förr föll öppnaren till det gamla lagrets catch-all, som
//     bjöd reverse på 14 hp och 4♠ på 13);
//   · svararens fortsättning efter sitt fria bud när öppnaren inte höjde
//     (egen 6+ före 3-korts fit, facit 20262632);
//   · svaret på partnerns cue i konkurrens (§5.8: "hjälp mig välja utgång"
//     — förr passades öppnarens cue, frö 20270156);
//   · negativ-dubblarens ojämna 13+ utan stopp → cue (utgångskrav);
//   · §5.8-fiten mäts mot vad svaret LOVADE: ett fritt högfärgsbud 5+ (tre
//     räcker), ett ostört 1-lägessvar 4+ (fyra krävs) — sekvensen
//     1x–(P)–1y–(inkliv) finns i botauktionerna först nu, när RHO:s inkliv
//     över svaret bjuds (raden *inkliv-över-svaret*, `overcallOfResponse`).

import type { Bid, Hand } from '../../types/bridge'
import { isGameOrHigher, parseContractBid, PARTNER, SUIT_OF_LETTER, SUIT_STRAINS, type AuctionFacts } from './auction-facts'
import { bidValue, cheapestBidIn, legalCalls, prettyBid, SWE_SYM } from './auction-rules'
import { pointsWithFloor } from './evaluation'
import { hcp, isBalanced, lengths, suitHcp } from './hand'
import { hasStopper } from './overcalls'
import { cueBidderContinues, type Kunskap } from './overcall-continuations'
import { side, NEXT_SEAT } from './play'
import { openerThirdBidAfterOwnRaise } from './rebids'
import type { Major } from './responses'

const isMajorStrain = (st: string) => st === 'H' || st === 'S'
const gameLevelOf = (st: string) => (st === 'NT' ? 3 : isMajorStrain(st) ? 4 : 5)

// ============================================================================
// Lägesläsare (raderna *öppnaren-stört* / *svararen-stört*)
// ============================================================================

/** Har motståndarna gjort något annat än pass (kontraktsbud eller X)? */
function theyActed(f: AuctionFacts): boolean {
  return f.history.some((c) => side(c.seat) !== side(f.seat) && c.bid !== 'P')
}

/**
 * Öppnarens senare turer i en STÖRD auktion: jag öppnade 1 i färg och
 * motståndarna har bjudit eller dubblat. Familj 3:s öppnarrader
 * (stöddubblingen, svaret på den negativa dubblingen, Jordan) ligger före i
 * tabellen och tar sina lägen; kunskapsfunktionerna nedan läser var och en
 * sitt exakta mönster och svarar null annars.
 */
export function openerContestedSeat(f: AuctionFacts): boolean {
  const o = f.opening
  return !!o && o.seat === f.seat && o.level === 1 && o.strain !== 'NT' && theyActed(f)
}

/** Svararens senare turer i en STÖRD auktion: partnern öppnade 1 i färg och motståndarna har bjudit eller dubblat. */
export function responderContestedSeat(f: AuctionFacts): boolean {
  const o = f.opening
  return !!o && o.seat === f.partner && o.level === 1 && o.strain !== 'NT' && theyActed(f)
}

/**
 * Har PARTNERN cue-bjudit motståndarnas färg som HÖJNING av vår öppning
 * (limithöjning+, §7.4)? Mönstret: vår färgöppning, exakt två kontraktsbud
 * från vår sida (öppningen + partnerns cue), cuet i en färg motståndarna
 * bjudit, cuet senaste kontraktsbudet (bara pass efter), jag är öppnaren.
 */
export function partnerCueRaiseToAnswer(f: AuctionFacts): { agreedStrain: string; theirStrain: string } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain === 'NT') return null
  if (side(open.seat) !== side(seat) || seat !== open.seat) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2) return null
  if (ourBids[0].seat !== seat || ourBids[1].seat !== PARTNER[seat]) return null
  const cue = ourBids[1]
  const cueStrain = parseContractBid(cue.bid)!.strain
  if (cueStrain === 'NT') return null
  if (!f.theirStrains.has(cueStrain)) return null
  const cueIdx = history.indexOf(cue)
  if (history.slice(cueIdx + 1).some((c) => parseContractBid(c.bid))) return null
  return { agreedStrain: open.strain, theirStrain: cueStrain }
}

/**
 * Det INKLÄMDA läget (§5.4): vår 1♥/1♠, ett inkliv, partnerns enkla höjning
 * 2M, och motståndarna konkurrerade så att cuet hamnar ÖVER 3M. Då är X game
 * try (maximal dubbling). Returnerar högfärgen, annars null.
 */
export function openerMaximalToAnswer(f: AuctionFacts): { major: string } | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || !isMajorStrain(open.strain) || open.level !== 1) return null
  if (open.seat !== seat) return null
  const M = open.strain
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2) return null
  if (ourBids[0].seat !== seat || ourBids[1].seat !== PARTNER[seat]) return null
  const raise = parseContractBid(ourBids[1].bid)!
  if (raise.strain !== M || raise.level !== 2) return null
  const contractBids = f.contractBids
  const lastContract = contractBids[contractBids.length - 1]
  if (side(lastContract.seat) === side(seat)) return null
  const theirStrain = parseContractBid(lastContract.bid)!.strain
  if (theirStrain === 'NT' || theirStrain === M) return null
  const lastIdx = history.indexOf(lastContract)
  if (history.slice(lastIdx + 1).some((c) => parseContractBid(c.bid))) return null
  const cue = cheapestBidIn(history, seat, theirStrain)
  const threeM = `3${M}` as Bid
  if (!cue || !legalCalls(history, seat).includes(threeM)) return null
  const cb = parseContractBid(cue)!
  if (bidValue(cb.level, cb.strain) <= bidValue(3, M)) return null
  return { major: M }
}

/**
 * Partnerns CUE i motståndarnas färg väntar på mitt svar (§5.8 "hjälp mig
 * välja utgång", negativ-dubblarens cue): partnerns senaste bud är ett
 * kontraktsbud i en färg motståndarna bjudit, bara pass efter, under utgång,
 * och det är INTE cue-höjningen av vår öppning (egen läsare ovan) eller
 * cue-bjudarens egen fortsättning. Returnerar deras färg.
 */
export function partnerCueToAnswer(f: AuctionFacts): { theirStrain: string } | null {
  const last = f.lastContract
  if (!last || last.seat !== f.partner || !f.quietSinceLastContract) return null
  const cb = parseContractBid(last.bid)!
  if (cb.strain === 'NT' || !f.theirStrains.has(cb.strain)) return null
  // Vår egen färg (öppningen, ett fritt bud) är aldrig ett cue även om de
  // cue-bjudit den (frö 20270117: 1♥–(2♣)–P–(2♥)–3♥ är hjärterrebud).
  if (f.ourContractBids.some((c) => c !== last && parseContractBid(c.bid)!.strain === cb.strain)) return null
  if (bidValue(cb.level, cb.strain) >= bidValue(gameLevelOf(cb.strain), cb.strain)) return null
  if (partnerCueRaiseToAnswer(f)) return null
  return { theirStrain: cb.strain }
}

// ============================================================================
// Kunskap — öppnaren
// ============================================================================

/** Öppnaren svarar partnerns cue-höjning (felrapport #16): 3NT-vägen i minorfit, utgång med 15+, annars billigast i vår färg. */
export function openerAnswersCueRaise(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const cueRaise = partnerCueRaiseToAnswer(f)
  if (!cueRaise) return null
  const strain = cueRaise.agreedStrain
  const isMajor = isMajorStrain(strain)
  const signoff = cheapestBidIn(history, seat, strain)
  const gameBid = `${isMajor ? 4 : 5}${strain}` as Bid
  const legal = legalCalls(history, seat)
  if (!isMajor && isBalanced(hand) && hasStopper(hand, SUIT_OF_LETTER[cueRaise.theirStrain]) && legal.includes('3NT' as Bid)) {
    return {
      call: '3NT', rule: 'svar på cue-höjning',
      explanation: `Partnerns cue lovar minst limithöjning i ${SWE_SYM[strain]}; jämn hand med stopp i deras ${SWE_SYM[cueRaise.theirStrain]} → 3NT (rätt utgång före 5${SWE_SYM[strain]}).`,
    }
  }
  const acceptGame = hcp(hand) >= 15 && legal.includes(gameBid)
  const bid = (acceptGame ? gameBid : signoff) as Bid | null
  if (!bid || !legal.includes(bid)) return null
  return {
    call: bid, rule: 'svar på cue-höjning',
    explanation: acceptGame
      ? `Partnerns cue lovar minst limithöjning i ${SWE_SYM[strain]}; jag är maximum → accepterar utgång ${bid}.`
      : `Partnerns cue lovar minst limithöjning i ${SWE_SYM[strain]} och är krav; med ett minimum återgår jag billigast i vår färg (${prettyBid(bid)}).`,
  }
}

/** §5.4: öppnarens val i det inklämda läget — 4M / X (game try) / 3M (6:e trumfen) / pass. */
export function openerCompetesAfterRaise(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const m = openerMaximalToAnswer(f)
  if (!m) return null
  const M = m.major
  const suit = SUIT_OF_LETTER[M]
  const bp = pointsWithFloor(hand, suit, 'bergen').points
  const legal = legalCalls(history, seat)
  const game = `4${M}` as Bid
  const threeM = `3${M}` as Bid
  const mSym = SWE_SYM[M]
  if (bp >= 18 && legal.includes(game)) {
    return { call: game, rule: 'öppnaren bjuder utgång i konkurrens', explanation: `Utgångsvärden mittemot partnerns höjning → utgång ${game} i ${mSym}.` }
  }
  if (bp >= 15 && legal.includes('X')) {
    return {
      call: 'X', rule: 'maximal dubbling (game try)',
      explanation: `Utgångsintresse mittemot en 6–9-höjning – motståndarnas bud kläm­mer bort cue-budet, så X är game try: partnern bjuder ${game} med ett maximum, annars ${threeM}.`,
    }
  }
  if (lengths(hand)[suit] >= 6 && legal.includes(threeM)) {
    return {
      call: threeM, rule: 'öppnaren konkurrerar (6:e trumfen)',
      explanation: `Minimum men 6:e trumfen (9+ trumf ihop) → ${prettyBid(threeM)} på lagen om totala stick (ej krav); säljer inte given billigt.`,
    }
  }
  return {
    call: 'P', rule: 'öppnaren passar i konkurrens',
    explanation: `Dött minimum mittemot partnerns enkla höjning (6–9) – jag konkurrerar inte utan försvarar deras kontrakt.`,
  }
}

/** §5.10: vår minor höjd i konkurrens, stark sangduglig hand med stopp → 3NT (20+) / 2NT (18–19). */
export function openerStrongNTAfterMinorRaise(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || (open.strain !== 'C' && open.strain !== 'D') || open.level !== 1) return null
  if (open.seat !== seat) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2 || ourBids[0].seat !== seat || ourBids[1].seat !== PARTNER[seat]) return null
  const raise = parseContractBid(ourBids[1].bid)!
  if (raise.strain !== open.strain) return null
  const theirBids = f.contractBids.filter((c) => side(c.seat) !== side(seat) && parseContractBid(c.bid)!.strain !== 'NT')
  if (theirBids.length === 0) return null
  const theirStrain = parseContractBid(theirBids[theirBids.length - 1].bid)!.strain
  const len = lengths(hand)
  if (!hasStopper(hand, SUIT_OF_LETTER[theirStrain])) return null
  if (!isBalanced(hand) && len[SUIT_OF_LETTER[open.strain]] < 6) return null
  const p = hcp(hand)
  const legal = legalCalls(history, seat)
  if (p >= 20 && legal.includes('3NT' as Bid)) {
    return { call: '3NT', rule: 'öppnarens 3NT i konkurrens', explanation: `Jämn/sangduglig hand med stopp i ${SWE_SYM[theirStrain]} mittemot partnerns höjning → 3NT (utgång).` }
  }
  if (p >= 18 && legal.includes('2NT' as Bid)) {
    return {
      call: '2NT', rule: 'öppnarens 2NT-inbjudan i konkurrens',
      explanation: `Jämn hand med stopp i ${SWE_SYM[theirStrain]} – för starkt för ett tyst färgbud → 2NT (inbjudan; partnern bjuder 3NT med ett maximum).`,
    }
  }
  return null
}

/** Står partnerns FRIA bud som senaste kontraktsbud med bara pass efter, och är det min (öppnarens) tur? */
function freeBidStands(f: AuctionFacts): NonNullable<AuctionFacts['freeBid']> | null {
  const ctx = f.freeBid
  if (!ctx || ctx.opener !== f.seat || ctx.contracts.length !== 3) return null
  const freeCall = ctx.contracts[2]
  if (f.history.slice(f.history.indexOf(freeCall) + 1).some((c) => c.bid !== 'P')) return null
  return ctx
}

/**
 * Felrapport #55 (del 2) + pliktsvepet K5: ÖPPNAREN höjer partnerns fria bud
 * på 3-korts stöd (budet lovar 5+). Högfärg: 12–15 enkel, 16–18 hopp
 * (inbjudan), 19+ utgång (14+ efter ett 2-läges fritt bud = 10+). Lågfärg på
 * 2-läget: 12–13 → 3m, 14+ → 3NT med stopp, annars 4m. Utan stöd → null
 * (`openerRebidsAfterFreeBid`).
 */
export function openerRaisesFreeBid(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const ctx = freeBidStands(f)
  if (!ctx) return null
  const strain = ctx.free.strain
  const suit = SUIT_OF_LETTER[strain]
  if (lengths(hand)[suit] < 3) return null
  const tp = hcp(hand)
  const legal = legalCalls(history, seat)
  const simple = cheapestBidIn(history, seat, strain)
  if (!simple) return null
  const simpleLevel = parseContractBid(simple)!.level
  if (strain === 'C' || strain === 'D') {
    if (ctx.free.level < 2) return null
    const theirStrain = parseContractBid(ctx.contracts[1].bid)!.strain
    if (tp >= 14 && hasStopper(hand, SUIT_OF_LETTER[theirStrain]) && legal.includes('3NT' as Bid)) return {
      call: '3NT', rule: 'höjning av fritt bud (utgång)',
      explanation: `Partnerns fria bud lovar 5+ ${SWE_SYM[strain]} (10+ hp); stöd, utgångsvärden och stopp i deras ${SWE_SYM[theirStrain]} → 3NT (rätt utgång före 5${SWE_SYM[strain]}).`,
    }
    const jump = `${simpleLevel + 1}${strain}` as Bid
    if (tp >= 14 && simpleLevel + 1 <= 4 && legal.includes(jump)) return {
      call: jump, rule: 'höjning av fritt bud (inbjudan)',
      explanation: `Partnerns fria bud lovar 5+ ${SWE_SYM[strain]}; stöd och extra utan stopp i deras ${SWE_SYM[theirStrain]} → hopphöjning ${prettyBid(jump)} (inbjudan till 5${SWE_SYM[strain]}).`,
    }
    if (!legal.includes(simple)) return null
    return {
      call: simple, rule: 'höjning av fritt bud',
      explanation: `Partnerns fria bud lovar 5+ ${SWE_SYM[strain]} (10+ hp); 3+ stöd → ${prettyBid(simple)} (enkel höjning, minimum 12–13).`,
    }
  }
  const game = `4${strain}` as Bid
  const gameFloor = ctx.free.level >= 2 ? 14 : 19
  if (tp >= gameFloor && legal.includes(game)) return {
    call: game, rule: 'höjning av fritt bud (utgång)',
    explanation: `Partnerns fria bud lovar 5+ ${SWE_SYM[strain]} (${ctx.free.level >= 2 ? '10+ hp' : '6+ hp'}); 3+ stöd och utgångsvärden → ${prettyBid(game)}.`,
  }
  const jump = `${simpleLevel + 1}${strain}` as Bid
  if (tp >= 16 && simpleLevel + 1 <= 4 && legal.includes(jump)) return {
    call: jump, rule: 'höjning av fritt bud (inbjudan)',
    explanation: `Partnerns fria bud lovar 5+ ${SWE_SYM[strain]}; 3+ stöd och extra (16–18) → hopphöjning ${prettyBid(jump)} (inbjudan).`,
  }
  if (!legal.includes(simple)) return null
  return {
    call: simple, rule: 'höjning av fritt bud',
    explanation: `Partnerns fria bud lovar 5+ ${SWE_SYM[strain]}; 3+ stöd → ${prettyBid(simple)} (enkel höjning, minimum 12–15).`,
  }
}

/**
 * NYTT (familj 4): öppnarens återbud när partnerns fria bud står och jag
 * SAKNAR stöd (§5.5: fritt bud är rondkrav — öppnaren måste bjuda). Som det
 * ostörda återbudet, men sangen kräver stopp i deras färg:
 *   1. egen 6+ färg → rebjud den (billigast);
 *   2. jämn hand med stopp i deras färg → billigaste sang (≤17) / hopp i sang (18–19);
 *   3. ny 4+ färg som INTE är reverse → naturligt, billigast (längst först);
 *   4. reverse (ny färg över öppningsfärgen på 2-läget) → 17+;
 *   5. sist: rebjud öppningsfärgen (5 kort, minimum) — kravet passas aldrig.
 */
export function openerRebidsAfterFreeBid(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const ctx = freeBidStands(f)
  if (!ctx) return null
  const open = f.opening!
  const theirStrain = parseContractBid(ctx.contracts[1].bid)!.strain
  const theirSuit = SUIT_OF_LETTER[theirStrain]
  const len = lengths(hand)
  const p = hcp(hand)
  const legal = legalCalls(history, seat)
  const mySuit = SUIT_OF_LETTER[open.strain]
  // Ägarens 5-4/2NT-regler (2026-09-12) gäller BARA efter partnerns äkta fria bud
  // — dubblade VÅR sida (återöppning) är det en annan sekvens (behåll gammalt).
  const weDoubled = history.some((c) => side(c.seat) === side(seat) && c.bid === 'X')

  if (len[mySuit] >= 6) {
    const bid = cheapestBidIn(history, seat, open.strain)
    if (bid && legal.includes(bid)) return {
      call: bid, rule: 'återbud i konkurrens: egen 6+ färg',
      explanation: `Partnerns fria bud är rondkrav; utan stöd rebjuder jag min 6+ ${SWE_SYM[open.strain]} (${prettyBid(bid)}).`,
    }
  }
  // Stopp i deras färg → sang (ägarregel 2026-09-12: "när stopp, bjud sang").
  // Semi-balanserad räcker (ingen singel/renons) — en 5-4-2-2 med stopp visar
  // stoppet via 2NT hellre än sin andra färg.
  const semiBalanced = len.spades >= 2 && len.hearts >= 2 && len.diamonds >= 2 && len.clubs >= 2
  if ((weDoubled ? isBalanced(hand) : semiBalanced) && hasStopper(hand, theirSuit)) {
    const nts = (['1NT', '2NT', '3NT'] as Bid[]).filter((b) => legal.includes(b))
    if (p >= 18 && nts.length >= 2) return {
      call: nts[1], rule: 'återbud i konkurrens: sang (18–19)',
      explanation: `Jämn hand, 18–19 hp med stopp i deras ${SWE_SYM[theirStrain]}, inget stöd för partnerns fria bud → ${prettyBid(nts[1])} (hopp i sang).`,
    }
    // Efter partnerns fria bud: minimum-sang bara UTAN 5-korts högfärg (en
    // 5-korts högfärg rebjuds hellre — att gömma den i 2NT tappar en möjlig fit).
    // Återöppningsvägen (weDoubled) behåller gammalt beteende.
    if (nts.length >= 1 && (weDoubled || (len.hearts < 5 && len.spades < 5))) return {
      call: nts[0], rule: 'återbud i konkurrens: sang',
      explanation: `Stopp i deras ${SWE_SYM[theirStrain]}, inget stöd för partnerns fria bud → ${prettyBid(nts[0])} (minimum).`,
    }
  }
  // Ny färg: längst först, sedan billigast. Reverse = färgen rankar över
  // öppningsfärgen och budet hamnar på 2-läget eller högre (17+).
  const newSuits = SUIT_STRAINS
    .filter((st) => st !== open.strain && st !== theirStrain && st !== ctx.free.strain && len[SUIT_OF_LETTER[st]] >= 4)
    .sort((a, b) => len[SUIT_OF_LETTER[b]] - len[SUIT_OF_LETTER[a]] || SUIT_STRAINS.indexOf(a) - SUIT_STRAINS.indexOf(b))
  for (const st of newSuits) {
    const bid = cheapestBidIn(history, seat, st)
    if (!bid || !legal.includes(bid)) continue
    const cb = parseContractBid(bid)!
    const reverse = cb.level >= 2 && SUIT_STRAINS.indexOf(st) > SUIT_STRAINS.indexOf(open.strain as (typeof SUIT_STRAINS)[number])
    if (cb.level >= 3) continue // hoppskift/3-läget: inte här
    if (reverse) {
      // Konkurrens (ägarregel 2026-09-12): den HÖGRE nya färgen = 5-4 (5 i
      // öppningsfärgen + 4 i den nya) UTAN stopp i deras färg — öppningsstyrka
      // räcker, det är INTE ett styrke-reverse (17+). Med stopp bjöds 2NT ovan.
      if (!weDoubled && len[mySuit] >= 5 && len[SUIT_OF_LETTER[st]] >= 4 && !hasStopper(hand, theirSuit)) {
        return {
          call: bid, rule: 'återbud i konkurrens: 5-4 utan stopp',
          explanation: `5-4 (5 ${SWE_SYM[open.strain]} + 4 ${SWE_SYM[st]}) utan stopp i deras ${SWE_SYM[theirStrain]} → ${prettyBid(bid)} (öppningsstyrka, rondkrav).`,
        }
      }
      if (p >= 17) return {
        call: bid, rule: 'återbud i konkurrens: reverse',
        explanation: `17+ hp med 4+ ${SWE_SYM[st]} → ${prettyBid(bid)} (reverse, rondkrav) utan stöd för partnerns fria bud.`,
      }
      continue
    }
    return {
      call: bid, rule: 'återbud i konkurrens: ny färg',
      explanation: `Inget stöd för partnerns fria bud; ny färg ${SWE_SYM[st]} (4+ kort) → ${prettyBid(bid)} (naturligt, minimum).`,
    }
  }
  const fallback = cheapestBidIn(history, seat, open.strain)
  if (fallback && legal.includes(fallback)) return {
    call: fallback, rule: 'återbud i konkurrens: egen färg (minimum)',
    explanation: `Partnerns fria bud är rondkrav och jag har varken stöd, stopp i deras ${SWE_SYM[theirStrain]} eller en ny färg att visa → rebjuder ${SWE_SYM[open.strain]} (${prettyBid(fallback)}, minimum).`,
  }
  return null
}

/** Felrapport #55 (del 4): öppnaren dömer svararens 3M-inbjudan efter sin egen enkla höjning av det fria budet. */
export function openerAnswersFreeBidInvite(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const ctx = f.freeBid
  if (!ctx || ctx.opener !== seat || ctx.contracts.length !== 5) return null
  const [, , , raise, invite] = ctx.contracts
  const rb = parseContractBid(raise.bid)!
  const ib = parseContractBid(invite.bid)!
  const strain = ctx.free.strain
  if (!isMajorStrain(strain)) return null
  if (raise.seat !== seat || rb.strain !== strain || rb.level !== ctx.free.level + 1) return null
  if (invite.seat !== ctx.responder || ib.strain !== strain || ib.level !== 3) return null
  if (history.slice(history.indexOf(invite) + 1).some((c) => c.bid !== 'P')) return null
  const r = openerThirdBidAfterOwnRaise(hand, SUIT_OF_LETTER[strain] as Major)
  const bid = r.call as Bid
  if (bid !== 'P' && !legalCalls(history, seat).includes(bid)) return null
  return { call: bid, rule: r.rule, explanation: r.explanation }
}

/**
 * §5.8: öppnarens rond två när partnern svarade ny färg / 1NT och
 * motståndarna konkurrerade över svaret. Fiten mäts mot vad svaret LOVADE:
 * fritt högfärgsbud 5+ (tre räcker), ostört 1-lägessvar 4+ (fyra krävs),
 * ett fritt 2-lägesbud 5+. null = minimum utan lång färg eller fit → det
 * gamla lagret (straffdubblingen, sedan pass).
 */
export function openerRondTwoInCompetition(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain === 'NT' || open.level !== 1) return null
  if (open.seat !== seat) return null
  const contractBids = f.contractBids
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2 || ourBids[0].seat !== seat || ourBids[1].seat !== PARTNER[seat]) return null
  const resp = parseContractBid(ourBids[1].bid)!
  const last = contractBids[contractBids.length - 1]
  if (side(last.seat) === side(seat)) return null
  const theirStrain = parseContractBid(last.bid)!.strain
  if (theirStrain === 'NT') return null
  const lastIdx = history.indexOf(last)
  if (history.slice(lastIdx + 1).some((c) => c.bid !== 'P')) return null
  if (resp.strain === open.strain) return null
  let respStrain: string | null = null
  if (resp.strain === 'NT') {
    if (ourBids[1].bid !== '1NT') return null
  } else {
    if (f.theirStrains.has(resp.strain)) return null
    respStrain = resp.strain
  }

  const len = lengths(hand)
  const legal = legalCalls(history, seat)
  const theirSuit = SUIT_OF_LETTER[theirStrain]
  const cue = cheapestBidIn(history, seat, theirStrain)

  let fitStrain: string | null = null
  if (respStrain) {
    const promised = f.freeBid?.free.strain === respStrain || resp.level >= 2 ? 5 : 4
    if (len[SUIT_OF_LETTER[respStrain]] >= (promised === 5 ? 3 : 4)) fitStrain = respStrain
  }
  const tp = fitStrain ? pointsWithFloor(hand, SUIT_OF_LETTER[fitStrain], 'bergen').points : hcp(hand)
  const isMajorFit = fitStrain !== null && isMajorStrain(fitStrain)

  if (tp >= 18) {
    if (isMajorFit && legal.includes(`4${fitStrain}` as Bid)) return {
      call: `4${fitStrain}`, rule: 'öppnaren bjuder utgång i konkurrens',
      explanation: `Utgångsvärden med ${SWE_SYM[fitStrain!]}-fit → utgång 4${SWE_SYM[fitStrain!]}.`,
    }
    if (isBalanced(hand) && hasStopper(hand, theirSuit) && legal.includes('3NT' as Bid)) return {
      call: '3NT', rule: 'öppnaren bjuder 3NT i konkurrens', explanation: `Jämn hand med stopp i ${SWE_SYM[theirStrain]} → 3NT.`,
    }
    if (cue) return {
      call: cue, rule: 'öppnarens cue (utgångskrav i konkurrens)',
      explanation: `För starkt för att sälja given: cue i ${SWE_SYM[theirStrain]} = utgångskrav, hjälp mig välja utgång.`,
    }
  }
  if (tp >= 15) {
    if (isMajorFit) {
      const simple = cheapestBidIn(history, seat, fitStrain!)
      if (simple) {
        const cb = parseContractBid(simple)!
        const jump = `${cb.level + 1}${fitStrain}` as Bid
        if (legal.includes(jump)) return {
          call: jump, rule: 'öppnarens inbjudande höjning (konkurrens)',
          explanation: `Inbjudan med ${SWE_SYM[fitStrain!]}-fit → inbjudande hopphöjning ${prettyBid(jump)}.`,
        }
        if (legal.includes(simple)) return {
          call: simple, rule: 'öppnarens höjning (konkurrens)', explanation: `Med ${SWE_SYM[fitStrain!]}-fit → ${simple}.`,
        }
      }
    }
    if (cue) return {
      call: cue, rule: 'öppnarens cue (extra i konkurrens)',
      explanation: `För bra för ett minimibud: cue i ${SWE_SYM[theirStrain]} visar extra och letar rätt utgång.`,
    }
  }
  if (len[SUIT_OF_LETTER[open.strain]] >= 6) {
    const rebid = cheapestBidIn(history, seat, open.strain)
    if (rebid) return {
      call: rebid, rule: 'öppnaren tävlar (egen 6+ färg)',
      explanation: `Minimum men 6+ ${SWE_SYM[open.strain]} → ${prettyBid(rebid)} (tävlar på lagen om totala stick, ej krav).`,
    }
  }
  if (fitStrain) {
    const raise = cheapestBidIn(history, seat, fitStrain)
    if (raise) return {
      call: raise, rule: 'öppnaren tävlar (stödjer partnern)',
      explanation: `Minimum med ${SWE_SYM[fitStrain]}fit → ${prettyBid(raise)} (tävlar).`,
    }
  }
  return null
}

/** §5.9 A: partnern passade inklivet, RHO konkurrerade — egen 6+ färg tävlar, 15+ med kort i deras färg återöppnar med X. */
export function openerReopensAfterPartnerPass(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain === 'NT' || open.level !== 1) return null
  if (open.seat !== seat) return null
  const contractBids = f.contractBids
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1 || ourBids[0].seat !== seat) return null
  if (history.some((c) => (c.bid === 'X' || c.bid === 'XX') && side(c.seat) !== side(seat))) return null
  const theirBids = f.theirContractBids
  if (theirBids.length < 2) return null
  const last = contractBids[contractBids.length - 1]
  if (side(last.seat) === side(seat)) return null
  const theirStrain = parseContractBid(last.bid)!.strain
  if (theirStrain === 'NT') return null
  if (isGameOrHigher(last.bid as Bid)) return null
  const lastIdx = history.indexOf(last)
  if (history.slice(lastIdx + 1).some((c) => c.bid !== 'P')) return null
  const len = lengths(hand)
  const legal = legalCalls(history, seat)
  const theirSuit = SUIT_OF_LETTER[theirStrain]
  if (len[SUIT_OF_LETTER[open.strain]] >= 6) {
    const rebid = cheapestBidIn(history, seat, open.strain)
    if (rebid && legal.includes(rebid)) return {
      call: rebid, rule: 'öppnaren tävlar efter partnerns pass (egen 6+ färg)',
      explanation: `Partnern passade inklivet, men 6+ ${SWE_SYM[open.strain]} → ${prettyBid(rebid)} (tävlar på lagen om totala stick, ej krav).`,
    }
  }
  if (hcp(hand) >= 15 && len[theirSuit] <= 2 && legal.includes('X' as Bid)) return {
    call: 'X', rule: 'öppnarens återöppningsdubbling (partnern passade)',
    explanation: `Kort i ${SWE_SYM[theirStrain]} och för bra för att sälja given → återöppningsdubbling (takeout, välj färg partner).`,
  }
  return null
}

/** §5.9 B: inklivet passat runt till öppnaren i utpassningssitsen — kort i deras färg → X, egen 6+ → rebjud, 15+ → X. */
export function openerReopensBalancing(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.strain === 'NT' || open.level !== 1) return null
  if (open.seat !== seat) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 1 || ourBids[0].seat !== seat) return null
  if (history.some((c) => (c.bid === 'X' || c.bid === 'XX') && side(c.seat) !== side(seat))) return null
  const theirBids = f.theirContractBids
  if (theirBids.length !== 1) return null
  const overcall = theirBids[0]
  if (overcall.seat !== NEXT_SEAT[seat]) return null
  const theirStrain = parseContractBid(overcall.bid)!.strain
  if (theirStrain === 'NT') return null
  const overIdx = history.indexOf(overcall)
  if (history.slice(overIdx + 1).some((c) => c.bid !== 'P')) return null
  const len = lengths(hand)
  const legal = legalCalls(history, seat)
  const theirSuit = SUIT_OF_LETTER[theirStrain]
  if (len[theirSuit] <= 1 && legal.includes('X' as Bid)) return {
    call: 'X', rule: 'öppnarens återöppningsdubbling (utpassningssits)',
    explanation: `Kort i ${SWE_SYM[theirStrain]} – sälj inte given: återöppningsdubbling (takeout; partnern kan konvertera till straff).`,
  }
  if (len[SUIT_OF_LETTER[open.strain]] >= 6) {
    const rebid = cheapestBidIn(history, seat, open.strain)
    if (rebid && legal.includes(rebid)) return {
      call: rebid, rule: 'öppnaren tävlar i utpassningssits (egen 6+ färg)',
      explanation: `6+ ${SWE_SYM[open.strain]} → ${prettyBid(rebid)} (sälj inte given med en 6-korts färg).`,
    }
  }
  if (hcp(hand) >= 15 && legal.includes('X' as Bid)) return {
    call: 'X', rule: 'öppnarens återöppningsdubbling (extra, utpassningssits)',
    explanation: `För bra för att sälja given → återöppningsdubbling.`,
  }
  return null
}

/**
 * NYTT (familj 4): svaret på partnerns CUE i motståndarnas färg (§5.8
 * "hjälp mig välja utgång"; negativ-dubblarens cue). Cuet är krav — jag
 * passar aldrig: stopp i deras färg → 3NT; 3+ stöd i partnerns visade 5+
 * högfärg → 4M; egen 6+ färg → rebjud (utgång i högfärg); 4+ stöd i
 * partnerns färg → billigaste höjning; sist billigaste sang / billigaste bud.
 * Samma dom för båda stolarna.
 */
export function answerPartnersCue(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const cue = partnerCueToAnswer(f)
  if (!cue) return null
  const legal = legalCalls(history, seat)
  const len = lengths(hand)
  const theirSuit = SUIT_OF_LETTER[cue.theirStrain]
  const rule = 'svar på partnerns cue'
  const note = `Partnerns cue i ${SWE_SYM[cue.theirStrain]} är krav och ber mig välja utgång`
  if (hasStopper(hand, theirSuit) && legal.includes('3NT' as Bid)) {
    return { call: '3NT', rule, explanation: `${note}; stopp i deras färg → 3NT.` }
  }
  // Partnerns visade färger (öppningen 1M lovar 5+; ett fritt högfärgsbud 5+; annars 4+).
  const partnerSuits = f.ourContractBids
    .filter((c) => c.seat === f.partner && !f.theirStrains.has(parseContractBid(c.bid)!.strain) && parseContractBid(c.bid)!.strain !== 'NT')
    .map((c) => parseContractBid(c.bid)!.strain)
  const open = f.opening!
  for (const st of partnerSuits) {
    const promised5 = (open.seat === f.partner && open.strain === st && isMajorStrain(st)) || f.freeBid?.free.strain === st
    if (isMajorStrain(st) && len[SUIT_OF_LETTER[st]] >= (promised5 ? 3 : 4) && legal.includes(`4${st}` as Bid)) {
      return { call: `4${st}`, rule, explanation: `${note}; ${len[SUIT_OF_LETTER[st]]}-korts stöd i partnerns ${SWE_SYM[st]} → utgång 4${SWE_SYM[st]}.` }
    }
  }
  const mine = SUIT_STRAINS.filter((st) => len[SUIT_OF_LETTER[st]] >= 6 && !f.theirStrains.has(st))
    .sort((a, b) => len[SUIT_OF_LETTER[b]] - len[SUIT_OF_LETTER[a]])
  for (const st of mine) {
    const bid = isMajorStrain(st) && legal.includes(`4${st}` as Bid) ? (`4${st}` as Bid) : cheapestBidIn(history, seat, st)
    if (bid && legal.includes(bid)) return { call: bid, rule, explanation: `${note}; egen 6+ ${SWE_SYM[st]} → ${prettyBid(bid)}.` }
  }
  for (const st of partnerSuits) {
    if (len[SUIT_OF_LETTER[st]] < 4) continue
    const bid = cheapestBidIn(history, seat, st)
    if (bid && legal.includes(bid)) return { call: bid, rule, explanation: `${note}; stöd i partnerns ${SWE_SYM[st]} → ${prettyBid(bid)} (krav, partnern placerar).` }
  }
  const nt = (['2NT', '3NT'] as Bid[]).find((b) => legal.includes(b))
  if (nt) return { call: nt, rule, explanation: `${note}; inget stopp och ingen färg att visa → ${prettyBid(nt)} (billigaste sang).` }
  return null
}

// ============================================================================
// Kunskap — svararen
// ============================================================================

/** §5.4: svararen dömer öppnarens maximala dubbling — 4M med maximum (8+ stödpoäng), annars 3M. */
export function responderAnswersMaximal(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || !isMajorStrain(open.strain) || open.level !== 1) return null
  if (open.seat !== PARTNER[seat]) return null
  const M = open.strain
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2) return null
  if (ourBids[0].seat !== PARTNER[seat] || ourBids[1].seat !== seat) return null
  const raise = parseContractBid(ourBids[1].bid)!
  if (raise.strain !== M || raise.level !== 2) return null
  const lastCall = f.lastNonPass
  if (!lastCall || lastCall.seat !== PARTNER[seat] || lastCall.bid !== 'X') return null
  const sp = pointsWithFloor(hand, SUIT_OF_LETTER[M], 'support').points
  const legal = legalCalls(history, seat)
  const game = `4${M}` as Bid
  const decline = cheapestBidIn(history, seat, M)
  if (sp >= 8 && legal.includes(game)) {
    return { call: game, rule: 'accepterar game-try', explanation: `Partnerns X är ett game try (maximal dubbling); jag är maximum av höjningen → accepterar utgång ${game}.` }
  }
  if (decline && legal.includes(decline)) {
    return { call: decline, rule: 'avböjer game-try', explanation: `Partnerns X är ett game try; med ett minimum återgår jag till ${decline} (avböjer).` }
  }
  return null
}

/** §5.10: höjaren dömer öppnarens 2NT-inbjudan — 3NT med maximum (8+ hp), annars pass. */
export function responderAnswersNTInvite(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || (open.strain !== 'C' && open.strain !== 'D') || open.level !== 1) return null
  if (open.seat !== PARTNER[seat]) return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 3) return null
  if (ourBids[0].seat !== PARTNER[seat] || ourBids[1].seat !== seat || ourBids[2].seat !== PARTNER[seat]) return null
  if (parseContractBid(ourBids[0].bid)!.strain !== open.strain) return null
  const raise = parseContractBid(ourBids[1].bid)!
  if (raise.strain !== open.strain || raise.level !== 2) return null
  if (ourBids[2].bid !== '2NT') return null
  const lastCall = f.lastNonPass
  if (!lastCall || lastCall.seat !== PARTNER[seat] || lastCall.bid !== '2NT') return null
  const p = hcp(hand)
  if (p >= 8 && legalCalls(history, seat).includes('3NT' as Bid)) {
    return { call: '3NT', rule: 'accepterar sanginbjudan', explanation: `Partnerns 2NT är en inbjudan (18–19); med ett maximum av min höjning → 3NT (utgång).` }
  }
  return { call: 'P', rule: 'avböjer sanginbjudan', explanation: `Partnerns 2NT är en inbjudan; med ett minimum av min höjning passar jag (stannar i 2NT).` }
}

/** Felrapport #55 (del 3): svararen går vidare när öppnaren höjt det fria högfärgsbudet enkelt — Bergen mot känd fit. */
export function responderAfterFreeBidRaise(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const ctx = f.freeBid
  if (!ctx || ctx.responder !== seat || ctx.contracts.length !== 4) return null
  const raise = ctx.contracts[3]
  const rb = parseContractBid(raise.bid)!
  if (raise.seat !== ctx.opener || rb.strain !== ctx.free.strain || rb.level !== ctx.free.level + 1) return null
  if (history.slice(history.indexOf(raise) + 1).some((c) => c.bid !== 'P')) return null
  const strain = ctx.free.strain
  if (!isMajorStrain(strain)) return null
  const tp = pointsWithFloor(hand, SUIT_OF_LETTER[strain], 'bergen').points
  const legal = legalCalls(history, seat)
  const game = `4${strain}` as Bid
  const gameFloor = ctx.free.level >= 2 ? 13 : 14
  if (tp >= gameFloor && legal.includes(game)) return {
    call: game, rule: 'utgång efter höjt fritt bud',
    explanation: `Öppnaren höjde min ${SWE_SYM[strain]} (fit); utgångsvärden med fördelning → ${prettyBid(game)}.`,
  }
  const invite = `3${strain}` as Bid
  if (tp >= 12 && rb.level < 3 && legal.includes(invite)) return {
    call: invite, rule: 'inbjudan efter höjt fritt bud',
    explanation: `Öppnaren höjde min ${SWE_SYM[strain]} (fit); inbjudningsvärden → ${prettyBid(invite)} (inbjudan).`,
  }
  return null
}

/**
 * NYTT (familj 4): svararens fortsättning efter sitt FRIA bud när öppnaren
 * svarade med något annat än en höjning (rebjöd egen färg, ny färg, sang) och
 * bara pass följt. Öppnarens svar på ett rondkrav utan hopp är minimum-
 * betonat, så: egen 6+ färg → utgång i högfärg med 13+ (längdpoäng räknas),
 * annars rebjud (invit); 13+ → utgång med fit (3+ mot rebjuden 6+, 4+ mot
 * ny färg: 4M / 3NT med stopp / 5m) eller 3NT med stopp; 10–12 → pass.
 */
export function responderAfterFreeBid(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const ctx = f.freeBid
  if (!ctx || ctx.responder !== seat || ctx.contracts.length !== 4) return null
  const rebid = ctx.contracts[3]
  if (rebid.seat !== ctx.opener) return null
  const rb = parseContractBid(rebid.bid)!
  if (rb.strain === ctx.free.strain) return null // höjningen: egen regel
  if (f.theirStrains.has(rb.strain)) return null // öppnarens cue: egen regel
  if (history.slice(history.indexOf(rebid) + 1).some((c) => c.bid !== 'P')) return null
  if (isGameOrHigher(rebid.bid as Bid)) return null
  const open = f.opening!
  const theirStrain = parseContractBid(ctx.contracts[1].bid)!.strain
  const theirSuit = SUIT_OF_LETTER[theirStrain]
  const len = lengths(hand)
  const legal = legalCalls(history, seat)
  const mySuit = SUIT_OF_LETTER[ctx.free.strain]
  const myPts = pointsWithFloor(hand, mySuit, 'bergen').points
  const p = hcp(hand)
  // Öppnarens HÖGRE nya färg i konkurrens = 5-4 UTAN stopp (ägarregel 2026-09-12),
  // inte ett styrke-reverse. Svararen bjuder om egen 6+ färg (hittar fiten på
  // 3-läget), annars sang med stopp i deras färg (3NT med öppningsvärden, 2NT
  // annars). Ett HOPP av öppnaren är fortfarande krav → kravvakten (aldrig pass).
  if (rb.strain !== 'NT') {
    const reverse = rb.level >= 2 && SUIT_STRAINS.indexOf(rb.strain as (typeof SUIT_STRAINS)[number]) > SUIT_STRAINS.indexOf(open.strain as (typeof SUIT_STRAINS)[number])
    const prev = parseContractBid(ctx.contracts[2].bid)!
    const minLevel = SUIT_STRAINS.indexOf(rb.strain as (typeof SUIT_STRAINS)[number]) > SUIT_STRAINS.indexOf(prev.strain as (typeof SUIT_STRAINS)[number]) ? prev.level : prev.level + 1
    if (reverse) {
      if (len[mySuit] >= 6) {
        const again = cheapestBidIn(history, seat, ctx.free.strain)
        if (again && legal.includes(again) && parseContractBid(again)!.level <= 3) return {
          call: again, rule: 'fritt bud: rebjuder egen 6+ (konkurrens)',
          explanation: `6+ ${SWE_SYM[ctx.free.strain]} (längre än de 5 jag visat) → ${prettyBid(again)}; partnern höjer med tvåkortsstöd (8-korts fit).`,
        }
      }
      if (hasStopper(hand, theirSuit)) {
        if (p >= 12 && legal.includes('3NT' as Bid)) return {
          call: '3NT', rule: 'fritt bud: 3NT med stopp',
          explanation: `Stopp i deras ${SWE_SYM[theirStrain]} + öppningsvärden (12+) → 3NT.`,
        }
        if (legal.includes('2NT' as Bid)) return {
          call: '2NT', rule: 'fritt bud: 2NT med stopp',
          explanation: `Stopp i deras ${SWE_SYM[theirStrain]} → 2NT.`,
        }
      }
      return null // annat → gamla lagret / kravvakt
    }
    if (rb.level > minLevel) return null // hopp = krav → kravvakten
  }

  if (len[mySuit] >= 6) {
    const game = `4${ctx.free.strain}` as Bid
    // Längden räknas (Bergen), men 4M kräver också riktiga honnörer (10+ hp):
    // ett 1-läges fritt bud kan vara 6 hp, och öppnaren visade minimum utan stöd.
    if (isMajorStrain(ctx.free.strain) && myPts >= 13 && p >= 10 && legal.includes(game)) return {
      call: game, rule: 'fritt bud: utgång i egen färg',
      explanation: `6+ ${SWE_SYM[ctx.free.strain]} och utgångsvärden med längden → ${prettyBid(game)} (egen färg före stöd åt partnern).`,
    }
    const again = cheapestBidIn(history, seat, ctx.free.strain)
    if (again && legal.includes(again) && parseContractBid(again)!.level <= 3) return {
      call: again, rule: 'fritt bud: rebjuder egen färg',
      explanation: `6+ ${SWE_SYM[ctx.free.strain]} → ${prettyBid(again)} (rebjuder, inbjudan – ej krav).`,
    }
  }
  if (p >= 13) {
    if (rb.strain !== 'NT') {
      const st = rb.strain
      const promised6 = st === open.strain // öppnaren rebjöd sin färg = 6+
      if (len[SUIT_OF_LETTER[st]] >= (promised6 ? 3 : 4)) {
        if (isMajorStrain(st) && legal.includes(`4${st}` as Bid)) return {
          call: `4${st}`, rule: 'fritt bud: utgång med fit',
          explanation: `Utgångsvärden och stöd i partnerns ${SWE_SYM[st]} → 4${SWE_SYM[st]}.`,
        }
        if (!isMajorStrain(st)) {
          if (isBalanced(hand) && hasStopper(hand, theirSuit) && legal.includes('3NT' as Bid)) return {
            call: '3NT', rule: 'fritt bud: utgång med fit',
            explanation: `Utgångsvärden, stöd i partnerns ${SWE_SYM[st]} och stopp i deras ${SWE_SYM[theirStrain]} → 3NT.`,
          }
          if (legal.includes(`5${st}` as Bid)) return {
            call: `5${st}`, rule: 'fritt bud: utgång med fit',
            explanation: `Utgångsvärden och stöd i partnerns ${SWE_SYM[st]} utan stopp i deras ${SWE_SYM[theirStrain]} → 5${SWE_SYM[st]}.`,
          }
        }
      }
    }
    if (hasStopper(hand, theirSuit) && legal.includes('3NT' as Bid)) return {
      call: '3NT', rule: 'fritt bud: utgång i sang',
      explanation: `Utgångsvärden (13+) och stopp i deras ${SWE_SYM[theirStrain]} → 3NT.`,
    }
    // Utgångsvärden utan fit och utan stopp → cue i deras färg (utgångskrav):
    // partnern bjuder 3NT med stopp, annars färg (frö 20272932: ♠KQ742 ♥962
    // ♦AQ2 ♣K5 efter 1♣–(1♥)–1♠–P–2♣ → 2♥, öppnaren har ♥AT75 → 3NT).
    const cue = cheapestBidIn(history, seat, theirStrain)
    if (cue && legal.includes(cue) && bidValue(parseContractBid(cue)!.level, theirStrain) < bidValue(gameLevelOf(theirStrain), theirStrain)) return {
      call: cue, rule: 'fritt bud: cue (utgångskrav)',
      explanation: `Utgångsvärden (13+) utan fit och utan stopp i deras ${SWE_SYM[theirStrain]} → cue ${prettyBid(cue)} (utgångskrav: partnern bjuder 3NT med stopp, annars färg).`,
    }
  }
  // Inbjudningsvärden (10–12) med fit för partnerns rebjudna 6+ färg →
  // billigaste höjning (inbjudan, ej krav; frö 20272991: ♣Q76 mot 6+ klöver).
  if (p >= 10 && rb.strain !== 'NT' && rb.strain === open.strain && len[SUIT_OF_LETTER[rb.strain]] >= 3) {
    const raise = cheapestBidIn(history, seat, rb.strain)
    if (raise && legal.includes(raise) && parseContractBid(raise)!.level <= 3) return {
      call: raise, rule: 'fritt bud: inbjudande höjning',
      explanation: `3+ stöd för partnerns rebjudna 6+ ${SWE_SYM[rb.strain]} och inbjudningsvärden → ${prettyBid(raise)} (inbjudan, ej krav).`,
    }
  }
  return {
    call: 'P', rule: 'fritt bud: stannar',
    explanation: `Mitt fria bud var rondkrav; partnern svarade med ett minimum och jag har inget mer att säga → pass.`,
  }
}

/**
 * NYTT (familj 4): negativ-dubblarens andra tur med UTGÅNGSVÄRDEN (13+) men
 * ojämn hand eller inget stopp i deras färg (familj 3 gav 3NT för den jämna
 * handen med stopp): cue i deras färg = utgångskrav, partnern beskriver
 * (stopp → 3NT, annars färg). Partnerns billiga svar står, bara pass efter.
 */
export function negativeDoublerCue(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.seat !== f.partner || open.level !== 1 || open.strain === 'NT') return null
  const mine = history.filter((c) => c.seat === seat && c.bid !== 'P')
  if (mine.length !== 1 || mine[0].bid !== 'X') return null
  const ourBids = f.ourContractBids
  if (ourBids.length !== 2 || ourBids[1].seat !== f.partner || f.lastContract !== ourBids[1] || !f.quietSinceLastContract) return null
  const theirBids = f.theirContractBids
  if (theirBids.length !== 1) return null
  const theirStrain = parseContractBid(theirBids[0].bid)!.strain
  if (theirStrain === 'NT') return null
  if (isGameOrHigher(ourBids[1].bid as Bid)) return null
  if (hcp(hand) < 13) return null
  const cue = cheapestBidIn(history, seat, theirStrain)
  if (!cue || !legalCalls(history, seat).includes(cue)) return null
  const cb = parseContractBid(cue)!
  if (bidValue(cb.level, cb.strain) >= bidValue(gameLevelOf(cb.strain), cb.strain)) return null
  return {
    call: cue, rule: 'negativ-dubblarens cue (utgångskrav)',
    explanation: `Utgångsvärden (13+) utan fit för partnerns ${prettyBid(ourBids[1].bid)} och utan stopp i deras ${SWE_SYM[theirStrain]} → cue ${prettyBid(cue)} (utgångskrav: partnern bjuder 3NT med stopp, annars färg).`,
  }
}

/**
 * NYTT (familj 4): svararens svar på öppnarens ÅTERÖPPNINGSDUBBLING (§5.9 A/B).
 * Läget: partnern öppnade 1 i färg, jag har bara passat, partnerns senaste bud
 * är X med ett motståndarkontrakt i färg under utgång som senaste kontraktsbud,
 * bara pass efter. X:et är upplysande (rondkrav): längd + honnörer i deras färg
 * → straffpass (trap pass); annars längsta färg utanför deras (partnerns färg
 * med 3+ räknas), billigast — 5+ högfärg och 12+ → utgång. Pliktsvepet K1
 * visade 62 passade återöppningsdubblingar på 3000 givar (2026-09-08).
 *
 * Kärnan (`answerReopeningDoubleCore`) är utbruten så att motorbytets familj 5
 * (K1-resten: den negativa dubblaren som möter öppnarens ANDRA X — se
 * `responderAnswersSecondDouble` i balancing-continuations.ts) kan återanvända
 * den efter att först ha prövat en graderad fithöjning.
 */
export function responderAnswersReopeningDouble(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  if (history.some((c) => c.seat === seat && c.bid !== 'P')) return null // svararens FÖRSTA tur
  return answerReopeningDoubleCore(hand, f)
}

/**
 * Själva svaret på partnerns upplysande (återöppnings-)dubbling, utan
 * tur-guarden: partnern öppnade 1 i färg, partnerns senaste bud är X med ett
 * motståndarkontrakt i färg under utgång som senaste kontraktsbud, bara pass
 * efter. Längd + honnörer i deras färg → straffpass; annars längsta färg utanför
 * deras (partnerns färg med 3+ räknas), billigast — 5+ högfärg och 12+ → utgång.
 */
export function answerReopeningDoubleCore(hand: Hand, f: AuctionFacts): Kunskap | null {
  const { history, seat } = f
  const open = f.opening
  if (!open || open.seat !== f.partner || open.level !== 1 || open.strain === 'NT') return null
  const last = f.lastNonPass
  if (!last || last.seat !== f.partner || last.bid !== 'X') return null
  if (history.slice(history.indexOf(last) + 1).some((c) => c.bid !== 'P')) return null
  const their = f.lastContract
  if (!their || side(their.seat) === side(seat)) return null
  const tb = parseContractBid(their.bid)!
  if (tb.strain === 'NT' || isGameOrHigher(their.bid as Bid)) return null
  if (history.indexOf(their) > history.indexOf(last)) return null
  const len = lengths(hand)
  const legal = legalCalls(history, seat)
  const theirSuit = SUIT_OF_LETTER[tb.strain]
  const p = hcp(hand)
  // Trap pass: längd OCH honnörer i deras färg (4+ kort med 4+ hp i färgen,
  // eller 5+ kort med 3+) — fyra hackor är ingen straff, då svarar jag.
  const trump = suitHcp(hand, theirSuit)
  if ((len[theirSuit] >= 4 && trump >= 4) || (len[theirSuit] >= 5 && trump >= 3)) return {
    call: 'P', rule: 'straffpass (återöppningsdubbling)',
    explanation: `Partnerns återöppningsdubbling är upplysande, men med ${len[theirSuit]} kort och honnörer i deras ${SWE_SYM[tb.strain]} passar jag för straff.`,
  }
  const cands = SUIT_STRAINS
    .filter((st) => st !== tb.strain && (st !== open.strain ? len[SUIT_OF_LETTER[st]] >= 4 : len[SUIT_OF_LETTER[st]] >= 3))
    .sort((a, b) => len[SUIT_OF_LETTER[b]] - len[SUIT_OF_LETTER[a]] || Number(isMajorStrain(b)) - Number(isMajorStrain(a)) || SUIT_STRAINS.indexOf(a) - SUIT_STRAINS.indexOf(b))
  for (const st of cands) {
    if (isMajorStrain(st) && st !== open.strain && len[SUIT_OF_LETTER[st]] >= 5 && p >= 12 && legal.includes(`4${st}` as Bid)) return {
      call: `4${st}`, rule: 'svar på återöppningsdubbling (utgång)',
      explanation: `Partnerns återöppningsdubbling + 5+ ${SWE_SYM[st]} och utgångsvärden → 4${SWE_SYM[st]}.`,
    }
    const bid = cheapestBidIn(history, seat, st)
    if (bid && legal.includes(bid)) return {
      call: bid, rule: 'svar på återöppningsdubbling',
      explanation: `Partnerns återöppningsdubbling är upplysande → ${prettyBid(bid)} (${st === open.strain ? 'preferens till partnerns färg' : 'längsta färg utanför deras ' + SWE_SYM[tb.strain]}, ej krav).`,
    }
  }
  const nt = (['1NT', '2NT', '3NT'] as Bid[]).find((b) => legal.includes(b))
  if (nt) return {
    call: nt, rule: 'svar på återöppningsdubbling',
    explanation: `Partnerns återöppningsdubbling är upplysande; ingen färg att visa → ${prettyBid(nt)} (billigaste sang).`,
  }
  return null
}

/** Cue-bjudaren (svararen) fullföljer efter öppnarens svar på cue-höjningen (felrapport #26). */
export function cueRaiserContinues(hand: Hand, f: AuctionFacts): Kunskap | null {
  return cueBidderContinues(hand, f, 'öppnare')
}
