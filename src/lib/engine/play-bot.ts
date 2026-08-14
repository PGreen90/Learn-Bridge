// Bott-tumregler för kortspelet (punkt 29). INTE optimalt spel (dubbeldummy/DDS
// är punkt 28) – bara enkla, lagliga och rimligt RIKTIGA val så en giv kan
// spelas ut mot datorn. Tumreglerna följer klassisk nybörjardoktrin:
//   • Utspel: längsta färgen – topp av en honnörssekvens (KQJ→K, QJ10→Q),
//     annars lågt.
//   • Andra hand (näst att lägga, motståndaren leder): LÅGT – spar honnörerna.
//   • Partnern leder redan sticket: kasta lågt och trumfa ALDRIG partnerns
//     vinnande stick.
//   • Tredje/fjärde hand mot motståndaren: vinn så billigt som möjligt, annars
//     kasta lågt (ruffa bara när det vinner sticket). Undantag – tredje hand i
//     SANG med partnerns utspel och bara dold spelförare bakom: lägsta honnören
//     (tredje hand högt, §8.6/felrapport #34).

import type { Card, Hand, Seat, Suit } from '../../types/bridge'
import type { Rank } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { currentWinner, dummyOf, legalCards, PARTNER_SEAT, side, type PlayState } from './play'
import { isSureWinner, playedCards, shownVoids, unseenTrumpCount, visibleSeats } from './card-counting'
import { buildHandModel } from './hand-model'
import { applyOpeningLeadSignal, applySignalReads } from './signal-decode'
import { chooseCardMonteCarlo } from './monte-carlo'
import { defensiveSignalCard, honorLead, leadFromSuit } from './signals'

const RANK_LOW_TO_HIGH: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const rankVal = (r: Rank) => RANK_LOW_TO_HIGH.indexOf(r)

/** Lägsta kortet (efter valör) i en lista. */
function lowest(cards: Hand): Card {
  return cards.reduce((lo, c) => (rankVal(c.rank) < rankVal(lo.rank) ? c : lo))
}

/** Högsta kortet (efter valör) i en lista. */
function highest(cards: Hand): Card {
  return cards.reduce((hi, c) => (rankVal(c.rank) > rankVal(hi.rank) ? c : hi))
}

const HONOR_MIN = rankVal('10') // 10 (=T) och uppåt räknas som honnör i tredje-hand-valet

/**
 * Tredje-hand-honnören (§8.6, felrapport #34) ur mina vinnande kort i
 * utspelsfärgen: den LÄGSTA honnören (10+). Det pressar fram spelförarens honnör
 * men slösar aldrig en högre än nödvändigt:
 *  • Sammanhängande topp (KDkn) → lägsta av sekvensen (kn), sparar K/D.
 *  • Gaffel/tenass (A-D-10 över spelförarens kn/K) → den LÄGSTA honnören (10),
 *    så esset ligger kvar ÖVER hans kung – att spela esset "tredje hand högt"
 *    krossar det på partnerns låga utspel och gör spelförarens K/kn goda
 *    (uppmätt −1 stick, seed 20260732).
 *  • Ensam honnör (K bland hackor) → den (K), tvingar esset.
 * Returnerar null när jag saknar honnör bland vinnarna – då finns inget att
 * promovera och den gamla regeln (billigaste vinnaren) står kvar.
 */
function thirdHandHonor(cardsInLed: Hand): Card | null {
  const honors = cardsInLed.filter((c) => rankVal(c.rank) >= HONOR_MIN)
  return honors.length > 0 ? lowest(honors) : null
}

/**
 * Lägsta kortet, men undvik att trumfa i onödan: kasta hellre lågt i en sidofärg
 * (så vi inte ruffar partnerns egna vinnande stick eller slösar trumf utan att
 * vinna). Måste vi följa trumf, eller har bara trumf, tas lägsta trumfen.
 */
function lowAvoidRuff(legal: Hand, trump: Suit | null): Card {
  if (!trump) return lowest(legal)
  const offTrump = legal.filter((c) => c.suit !== trump)
  return lowest(offTrump.length > 0 ? offTrump : legal)
}

/**
 * Avblockning på lead (felrapport #17): leder jag en färg där min ÄRLIGT synliga
 * medspelare (spelförarsidan – Öst+Träkarlen ser varandra) har en SINGEL som är
 * HÖGRE än kortet jag tänkte leda, spelar jag i stället LÅGT i färgen. Singeln
 * tvingas ändå på och vinner sticket – men mina honnörer sparas i stället för att
 * krossas under den (Öst ledde ♠K rakt in i träkarlens singel-♠A → båda
 * honnörerna dog på ETT stick, ett spaderstick bortslarvat). Att leda lågt är
 * aldrig sämre: samma stick vinns (singeln spelas oavsett), men mina toppar blir
 * kvar. Gäller bara när partnerns hand syns ärligt (spelförarsidan); en
 * motspelare (dold partner) ändrar inget.
 */
function unblockLead(state: PlayState, seat: Seat, card: Card): Card {
  const declarer = state.contract.declarer
  const dummy = dummyOf(state.contract)
  if (seat !== declarer && seat !== dummy) return card // motspelare: partnern är dold
  const partner = seat === declarer ? dummy : declarer
  const partnerInSuit = state.hands[partner].filter((c) => c.suit === card.suit)
  if (partnerInSuit.length !== 1) return card // ingen singel att krocka med
  if (rankVal(partnerInSuit[0].rank) <= rankVal(card.rank)) return card // singeln är inte högre → ingen krock
  const mineInSuit = state.hands[seat].filter((c) => c.suit === card.suit)
  return lowest(mineInSuit) // led lågt – spara honnörerna, avblockera
}

/**
 * Kast-vakt (Steg B1, docs/bot-hjarna.md): när SPELFÖRARSIDAN sakar (kan inte
 * följa färg) väljs kortet med minst framtida värde – inte blint "lägst rank".
 * Tumregelns gamla val (lägsta kortet) kastar annars bort hotkort: en femma
 * bredvid partnerns ess kan växa till ett stick (skvis/promovering) medan en
 * hacka i en lång stark färg är rent överskott.
 *
 * Ärlig räkning (ingen tjuvkik): platsen ser sin egen hand + träkarlen
 * (spelförarsidan ser hela sin sida via `visibleSeats`) och det som fallit.
 * Ett kort är LASTBÄRANDE (kan växa till ett stick) om antalet OSEDDA högre
 * kort i färgen är ≤ egna sidans kvarvarande högre kort i färgen – våra toppar
 * kan då dra ut/fälla allt som sitter över. Sakningsordning:
 *   1. icke-lastbärande kort, lägst rank först (rent skräp åker först),
 *   2. annars det lastbärande kort med FLEST egna högre kort över sig
 *      (djupast överskott – hackan i en lång stark färg), lägst rank vid lika.
 *
 * Returnerar `null` när vakten inte gäller (motspelare, följer färg, eller
 * bara trumf kvar) – då tar den gamla tumregeln (`lowAvoidRuff`) över.
 */
function guardedDiscard(state: PlayState, seat: Seat, legal: Hand): Card | null {
  if (side(seat) !== side(state.contract.declarer)) return null // bara spelförarsidan
  if (state.currentTrick.length === 0) return null // utspel, ingen sakning
  const led = state.currentTrick[0].card.suit
  if (legal.some((c) => c.suit === led)) return null // följer färg → ingen sakning
  const candidates = state.trump === null ? legal : legal.filter((c) => c.suit !== state.trump)
  if (candidates.length === 0) return null // bara trumf kvar → gamla regeln

  // Sedda kort per färg: spelade + egna sidans händer (ärligt synligt).
  const seen = new Map<Suit, Set<Rank>>()
  const note = (c: Card) => (seen.get(c.suit) ?? seen.set(c.suit, new Set()).get(c.suit)!).add(c.rank)
  for (const c of playedCards(state)) note(c)
  const visible = visibleSeats(state, seat)
  for (const v of visible) for (const c of state.hands[v]) note(c)

  /** Egna sidans kvarvarande högre kort i färgen. */
  const ownHigher = (card: Card) =>
    visible.reduce(
      (n, v) => n + state.hands[v].filter((c) => c.suit === card.suit && rankVal(c.rank) > rankVal(card.rank)).length,
      0,
    )
  /** Osedda högre kort i färgen (kan sitta hos motståndarna). */
  const unseenHigher = (card: Card) => {
    const s = seen.get(card.suit) ?? new Set<Rank>()
    return RANK_LOW_TO_HIGH.slice(rankVal(card.rank) + 1).filter((r) => !s.has(r)).length
  }

  let best: Card | null = null
  let bestKey: [number, number, number] | null = null // [lastbärande, -överskott, rank]
  for (const c of candidates) {
    const own = ownHigher(c)
    const loadBearing = unseenHigher(c) <= own ? 1 : 0
    const key: [number, number, number] = [loadBearing, -own, rankVal(c.rank)]
    if (
      bestKey === null ||
      key[0] < bestKey[0] ||
      (key[0] === bestKey[0] && (key[1] < bestKey[1] || (key[1] === bestKey[1] && key[2] < bestKey[2])))
    ) {
      best = c
      bestKey = key
    }
  }
  return best
}

/**
 * Motspelarens kast-vakt (docs/bot-hjarna.md, Steg B1 utvidgad till FÖRSVARET –
 * felrapport #25). En försvarare som sakar ska inte BLOTTA en honnör i onödan.
 * Ärlig syn: egen hand + träkarlen (`visibleSeats`) – partnern och spelföraren är
 * dolda. En färg är "skyddsvärd" om jag har en honnör (J+) i den som ännu kan
 * SLÅS: något högre kort i färgen är ospelat och ligger inte på min egen hand
 * (det sitter alltså hos spelföraren/träkarlen och kan fälla honnören). Att saka
 * ur en sådan färg riskerar att blotta honnören (♣Q92 → sakar ♣2 → ♣9 tvingas →
 * bar dam faller under AK). Väljer i stället lägsta kortet ur en färg UTAN
 * skyddsvärd honnör.
 *
 * Returnerar `null` när vakten inte gäller (spelförarsidan, utspel, följer färg,
 * bara trumf, ingen skyddsvärd färg) ELLER när det naiva lägsta kortet redan är
 * ofarligt (ligger i en färg utan skyddsvärd honnör) – då står den gamla
 * tumregeln (`lowAvoidRuff`) kvar oförändrad, med sin egen förklaring.
 */
function defenderGuardDiscard(state: PlayState, seat: Seat, legal: Hand): Card | null {
  if (side(seat) === side(state.contract.declarer)) return null // bara motspelet
  if (state.currentTrick.length === 0) return null // utspel, ingen sakning
  const led = state.currentTrick[0].card.suit
  if (legal.some((c) => c.suit === led)) return null // följer färg → ingen sakning
  const candidates = state.trump === null ? legal : legal.filter((c) => c.suit !== state.trump)
  if (candidates.length === 0) return null // bara trumf kvar → gamla regeln

  const played = playedCards(state)
  const HONOR = rankVal('J')
  const myHand = state.hands[seat]
  const myHas = (suit: Suit, rank: Rank) => myHand.some((c) => c.suit === suit && c.rank === rank)
  // Har jag en honnör (J+) i färgen som ännu kan slås av ett HÖGRE, ospelat kort
  // som inte ligger på min egen hand?
  const beatableHonorSuit = (suit: Suit) =>
    myHand.some((c) => {
      if (c.suit !== suit || rankVal(c.rank) < HONOR) return false
      return RANK_LOW_TO_HIGH.slice(rankVal(c.rank) + 1).some(
        (r) => !played.some((p) => p.suit === suit && p.rank === r) && !myHas(suit, r),
      )
    })

  const safe = candidates.filter((c) => !beatableHonorSuit(c.suit))
  if (safe.length === 0) return null // allt är skyddsvärt → kan inte göra bättre
  const naive = lowAvoidRuff(legal, state.trump)
  if (!beatableHonorSuit(naive.suit)) return null // naiva lägsta rör ingen honnör → låt gamla regeln stå
  return lowest(safe)
}

/**
 * Behåll mina TVÅ högsta kort i färgen som gardar i längre färger (3+) och
 * returnera resten (de jag kan markera med). Att markera med ett toppkort kan
 * blotta en stoppare/ett längdstick (♣10 ur 10-8-2 släpper garden på spelförarens
 * långa klöver; ♦8 ur ♦J82 släpper längden bakom knekten). "Riktiga markeringar"
 * – men aldrig en grov blunder. Kortare färger (≤2) lämnas orörda.
 */
function spareAfterGuards(cards: Card[]): Card[] {
  if (cards.length < 3) return cards
  const desc = [...cards].sort((a, b) => rankVal(b.rank) - rankVal(a.rank))
  const gardRanks = new Set([desc[0].rank, desc[1].rank])
  return cards.filter((c) => !gardRanks.has(c.rank))
}

/**
 * Försvarsmarkering när jag FÖLJER färg med ett värdelöst kort (markeringar
 * Steg 1, docs/budsystem.md §8.1). Attityd på partnerns utspelsfärg: uppmuntra
 * (lägg lågt, UDCA omvänt) med Q+ i färgen OCH/ELLER en kort färg (dubbel-/
 * singelton att snart trumfa i trumfkontrakt); annars avskräck (lägg högt).
 * Kortet väljs bland spare (`defensiveSignalCard` → kan aldrig kosta ett stick)
 * och läggs alltid UNDER partnerns vinnande kort (tar aldrig över partnerns
 * stick). Returnerar null när det inte gäller: spelförarsidan, jag leder/sakar,
 * färgen redan spelad 2+ ggr, motståndaren ledde (räkning = Steg 2), eller för
 * få kort att välja bland. Läser bara egen hand (ingen tjuvkik).
 */
function defensiveFollowSignal(state: PlayState, seat: Seat, legal: Hand): CardChoice | null {
  if (side(seat) === side(state.contract.declarer)) return null // bara motspelet
  if (state.currentTrick.length === 0) return null // jag leder, inte följer
  const led = state.currentTrick[0].card.suit
  let candidates = legal.filter((c) => c.suit === led)
  if (candidates.length < 2) return null // sakar, eller inget val
  // §8.1: markering bara de första ~2 gångerna färgen spelas.
  const timesLedBefore = state.completedTricks.filter((t) => t.cards[0]?.card.suit === led).length
  if (timesLedBefore >= 2) return null
  // Vinner min sida redan sticket → lägg UNDER partnerns kort (ta aldrig över).
  const winnerSeat = currentWinner(state.currentTrick, state.trump)
  if (side(winnerSeat) === side(seat)) {
    const winCard = state.currentTrick.find((pc) => pc.seat === winnerSeat)!.card
    if (winCard.suit === led) candidates = candidates.filter((c) => rankVal(c.rank) < rankVal(winCard.rank))
    if (candidates.length < 2) return null
  }
  candidates = spareAfterGuards(candidates)
  if (candidates.length < 2) return null
  const played = playedCards(state)
  const myInLed = state.hands[seat].filter((c) => c.suit === led)

  if (state.currentTrick[0].seat === PARTNER_SEAT[seat]) {
    // Partnern ledde → ATTITYD: uppmuntra med styrka (Q+) och/eller kort färg
    // (ruffvärde i trumfkontrakt). Läser bara egen hand.
    const hasQ = myInLed.some((c) => rankVal(c.rank) >= rankVal('Q'))
    const shortRuff = state.trump !== null && led !== state.trump && myInLed.length <= 2
    const encourage = hasQ || shortRuff
    const card = defensiveSignalCard(candidates, played, { kind: 'attitude', encourage })
    const reason = encourage
      ? 'Markering (§8.1): jag lägger lågt = jag uppmuntrar partnerns färg (jag har något där).'
      : 'Markering (§8.1): jag lägger högt = jag avskräcker partnerns färg.'
    return { card, reason }
  }

  // Motståndaren ledde → RÄKNING (§8.1, omvänt): jämnt antal = lågt (lågt-högt),
  // udda antal = högt (högt-lågt). Läser bara antalet egna kort i färgen.
  const even = myInLed.length % 2 === 0
  const card = defensiveSignalCard(candidates, played, { kind: 'count', even })
  const reason = even
    ? 'Markering (§8.1): räkning – lågt kort visar JÄMNT antal i färgen för partnern.'
    : 'Markering (§8.1): räkning – högt kort visar UDDA antal i färgen för partnern.'
  return { card, reason }
}

const HCP_OF: Partial<Record<Rank, number>> = { A: 4, K: 3, Q: 2, J: 1 }
const SUIT_RANK_LOW_TO_HIGH: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades']

/**
 * Lavinthal-sak (markeringar Steg 3, docs/budsystem.md §8.2): FÖRSTA gången en
 * motspelare SAKAR (inte kan följa färg) visar kortets storlek färgpreferens –
 * högt kort ber om den rankHÖGRE av de övriga färgerna, lågt om den lägre.
 * Komponeras med honnörsvakten: `defenderGuardDiscard` väljer en SÄKER sakfärg,
 * Lavinthal väljer kortet inom den. Returnerar null när det inte gäller:
 * spelförarsidan, utspel, följer färg, bara trumf, inte första saket, eller
 * ingen frihet i den säkra färgen. Läser bara egen hand (ingen tjuvkik).
 */
function defenderFirstDiscardSignal(state: PlayState, seat: Seat, legal: Hand): CardChoice | null {
  if (side(seat) === side(state.contract.declarer)) return null // bara motspelet
  if (state.currentTrick.length === 0) return null // utspel, inte sak
  const led = state.currentTrick[0].card.suit
  if (legal.some((c) => c.suit === led)) return null // följer färg → inte sak
  const candidates = state.trump === null ? legal : legal.filter((c) => c.suit !== state.trump)
  if (candidates.length === 0) return null // bara trumf → gamla regeln
  // Bara FÖRSTA saket i given (§8.2): har jag redan sakat off-färg någon gång?
  const sakatFore = state.completedTricks.some((t) => {
    const ledS = t.cards[0]?.card.suit
    return t.cards.some((pc) => pc.seat === seat && pc.card.suit !== ledS)
  })
  if (sakatFore) return null
  // Säker sakfärg: honnörsvakten ger ett säkert kort → använd dess färg (annars
  // den naiva lågt-utan-ruff-färgen).
  const guardCard = defenderGuardDiscard(state, seat, legal)
  const safeSuit = (guardCard ?? lowAvoidRuff(legal, state.trump)).suit
  const inSuit = spareAfterGuards(candidates.filter((c) => c.suit === safeSuit))
  if (inSuit.length < 2) return null // ingen frihet att signalera → låt vakten stå
  // De TVÅ (eller tre i sang) övriga färgerna, rankordnade. Lavinthal pekar mot
  // den jag har mest honnörsstyrka i (den jag vill att partnern spelar).
  const others = SUIT_RANK_LOW_TO_HIGH.filter((s) => s !== safeSuit && s !== state.trump)
  const strength = (s: Suit) =>
    state.hands[seat].filter((c) => c.suit === s).reduce((n, c) => n + (HCP_OF[c.rank] ?? 0), 0)
  const higher = others[others.length - 1]
  const lower = others[0]
  const wantHigher = strength(higher) >= strength(lower)
  const card = defensiveSignalCard(inSuit, playedCards(state), { kind: 'lavinthal', wantHigher })
  const reason = wantHigher
    ? 'Markering (§8.2): Lavinthal-sak – högt kort ber om den högre av de andra färgerna.'
    : 'Markering (§8.2): Lavinthal-sak – lågt kort ber om den lägre av de andra färgerna.'
  return { card, reason }
}

/** Handens färger grupperade, längsta först (stabil ordning → längst, sedan handordning). */
function suitGroups(cards: Hand): Card[][] {
  const bySuit = new Map<Suit, Card[]>()
  for (const c of cards) (bySuit.get(c.suit) ?? bySuit.set(c.suit, []).get(c.suit)!).push(c)
  return [...bySuit.values()].sort((a, b) => b.length - a.length)
}

/**
 * Sant om ett utspel ur färgen skulle UNDERLEDA ett ess: vi håller esset men
 * `leadFromSuit` väljer ett spotkort under det (ingen topp-sekvens ledd av esset).
 */
function underleadsAce(suitCards: Card[]): boolean {
  if (!suitCards.some((c) => c.rank === 'A')) return false
  return leadFromSuit(suitCards).rank !== 'A'
}

/** Honnörsstyrka i en färg (kn=1, D=2, K=3, E=4) – för "längst OCH starkast". */
function honorScore(suitCards: Card[]): number {
  return suitCards.reduce((s, c) => s + Math.max(0, rankVal(c.rank) - rankVal('10')), 0)
}

const isMajorSuit = (suitCards: Card[]): boolean =>
  suitCards[0]?.suit === 'spades' || suitCards[0]?.suit === 'hearts'

/**
 * Hål E: färgval mot SANG – "längst OCH starkast". Längd är primärt (sang är ett
 * lopp att etablera en lång färg); vid lika längd väljs störst honnörsstyrka, och
 * vid lika styrka föredras en HÖGfärg (motståndarna stannar oftare för att kolla
 * högfärgerna → en objuden minor är mer sällan ledd). docs/utspel-teori.md §2/§3a.
 */
function bestByLenStrengthMajor(groups: Card[][]): Card[] {
  const maxLen = Math.max(...groups.map((g) => g.length))
  const longest = groups.filter((g) => g.length === maxLen)
  return [...longest].sort((a, b) => {
    const byHonor = honorScore(b) - honorScore(a)
    if (byHonor !== 0) return byHonor
    return (isMajorSuit(b) ? 1 : 0) - (isMajorSuit(a) ? 1 : 0)
  })[0]
}

function bestNtSuit(cards: Hand): Card[] {
  return bestByLenStrengthMajor(suitGroups(cards))
}

/**
 * Kortvalet för ett utspel (en sanning – delas av trick 1 och mitt-i-given, hål F).
 * SANG: längst OCH starkast (hål E, `bestNtSuit`), ess-underspel tillåtet. TRUMF:
 * underled ALDRIG ett ess (extra dyrt mot slam) – välj längsta färgen som inte
 * kräver ett ess-underspel; finns ingen (varje färg har ett oskyddat ess) cash:a
 * esset i längsta färgen i stället.
 */
function chooseLeadCard(cards: Hand, trump: Suit | null): Card {
  if (trump === null) return leadFromSuit(bestNtSuit(cards))
  const groups = suitGroups(cards)
  const safe = groups.filter((g) => !underleadsAce(g))
  if (safe.length > 0) return leadFromSuit(safe[0])
  return groups[0].find((c) => c.rank === 'A')! // alla färger underleder → cash:a esset
}

function openingLeadChoice(cards: Hand, trump: Suit | null): CardChoice {
  const honorReason = 'Utspel (§8.3): jag spelar ut min längsta färg och toppar honnörssekvensen.'
  const spotReason =
    'Utspel (§8.3): jag spelar ut min längsta färg med 3:e/5:e bästa kort så partnern ser längden.'

  const card = chooseLeadCard(cards, trump)
  const suit = cards.filter((c) => c.suit === card.suit)
  // Tvingad ess-cash (trumf + kortet är ett ess i en färg som skulle underlett).
  if (trump !== null && card.rank === 'A' && underleadsAce(suit)) {
    return {
      card,
      reason:
        'Utspel mot trumfkontrakt: jag underleder aldrig ett ess (mot slam blir ' +
        'spelförarens kung gratis) – jag cashar esset i stället.',
    }
  }
  const isHonor = honorLead(suit) !== null
  const reason =
    trump !== null && !isHonor
      ? spotReason + ' Mot ett trumfkontrakt underleder jag aldrig ett ess.'
      : isHonor
        ? honorReason
        : spotReason
  return { card, reason }
}

// --- Hål A+G: budgivningen styr utspelet (docs/utspel-teori.md §1/§2/§4) ---------

const CONTRACT_BID_RE = /^([1-7])(C|D|H|S|NT)$/
const STRAIN_TO_SUIT: Record<string, Suit | undefined> = {
  C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades', NT: undefined,
}

/**
 * Sant om öppningsutspelet var BUDSTYRT (hål A–G): utspelaren hade visade färger
 * (partnerns/motståndarnas) att gå på, så "längsta färgen"-doktrinen styrde inte
 * utspelet. Utspelsavkodningen (MC-urfallet fix 3) ska då stå över — avgörs här
 * eftersom auktionen finns här, inte i avkodningen.
 */
export function budstyrtOpeningLead(state: PlayState, calls: ResolvedCall[]): boolean {
  const leadSeat = state.completedTricks[0]?.cards[0]?.seat
  if (!leadSeat || calls.length === 0) return false
  const info = analyzeAuctionForLead(calls, leadSeat)
  return info.partnerSuits.length > 0 || info.oppSuits.length > 0
}

/** Vad auktionen säger om VILKA färger som är partnerns resp. motståndarnas. */
interface AuctionLeadInfo {
  partnerSuits: Suit[] // färger partnern bjudit (led gärna)
  oppSuits: Suit[] // färger någon motståndare bjudit (undvik)
}

/**
 * Plockar ut partnerns och motståndarnas bjudna färger ur auktionen, sett från
 * `seat`. Naturligt/konstgjort skiljs inte (första passet) – för de vanliga 2/1-
 * auktionerna räcker det, och att undvika en konstgjord färg (t.ex. Stayman-klöver)
 * skadar sällan.
 */
function analyzeAuctionForLead(calls: ResolvedCall[], seat: Seat): AuctionLeadInfo {
  const partner = PARTNER_SEAT[seat]
  const partnerSuits: Suit[] = []
  const oppSuits: Suit[] = []
  for (const c of calls) {
    // Speldiagnosen fynd 6 (frö 20260807): ett CUE-BUD visar en kontroll (ess/
    // renons), ingen egen längd — och varje försvarare hör det i förklaringen.
    // Räkna det inte som bjuden färg: korsruff-regeln triggade annars på en
    // vanlig Jacoby-höjning med sidofärg + kontrollbud. (Regelnamnen för alla
    // kontrollbud börjar på "cue".)
    if (c.rule !== undefined && c.rule.startsWith('cue')) continue
    const m = CONTRACT_BID_RE.exec(c.bid)
    if (!m) continue
    const suit = STRAIN_TO_SUIT[m[2]]
    if (!suit) continue
    if (c.seat === partner) {
      if (!partnerSuits.includes(suit)) partnerSuits.push(suit)
    } else if (c.seat !== seat) {
      if (!oppSuits.includes(suit)) oppSuits.push(suit)
    }
  }
  return { partnerSuits, oppSuits }
}

/**
 * Osäker (tenass-)färg att bryta mot ett TRUMFKONTRAKT: en honnör (D+) i toppen
 * utan en ledbar sekvens → att leda lågt leder BORT från honnörsgaffeln (KJxxx,
 * AQxxx, Kxxx…). Grundprincipen bakom ess-regeln, generaliserad (hål G).
 */
function unsafeToLead(suitCards: Card[]): boolean {
  if (honorLead(suitCards) !== null) return false // sekvens → säker att leda
  return rankVal(highest(suitCards).rank) >= rankVal('Q')
}

/** Trumfutspel-kort: 3 små → mitten, annars (2/4) → lägsta (så partnern läser TRUMF). */
function trumpLeadCard(trumps: Card[]): Card {
  const desc = [...trumps].sort((a, b) => rankVal(b.rank) - rankVal(a.rank))
  return desc.length === 3 ? desc[1] : lowest(trumps)
}

/** Bland säkra färger: föredra en sekvens, sedan längd, sedan högfärg. */
function pickSafeSuit(groups: Card[][]): Card[] {
  return [...groups].sort((a, b) => {
    const seq = (honorLead(b) ? 1 : 0) - (honorLead(a) ? 1 : 0)
    if (seq !== 0) return seq
    if (a.length !== b.length) return b.length - a.length
    return (isMajorSuit(b) ? 1 : 0) - (isMajorSuit(a) ? 1 : 0)
  })[0]
}

/**
 * Budstyrt utspel (trick 1). Prioritet (docs/utspel-teori.md §1):
 *  1. Partnerns bjudna färg (om vi håller den) – "kan vara fel, aldrig fel".
 *  2. Mot NT: längst & starkast, men undvik motståndarnas bjudna färg om alternativ.
 *  3. Mot trumf: PASSIVT – undvik ess-underspel, tenasser (hål G) och deras färger;
 *     släpp kraven i tur och ordning om ingen färg klarar alla, cash:a ess sist.
 */
function openingLeadWithAuction(cards: Hand, trump: Suit | null, info: AuctionLeadInfo): CardChoice {
  const groups = suitGroups(cards)
  const isOpp = (g: Card[]) => info.oppSuits.includes(g[0].suit)

  // 1. Partnerns färg.
  const held = info.partnerSuits.map((s) => cards.filter((c) => c.suit === s)).filter((g) => g.length > 0)
  if (held.length > 0) {
    const suit = [...held].sort((a, b) => b.length - a.length)[0]
    return {
      card: leadFromSuit(suit),
      reason: 'Utspel: jag leder partnerns bjudna färg (budgivningen) – den kan vara fel men är sällan fel.',
    }
  }

  if (trump === null) {
    const nonOpp = groups.filter((g) => !isOpp(g))
    const best = bestByLenStrengthMajor(groups)
    const bestNonOpp = nonOpp.length > 0 ? bestByLenStrengthMajor(nonOpp) : best
    // Att undvika motståndarnas bjudna färg är en TUMREGEL, inte en lag: en egen
    // stark LÅNG färg (6+, eller 5+ med en ledbar honnörssekvens) är själva
    // stickkällan mot sang och leds även om spelföraren bjudit den (felrapport
    // #46: KQ96532 mot 1♦-öppnarens sang). Undvik-regeln gäller bara när den
    // objudna färgen inte är klart sämre – annars slår längden/styrkan igenom.
    const strongLong = best.length >= 6 || (best.length >= 5 && honorLead(best) !== null)
    const överstyr = isOpp(best) && strongLong && best.length > bestNonOpp.length
    const chosen = isOpp(best) && !överstyr ? bestNonOpp : best
    const avoided = chosen !== best
    return {
      card: leadFromSuit(chosen),
      reason: överstyr
        ? 'Utspel mot NT: min långa, starka färg – den är min stickkälla, så jag leder den även om motståndarna bjudit den.'
        : avoided
          ? 'Utspel mot NT: min längsta/starkaste färg som motståndarna INTE bjudit.'
          : 'Utspel mot NT: min längsta och starkaste färg.',
    }
  }

  // Trumfkontrakt: passivt färgval + trumf-/singelutspel (hål C+D). Trumffärgen
  // hanteras separat (egna kortregler) och utesluts ur sidofärgsvalet.
  const trumps = cards.filter((c) => c.suit === trump)
  const sideGroups = groups.filter((g) => g[0].suit !== trump)
  const canRuff = trumps.length >= 2 && trumps.length <= 3 && honorLead(trumps) === null
  const safeTrump = trumps.length >= 2 && rankVal(highest(trumps).rank) < rankVal('Q')
  const passiveReason =
    'Utspel mot trumfkontrakt (budstyrt): jag leder passivt och undviker att leda bort ' +
    'från en honnörsgaffel eller in i motståndarnas färg.'

  // Hål D: singelutspel för ruff – korta trumf (kan ruffa, ingen trumfkontroll) +
  // en singel i en sidofärg.
  if (canRuff) {
    const stiff = sideGroups.filter((g) => g.length === 1 && !isOpp(g))
    if (stiff.length > 0) {
      return {
        card: stiff[0][0],
        reason: 'Utspel: jag leder min singel och siktar på en ruff (jag har korta trumf att ruffa med).',
      }
    }
  }
  // Hål C: trumfutspel när motståndarna bjudit 3+ färger (korsruff-läge) → klipp ruffar.
  if (safeTrump && info.oppSuits.length >= 3) {
    return {
      card: trumpLeadCard(trumps),
      reason: 'Utspel: trumf – motståndarna bjöd flera färger (korsruff-läge), jag drar trumf för att klippa deras ruffar.',
    }
  }

  const safe = sideGroups.filter((g) => !underleadsAce(g) && !unsafeToLead(g) && !isOpp(g))
  if (safe.length > 0) return { card: leadFromSuit(pickSafeSuit(safe)), reason: passiveReason }
  const safeAny = sideGroups.filter((g) => !underleadsAce(g) && !unsafeToLead(g))
  if (safeAny.length > 0) return { card: leadFromSuit(pickSafeSuit(safeAny)), reason: passiveReason }
  // Hål C: hellre ett säkert trumfutspel än att bryta en tenass.
  if (safeTrump) {
    return {
      card: trumpLeadCard(trumps),
      reason: 'Utspel: ett säkert trumfutspel – jag ger inget genom att bryta en honnörsgaffel.',
    }
  }
  const notUnderlead = sideGroups.filter((g) => !underleadsAce(g))
  if (notUnderlead.length > 0) {
    return {
      card: leadFromSuit(pickSafeSuit(notUnderlead)),
      reason: 'Utspel mot trumfkontrakt: ingen helt säker färg – jag väljer den minst riskabla utan ess-underspel.',
    }
  }
  const aceSuit = sideGroups.find((g) => g.some((c) => c.rank === 'A'))
  if (aceSuit) {
    return {
      card: aceSuit.find((c) => c.rank === 'A')!,
      reason: 'Utspel mot trumfkontrakt: varje färg skulle underleda ett ess – jag cashar esset i stället.',
    }
  }
  return { card: leadFromSuit(sideGroups[0] ?? trumps), reason: passiveReason }
}

/** Sant om `card` slår `against` givet utspelsfärg och trumf (samma regel som motorn). */
function beats(card: Card, against: Card, led: Suit, trump: Suit | null): boolean {
  const cT = trump !== null && card.suit === trump
  const aT = trump !== null && against.suit === trump
  if (cT !== aT) return cT
  if (cT && aT) return rankVal(card.rank) > rankVal(against.rank)
  const cLed = card.suit === led
  const aLed = against.suit === led
  if (cLed !== aLed) return cLed
  if (cLed && aLed) return rankVal(card.rank) > rankVal(against.rank)
  return false
}

/** Ett kortval + en förklaring i klartext (för "Varför?"-knappen, docs/bot-hjarna.md). */
export interface CardChoice {
  card: Card
  reason: string
}

/** Tumregel-inställningar. `signals:false` stänger av försvarsmarkeringar (bara
 * för stickneutralitets-mätningen: jämför spel MED vs UTAN markeringar). */
export interface ReasonedOpts {
  signals?: boolean
}

/**
 * Ungefärligt antal stick en färg ger vår sida om vi leder den upprepat (med
 * entré, motståndarna följer, okänd sits → neutral räkning): gå uppifrån – vårt
 * toppkort vinner om det slår motståndarnas bästa kvarvarande, annars offras vårt
 * lägsta för att knäcka deras spärr; när de är slut är resten längdstick. Ärlig
 * (bara rank-multimängderna, ingen tjuvkik). Ex: ♦KQJT9-32 mot ♦A-876 → 6 stick.
 */
function suitTricks(ourDesc: Rank[], oppDesc: Rank[]): number {
  const o = [...ourDesc]
  const p = [...oppDesc]
  let tricks = 0
  while (o.length > 0) {
    if (p.length === 0) {
      tricks += o.length // motståndarna slut → rena längdstick
      break
    }
    if (rankVal(o[0]) > rankVal(p[0])) {
      tricks++ // vårt toppkort vinner
      o.shift()
      p.pop() // de följer med sitt lägsta
    } else {
      o.pop() // offra vårt lägsta …
      p.shift() // … och knäck deras spärr (deras topp vinner sticket)
    }
  }
  return tricks
}

/**
 * Spelförarplan FÖRE cashandet (felrapport #32, docs/bot-hjarna.md
 * "förberedelsen vid 9–13 kort"): är spelförarsidan inne och har en LÅNG färg som
 * behöver etableras – en near-solid längd där motståndarna håller en spärr (t.ex.
 * ♦KQJT9 mot deras ♦A) – knäcks spärren FÖRST, medan sidoessen ännu håller
 * motståndarnas honnörer. Cashar man sidovinnarna först bränns stoppen/entréerna,
 * och när spärren väl knäcks är motståndarnas honnörer goda (boten tog 3 där 7
 * fanns). Felet sker vid 9–13 kort, ovanför Monte-Carlo-fönstret (≤8), så
 * tumregel-lagret måste kunna planera – MC hinner inte laga en förstörd position.
 *
 * Ärlig räkning (ingen tjuvkik): ser bara egen sida (spelförare + träkarl via
 * `visibleSeats`) och spelade kort. Attackerar färg S nu bara när ALLA villkor
 * håller (konservativt – fyrar bara med full kontroll):
 *  1. Kombinerad längd ≥ 4 och den ledande handen har färgen att leda.
 *  2. Etablering ger ≥ 2 stick mer än de omedelbara säkra vinnarna i S (det finns
 *     en spärr att knäcka OCH längd bakom den; redan cashande färger ger 0).
 *  3. Varje ANNAN färg är stoppad av vår sida (säker vinnare där, eller
 *     motståndarna renons) – annars kan de rulla en egen färg när vi släpper dem in.
 *  4. Vi kan inte redan casha hem alla återstående stick (då behövs ingen färg).
 * Returnerar kortet att leda (högsta ur den ledande handen, avblockat) eller null.
 */
function establishLongSuit(state: PlayState, seat: Seat, legal: Hand): CardChoice | null {
  if (side(seat) !== side(state.contract.declarer)) return null // bara spelförarsidan
  if (state.trump !== null) return null // bara sang: i trumfkontrakt etableras färg
  //                                       genom RUFF, och "säkra vinnare" kan ruffas
  //                                       bort – då är stopp-gaten osund (felrapport #32
  //                                       är ett sang-koncept). Uppmätt: heuristiken
  //                                       tappade stick i 4♠-givar men vann i sang.
  if (state.currentTrick.length !== 0) return null // bara när jag är inne (på lead)
  const played = playedCards(state)
  const visible = visibleSeats(state, seat)
  const ourCards = visible.flatMap((v) => state.hands[v])
  const suitsAll: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
  const oursIn = (s: Suit) => ourCards.filter((c) => c.suit === s)
  const immediate = (s: Suit) => oursIn(s).filter((c) => isSureWinner(c, ourCards, played)).length

  // Guard 4: kan vi redan casha hem alla återstående stick? Då behövs ingen färg.
  if (suitsAll.reduce((n, s) => n + immediate(s), 0) >= state.hands[seat].length) return null

  const oppUnseen = (s: Suit): Rank[] => {
    const ourRanks = new Set(oursIn(s).map((c) => c.rank))
    const playedRanks = new Set(played.filter((c) => c.suit === s).map((c) => c.rank))
    return RANK_LOW_TO_HIGH.filter((r) => !ourRanks.has(r) && !playedRanks.has(r))
  }
  const stopped = (s: Suit) => immediate(s) > 0 || oppUnseen(s).length === 0

  let best: { suit: Suit; gain: number; tricks: number } | null = null
  for (const s of suitsAll) {
    const ours = oursIn(s)
    if (ours.length < 4) continue // för kort för att vara etablerbar längd
    if (!legal.some((c) => c.suit === s)) continue // ledande handen måste ha färgen att leda
    const ourDesc = ours.map((c) => c.rank).sort((a, b) => rankVal(b) - rankVal(a))
    const oppDesc = oppUnseen(s).sort((a, b) => rankVal(b) - rankVal(a))
    const tricks = suitTricks(ourDesc, oppDesc)
    const gain = tricks - immediate(s)
    if (gain < 2) continue // ingen/för liten etableringsvinst
    if (!suitsAll.every((t) => t === s || stopped(t))) continue // ge inte ledningen om annat är öppet
    if (!best || gain > best.gain || (gain === best.gain && tricks > best.tricks)) {
      best = { suit: s, gain, tricks }
    }
  }
  if (!best) return null
  const mine = legal.filter((c) => c.suit === best.suit)
  return {
    card: unblockLead(state, seat, highest(mine)),
    reason:
      'Spelförarplan (felrapport #32): jag etablerar min långa färg – knäcker ' +
      'motståndarnas spärr först, medan mina sidoess håller deras honnörer, i ' +
      'stället för att casha topparna och bränna stoppen.',
  }
}

const ALL_RANKS: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']

/**
 * Spelförarsidan (som lagligt ser BÅDA sina händer) ska inte gömma sig bakom
 * partnerns SLAGBARA kort (felrapport #48). När partnern "vinner" sticket men en
 * motståndare som spelar EFTER mig kan gå över kortet, går jag själv upp med det
 * billigaste kort som säkert vinner – i stället för att kasta lågt och skänka
 * bort sticket. Bara spelförarsidan (dummy syns – ingen kik) och bara när det är
 * BEVISBART att de slående korten ligger hos en motståndare som ännu inte spelat:
 * varje motståndare som redan lagt till sticket måste vara renons i ledd färg
 * (annars kan det höga kortet ligga hos dem och partnern vinner ändå). null =
 * regeln gäller inte → den vanliga "kasta lågt bakom partnern" står kvar.
 */
function winOverBeatablePartner(
  state: PlayState,
  seat: Seat,
  legal: Hand,
  led: Suit,
  bestCard: Card,
): CardChoice | null {
  if (side(seat) !== side(state.contract.declarer)) return null // bara spelförarsidan ser båda händer
  const trump = state.trump
  const SEATS_ALL: Seat[] = ['N', 'E', 'S', 'W']
  const yetToPlayOpps = SEATS_ALL.filter(
    (s) => side(s) !== side(seat) && !state.currentTrick.some((pc) => pc.seat === s),
  )
  if (yetToPlayOpps.length === 0) return null // ingen motståndare kvar → partnern vinner säkert
  // Har en REDAN spelad motståndare följt ledd färg? Då kan ett slående kort ligga
  // kvar hos dem (de kan ha maskat) och partnern vinner ändå → avstå (konservativt).
  if (state.currentTrick.some((pc) => side(pc.seat) !== side(seat) && pc.card.suit === led)) return null
  // Utestående kort i ledd färg = alla rangar minus dem spelförarsidan ser (båda
  // egna händer + spelade kort). Med vakten ovan ligger de hos en kvarvarande
  // motståndare.
  const partner = PARTNER_SEAT[seat]
  const seenLed = new Set<Rank>()
  for (const c of playedCards(state)) if (c.suit === led) seenLed.add(c.rank)
  for (const c of state.hands[seat]) if (c.suit === led) seenLed.add(c.rank)
  for (const c of state.hands[partner]) if (c.suit === led) seenLed.add(c.rank)
  const oppLed: Card[] = ALL_RANKS.filter((r) => !seenLed.has(r)).map((r) => ({ suit: led, rank: r }))
  if (!oppLed.some((o) => beats(o, bestCard, led, trump))) return null // partnern vinner säkert
  // Ruffrisk (trumfkontrakt, ledd ≠ trumf): en kvarvarande motståndare renons i
  // ledd färg kan trumfa min vinnare → jag kan inte garantera sticket.
  if (trump !== null && led !== trump) {
    const voids = shownVoids(state)
    if (yetToPlayOpps.some((s) => voids[s].has(led))) return null
  }
  // Billigaste egna kort som slår partnerns kort OCH alla utestående i ledd färg.
  const mineWin = legal.filter(
    (c) => beats(c, bestCard, led, trump) && oppLed.every((o) => beats(c, o, led, trump)),
  )
  if (mineWin.length === 0) return null
  return {
    card: lowest(mineWin),
    reason:
      'Partnerns kort kan slås av en motståndare som spelar efter mig – jag går själv ' +
      'upp med det billigaste kort som säkert vinner sticket i stället för att släppa det.',
  }
}

/**
 * Speldiagnosen S2 (frö 20260731, stick 6): Nord ledde trumf ur ♠J76 EFTER att
 * Öst sakat i trumf — all kvarvarande trumf (♠QT32) satt alltså bevisligen hos
 * Väst, med toppen ÖVER vår topp och minst lika lång som vår längsta trumfhand.
 * Då kan en trumfled aldrig dra ut deras mästartrumf: varje varv skänker ett
 * stick rakt in i den kända gaffeln (−2 stick uppmätt). Ärlig inferens: bygger
 * bara på show-outen (`shownVoids`) och egna sidans kort. Att driva ut EN hög
 * trumf (t.ex. KQJ76 mot känt A98) är fortfarande sund teknik — spärren kräver
 * att den kända handens trumf är minst lika lång som vår längsta.
 */
function hopelessTrumpLead(state: PlayState, seat: Seat): boolean {
  const trump = state.trump
  if (trump === null) return false
  if (side(seat) !== side(state.contract.declarer)) return false // ser båda händer
  const voids = shownVoids(state)
  const opps = (['N', 'E', 'S', 'W'] as Seat[]).filter((s) => side(s) !== side(seat))
  if (opps.filter((o) => voids[o].has(trump)).length !== 1) return false // ingen känd samlad sits
  const ours = visibleSeats(state, seat).map((v) => state.hands[v].filter((c) => c.suit === trump))
  const ourAll = ours.flat()
  if (ourAll.length === 0) return false // ingen trumf att leda
  const seen = new Set<Rank>(ourAll.map((c) => c.rank))
  for (const c of playedCards(state)) if (c.suit === trump) seen.add(c.rank)
  const unseen = ALL_RANKS.filter((r) => !seen.has(r))
  if (unseen.length === 0) return false
  const topUnseen = Math.max(...unseen.map(rankVal))
  const topOurs = Math.max(...ourAll.map((c) => rankVal(c.rank)))
  return topUnseen > topOurs && unseen.length >= Math.max(...ours.map((h) => h.length))
}

/**
 * Speldiagnosen runda 4 (tävling 2026-08-11 bricka 1, stick 2+5): DRA TRUMF.
 * Tumregel-lagret hade ingen trumfdragningsplan alls — cash-regeln kräver en
 * SÄKER vinnare, så med t.ex. ♦AJ94 mot ♦Q86 (kungen ute) körde spelföraren
 * sidofärger tills motståndarna ruffade vinnarna. Styrkeprovet räknas ärligt:
 * kombinerad trumf (båda synliga händerna) mot de osedda korten, varv för varv
 * med samma neutrala modell som `suitTricks` — vinner vår sida MINST lika
 * många varv som motståndarna är trumfdragning rätt plan (även ett jämnt
 * styrkeprov dras: varven de vinner var deras ändå, och dragningen stoppar
 * ruffarna — tävling 2026-08-11 bricka 1 släppte trumfen vid 2–2 och fick
 * ♣K ruffad). Svag trumf (fler förlustvarv) drar inte, och gaffel-vakten
 * (`hopelessTrumpLead`) har alltid företräde.
 */
function shouldDrawTrumps(state: PlayState, seat: Seat): boolean {
  const trump = state.trump
  if (trump === null) return false
  if (side(seat) !== side(state.contract.declarer)) return false
  const ours = visibleSeats(state, seat).flatMap((v) =>
    state.hands[v].filter((c) => c.suit === trump),
  )
  if (ours.length === 0) return false
  const seen = new Set<Rank>(ours.map((c) => c.rank))
  for (const c of playedCards(state)) if (c.suit === trump) seen.add(c.rank)
  const unseen = ALL_RANKS.filter((r) => !seen.has(r))
  if (unseen.length === 0) return false // trumfen är redan dragen
  const o = ours.map((c) => c.rank).sort((a, b) => rankVal(b) - rankVal(a))
  const p = [...unseen].sort((a, b) => rankVal(b) - rankVal(a))
  let wins = 0
  let losses = 0
  while (o.length > 0 && p.length > 0) {
    if (rankVal(o[0]) > rankVal(p[0])) {
      wins++ // vårt toppkort vinner varvet, de följer med sitt lägsta
      o.shift()
      p.pop()
    } else {
      losses++ // deras topp vinner — vi offrar vårt lägsta för att knäcka den
      o.pop()
      p.shift()
    }
  }
  return wins >= losses
}

/**
 * Speldiagnosen S2 (frö 20260730, stick 2): spelföraren ledde ♥2 mot träkarlens
 * ♥Q753 — och träkarlen la ♥7, "vinn billigast". Sjuan föll för tian och damen
 * dog senare under esset (−2 stick). Spelförarsidan SER båda sina händer och
 * kan värdera färgkombinationen ärligt: för varje möjlig vinnare simuleras
 * sticket (motståndaren bakom vinner billigast över eller lägger lägst av de
 * osedda korten) och resten av färgen räknas med `suitTricks`. Bara tredje hand
 * på spelförarsidan (egen sida ledde mot mig, exakt en motståndare kvar bakom),
 * och kortet byts bara när simuleringen är STRIKT bättre än gamla "billigaste
 * vinnaren" — annars null (ingen beteendedrift i vanliga lägen).
 */
function declarerThirdHandSuitCard(
  state: PlayState,
  seat: Seat,
  winners: Hand,
  led: Suit,
): Card | null {
  if (side(seat) !== side(state.contract.declarer)) return null
  if (state.currentTrick.length !== 2) return null // bara tredje hand
  const candidates = winners.filter((c) => c.suit === led)
  if (candidates.length !== winners.length || candidates.length < 2) return null // ruff/annat → gamla regeln
  const SEATS_ALL: Seat[] = ['N', 'E', 'S', 'W']
  const fourth = SEATS_ALL.find((s) => s !== seat && !state.currentTrick.some((pc) => pc.seat === s))!
  // Ruffvakt: sidofärg där motståndaren bakom visat renons → simuleringen ljuger.
  if (state.trump !== null && led !== state.trump && shownVoids(state)[fourth].has(led)) return null
  const played = playedCards(state)
  const ourInLed = visibleSeats(state, seat).flatMap((v) =>
    state.hands[v].filter((c) => c.suit === led),
  )
  const seen = new Set<Rank>(ourInLed.map((c) => c.rank))
  for (const c of played) if (c.suit === led) seen.add(c.rank)
  const unseen = ALL_RANKS.filter((r) => !seen.has(r))
  if (unseen.length === 0) return null // inget kan slå oss → billigaste vinnaren är rätt

  // Simulerad totalsumma för färgen om jag lägger `c`: vinner vi sticket nu +
  // suitTricks på resten (våra kvarvarande kort i färgen mot de osedda).
  const total = (c: Card): number => {
    const beatable = unseen.filter((r) => rankVal(r) > rankVal(c.rank))
    const oppPlays = beatable.length > 0 ? Math.min(...beatable.map(rankVal)) : Math.min(...unseen.map(rankVal))
    const wonNow = beatable.length === 0 ? 1 : 0
    const ourRest = ourInLed
      .filter((o) => o.rank !== c.rank)
      .map((o) => o.rank)
      .sort((a, b) => rankVal(b) - rankVal(a))
    const oppRest = unseen
      .filter((r) => rankVal(r) !== oppPlays)
      .sort((a, b) => rankVal(b) - rankVal(a))
    return wonNow + suitTricks(ourRest, oppRest)
  }
  const old = lowest(candidates)
  const oldTotal = total(old)
  let best: Card | null = null
  let bestTotal = oldTotal
  for (const c of candidates) {
    const t = total(c)
    if (t > bestTotal || (t === bestTotal && best !== null && rankVal(c.rank) < rankVal(best.rank))) {
      best = c
      bestTotal = t
    }
  }
  return best // null = inget kort strikt bättre än billigaste vinnaren
}

/**
 * Tumregel-valet MED förklaring. Samma logik som `botCard` men returnerar också
 * en klartextsmotivering ("Varför?"). Beskrivningarna följer nybörjardoktrinen.
 */
export function botCardReasoned(state: PlayState, seat: Seat, opts: ReasonedOpts = {}): CardChoice {
  const signalsOn = opts.signals !== false
  const legal = legalCards(state, seat)
  if (legal.length === 1) return { card: legal[0], reason: 'Bara ett lagligt kort att spela.' }

  // På lead:
  if (state.currentTrick.length === 0) {
    // Äkta utspel (trick 1, inga avslutade stick): utspelsdoktrin, inte cash-out
    // – man underleder inte ess/vinnare på utspelet. Mot trumfkontrakt underleds
    // ess ALDRIG (openingLeadChoice byter färg / cashar esset).
    if (state.completedTricks.length === 0) {
      return openingLeadChoice(legal, state.trump)
    }
    // Spelförarsidan: etablera en lång färg (knäck motståndarnas spärr) FÖRE du
    // cashar sidovinnarna – annars bränns stoppen/entréerna (felrapport #32).
    const establish = establishLongSuit(state, seat, legal)
    if (establish) return establish

    // Mitt i given och inne: cash:a säkra vinnare uppifrån i stället för att leda
    // lågt ur längsta färgen (annars tas 10 stick där 13 var kalla).
    // Sang eller räknad trumf (ingen dold hand kan ruffa) → även sidofärgs­-
    // vinnare är säkra (Steg 1b). Annars bara trumffärgens vinnare (Steg 1a).
    const played = playedCards(state)
    const noRuffThreat = state.trump === null || unseenTrumpCount(state, seat) === 0
    const cashable = legal.filter(
      (c) => isSureWinner(c, legal, played) && (noRuffThreat || c.suit === state.trump),
    )
    // MOTSPELAREN cash:ar försiktigare än spelförarsidan (felrapport #6): ett
    // ENSAMT säkert stick i en FÄRSK färg (t.ex. ett torrt ess) gör spelförarens
    // honnörer under stora. Cash:a bara när färgen har minst två säkra vinnare
    // (löpande topp) eller när vår sida redan attackerat färgen (lett den i ett
    // färdigt stick – då är den etablerad, t.ex. sista vinnaren efter EK cashade).
    // Annars gäller §8-doktrinen: fortsätt utspelfärgen i stället för att öppna
    // en ny färg åt spelföraren.
    const defender = side(seat) !== side(state.contract.declarer)
    const attacked = new Set<Suit>()
    if (defender) {
      for (const t of state.completedTricks) {
        const first = t.cards[0]
        if (first && side(first.seat) === side(seat)) attacked.add(first.card.suit)
      }
    }
    const safeCash = defender
      ? cashable.filter(
          (c) => attacked.has(c.suit) || cashable.filter((w) => w.suit === c.suit).length >= 2,
        )
      : cashable
    if (safeCash.length > 0) {
      return { card: unblockLead(state, seat, highest(safeCash)), reason: 'Jag är inne och cashar en säker vinnare – inget högre kort är kvar i färgen.' }
    }
    // Motspelets utspelfärg (trick 1, om den leddes av vår sida) fortsätts före
    // allt annat – partnerns honnörer sitter ofta bakom den.
    const t1 = state.completedTricks[0]?.cards[0]
    const attackSuit = defender && t1 && side(t1.seat) === side(seat) ? t1.card.suit : null
    const attack = attackSuit !== null ? legal.filter((c) => c.suit === attackSuit) : []
    if (attack.length > 0) {
      return {
        card: unblockLead(state, seat, leadFromSuit(attack)),
        reason: 'Jag fortsätter motspelets utspelfärg (§8) – vi bygger vidare på den i stället för att öppna en ny färg åt spelföraren.',
      }
    }
    // Speldiagnosen S2 (frö 20260731): trumfled in i en KÄND gaffel undviks —
    // en show-out har placerat all kvarvarande trumf hos en motståndare, över
    // vår topp och minst lika lång. Välj då bland sidofärgerna i stället.
    const nonTrump = state.trump !== null ? legal.filter((c) => c.suit !== state.trump) : []
    if (nonTrump.length > 0 && hopelessTrumpLead(state, seat)) {
      return {
        card: unblockLead(state, seat, chooseLeadCard(nonTrump, state.trump)),
        reason:
          'Jag leder INTE trumf: sakningen visade att all kvarvarande trumf sitter samlad ' +
          'bakom oss med toppen över vår – varje trumfvarv skänker ett stick rakt in i den ' +
          'kända gaffeln. Jag spelar en sidofärg i stället.',
      }
    }
    // Speldiagnosen runda 4: trumfdragningsplanen — vinner vår kombinerade
    // trumf styrkeprovet mot de osedda korten leds trumf (topp av sekvens,
    // annars lågt mot partnerns kombination) tills motståndarnas trumf är slut.
    if (
      state.trump !== null &&
      legal.some((c) => c.suit === state.trump) &&
      shouldDrawTrumps(state, seat)
    ) {
      return {
        card: leadFromSuit(legal.filter((c) => c.suit === state.trump)),
        reason:
          'Jag drar trumf: vår samlade trumf vinner styrkeprovet, så motståndarnas trumf ' +
          'ska bort innan de hinner ruffa våra vinnare.',
      }
    }
    return {
      card: unblockLead(state, seat, chooseLeadCard(legal, state.trump)),
      reason:
        'Jag är inne och spelar ut ur min längsta färg – men underleder aldrig ett ess mot ett trumfkontrakt.',
    }
  }

  const led = state.currentTrick[0].card.suit
  const bestSeat = currentWinner(state.currentTrick, state.trump)
  const bestCard = state.currentTrick.find((pc) => pc.seat === bestSeat)!.card

  // Vid sakning (kan inte följa färg) vaktar spelförarsidan sina hotkort
  // (Steg B1, kast-vakten) – annars gäller gamla "kasta lågt".
  const guardReason =
    'Jag vaktar mina hotkort: sakar ur färgen där vår sida har störst överskott och behåller kort som kan växa till stick.'
  const defenderGuardReason =
    'Jag vaktar min honnör: sakar ur en färg utan skyddsvärd honnör i stället för att blotta t.ex. en dam under motståndarnas ess-kung.'

  // Partnern leder redan sticket → slösa inte, kasta lågt (ruffa aldrig partnern).
  if (side(bestSeat) === side(seat)) {
    // …MEN spelförarsidan gömmer sig inte bakom partnerns SLAGBARA kort: kan en
    // motståndare som spelar efter mig gå över, går jag själv upp och vinner
    // billigast (felrapport #48).
    const winOver = winOverBeatablePartner(state, seat, legal, led, bestCard)
    if (winOver) return winOver
    const guarded = guardedDiscard(state, seat, legal)
    if (guarded) return { card: guarded, reason: guardReason }
    const lav = signalsOn ? defenderFirstDiscardSignal(state, seat, legal) : null
    if (lav) return lav
    const defGuard = defenderGuardDiscard(state, seat, legal)
    if (defGuard) return { card: defGuard, reason: defenderGuardReason }
    const signal = signalsOn ? defensiveFollowSignal(state, seat, legal) : null
    if (signal) return signal
    return { card: lowAvoidRuff(legal, state.trump), reason: 'Partnern vinner redan sticket – jag kastar lågt och ruffar aldrig partnerns stick.' }
  }

  // Andra hand (bara utspelet lagt än så länge, motståndaren leder) → lågt.
  // UNDANTAG (felrapport #12): med LÖPANDE toppvinnare i den ledda färgen
  // (2+ säkra vinnare) finns inget att spara på – gå upp med den billigaste
  // säkra vinnaren i stället för att skänka bort sticket (Väst la ♥8 ur
  // ♥AKQT98 och Nords knekt vann). Ett ENSAMT säkert kort (t.ex. torrt ess)
  // läggs fortfarande lågt – hold-up/andra hand lågt-doktrinen består. Har en
  // kvarvarande spelare visat renons i färgen kan honnören ruffas → lågt.
  if (state.currentTrick.length === 1) {
    const sure = legal.filter((c) => c.suit === led && isSureWinner(c, legal, playedCards(state)))
    // Speldiagnosen S0 (frö 20260731): "säker vinnare" räknas mot UTESTÅENDE
    // kort — men kortet som redan ligger i sticket måste också slås, annars
    // slösas en honnör under motståndarens (♣Q föll under utspelad ♣K ur
    // AQ42). Bara vinnare som faktiskt TAR sticket får väljas.
    const tarSticket = sure.filter((c) => beats(c, state.currentTrick[0].card, led, state.trump))
    if (sure.length >= 2 && tarSticket.length > 0) {
      const voids = shownVoids(state)
      const yetToPlay = (['N', 'E', 'S', 'W'] as Seat[]).filter(
        (s) => s !== seat && !state.currentTrick.some((pc) => pc.seat === s),
      )
      const ruffRisk =
        state.trump !== null && led !== state.trump && yetToPlay.some((s) => voids[s].has(led))
      if (!ruffRisk) {
        return {
          card: lowest(tarSticket),
          reason: 'Löpande toppvinnare i färgen – jag går upp med den billigaste säkra vinnaren i stället för att maska bort sticket.',
        }
      }
    }
    // Speldiagnosen S0 (frö 20260772): SPELFÖRARSIDAN renons i den ledda
    // sidofärgen med trumf kvar → RUFFA lågt i stället för att saka. En trumf
    // vinner per definition sticket här (bara en annan trumf går över), så
    // doktrinen "ruffa bara när det vinner sticket" är uppfylld — sakreglerna
    // slösade i stället bort ess ("vaktar hotkorten") och tappade 5 stick.
    // Försvarets andra hand ändras INTE (partnern kan fortfarande vinna sticket).
    if (side(seat) === side(state.contract.declarer) && state.trump !== null && led !== state.trump) {
      const myTrumps = legal.filter((c) => c.suit === state.trump)
      if (myTrumps.length > 0 && !legal.some((c) => c.suit === led)) {
        // Speldiagnosen runda 4 (tävling 2026-08-11 bricka 1, stick 10): ruffa
        // INTE när den SYNLIGA partnern (fjärde hand) bevisligen vinner sticket
        // ändå — "ruffa aldrig partnerns stick" gäller även spelförarsidan.
        // Ärligt krav: partnerns kort slår utspelskortet OCH varje osett kort i
        // färgen, och motståndaren emellan har inte visat renons (kan inte
        // ruffa framför partnern). Då sakas i stället (vakterna nedan).
        const partner = PARTNER_SEAT[seat]
        const third = PARTNER_SEAT[state.currentTrick[0].seat]
        const seenLed = new Set<Rank>()
        for (const c of playedCards(state)) if (c.suit === led) seenLed.add(c.rank)
        for (const c of state.hands[partner]) if (c.suit === led) seenLed.add(c.rank)
        const unseenLed = ALL_RANKS.filter((r) => !seenLed.has(r))
        const partnerWins =
          !shownVoids(state)[third].has(led) &&
          state.hands[partner].some(
            (c) =>
              c.suit === led &&
              rankVal(c.rank) > rankVal(state.currentTrick[0].card.rank) &&
              unseenLed.every((r) => rankVal(c.rank) > rankVal(r)),
          )
        if (!partnerWins) {
          return {
            card: lowest(myTrumps),
            reason: 'Jag är renons i den ledda färgen och ruffar lågt – trumfen vinner sticket i stället för att jag sakar bort en vinnare.',
          }
        }
      }
    }
    // Speldiagnosen runda 4 (tävling 2026-08-11 bricka 8, stick 1): ANDRA hand
    // på spelförarsidan täcker BILLIGT när den synliga partnern (fjärde hand)
    // har boss i den ledda färgen (♦J1084 lägger 8:an på ledd 7:a när partnern
    // håller AK2). Insatsen är gratis: slås täckningen över vinner partnerns
    // boss ändå; slås den inte är sticket vunnet OCH partnerns boss sparad.
    // Vakter: bara ett ÄKTA billigt försök (minst ett osett kort över täckningen
    // — ett ensamt säkert kort läggs fortfarande lågt, hold-up-doktrinen består)
    // och ingen känd renons hos mellanliggande motståndaren (ruffrisk).
    if (side(seat) === side(state.contract.declarer)) {
      const myInLed = legal.filter((c) => c.suit === led)
      const covers = myInLed.filter((c) => rankVal(c.rank) > rankVal(state.currentTrick[0].card.rank))
      if (covers.length > 0) {
        const partner = PARTNER_SEAT[seat]
        const third = PARTNER_SEAT[state.currentTrick[0].seat]
        const ruffRisk =
          state.trump !== null && led !== state.trump && shownVoids(state)[third].has(led)
        const seenLed = new Set<Rank>()
        for (const c of playedCards(state)) if (c.suit === led) seenLed.add(c.rank)
        for (const c of state.hands[seat]) if (c.suit === led) seenLed.add(c.rank)
        for (const c of state.hands[partner]) if (c.suit === led) seenLed.add(c.rank)
        const unseenLed = ALL_RANKS.filter((r) => !seenLed.has(r))
        const cover = lowest(covers)
        const genuineTry = unseenLed.some((r) => rankVal(r) > rankVal(cover.rank))
        const partnerBoss = state.hands[partner].some(
          (c) =>
            c.suit === led &&
            rankVal(c.rank) > rankVal(state.currentTrick[0].card.rank) &&
            unseenLed.every((r) => rankVal(c.rank) > rankVal(r)),
        )
        if (!ruffRisk && genuineTry && partnerBoss) {
          return {
            card: cover,
            reason:
              'Andra hand på spelförarsidan: jag täcker billigt – partnern har ändå boss bakom, ' +
              'så kortet kostar inget men kan vinna sticket gratis och sparar partnerns honnör.',
          }
        }
      }
    }
    const guarded = guardedDiscard(state, seat, legal)
    if (guarded) return { card: guarded, reason: guardReason }
    const lav = signalsOn ? defenderFirstDiscardSignal(state, seat, legal) : null
    if (lav) return lav
    const defGuard = defenderGuardDiscard(state, seat, legal)
    if (defGuard) return { card: defGuard, reason: defenderGuardReason }
    const signal = signalsOn ? defensiveFollowSignal(state, seat, legal) : null
    if (signal) return signal
    return { card: lowAvoidRuff(legal, state.trump), reason: 'Andra hand lågt – jag sparar honnörerna till senare.' }
  }

  // Tredje/fjärde hand: vinn billigast möjligt om något slår, annars kasta lågt.
  const winners = legal.filter((c) => beats(c, bestCard, led, state.trump))
  if (winners.length > 0) {
    // Träkarlen spelar EFTER oss (motspel, tredje hand) → öppen information:
    // "billigast" måste hålla även mot bordets bästa svar, annars går bordets
    // hacka över vår (felrapport #1: V slog ♥3 med ♥4, bordets ♥5 vann).
    // Toppar bordet allt vi har gäller gamla regeln (billigaste vinnaren).
    const iAmDefender = side(seat) !== side(state.contract.declarer)
    const dummy = dummyOf(state.contract)
    const dummyPlaysAfterUs = iAmDefender && !state.currentTrick.some((pc) => pc.seat === dummy)
    if (dummyPlaysAfterUs) {
      const dummyInLed = state.hands[dummy].filter((c) => c.suit === led)
      const dummyLegal = dummyInLed.length > 0 ? dummyInLed : state.hands[dummy]
      const holding = winners.filter((c) => !dummyLegal.some((d) => beats(d, c, led, state.trump)))
      if (holding.length > 0) {
        return {
          card: lowest(holding),
          reason: 'Jag vinner sticket så billigt som möjligt – men högt nog att bordet inte går över.',
        }
      }
    }
    // TREDJE HAND HÖGT (§8.6, felrapport #34): partnern ledde och en DOLD
    // motståndare (spelföraren) spelar EFTER mig. Då duger inte den billigaste
    // vinnaren – han går över den lika billigt (Nord ♥5 → Öst ♥9). Jag pressar
    // fram hans honnör med min LÄGSTA honnör (`thirdHandHonor` – snålar med
    // sekvensen och behåller en gaffel över honom). Bara den DOLDA spelföraren
    // (inte den öppna träkarlen) bakom mig: syns bordet sköts finessvalet av
    // grenen ovan. **Bara i sang** (som spelförarplanen #32): i trumfkontrakt är
    // honnörstvånget osunt – att vinna ett sidostick tidigt sätter försvararen på
    // lead rakt in i spelförarens ruffhand (uppmätt −1 i 5♦, seed 20260761).
    const partnerLed = side(state.currentTrick[0].seat) === side(seat)
    if (state.trump === null && iAmDefender && partnerLed && !dummyPlaysAfterUs && state.currentTrick.length === 2) {
      const honor = thirdHandHonor(winners.filter((c) => c.suit === led))
      if (honor) {
        return {
          card: honor,
          reason:
            'Tredje hand högt (§8.6): partnern ledde och spelföraren spelar efter mig – jag ' +
            'lägger min lägsta honnör och pressar fram hans, i stället för att ge honom ' +
            'sticket billigt med ett spotkort (men slösar aldrig en honnör högre än nödvändigt).',
        }
      }
    }
    // Speldiagnosen S2 (frö 20260730): spelförarsidans tredje hand ser båda
    // händerna och följer FÄRGKOMBINATIONEN (t.ex. damen ur Q753 mot KJ982 —
    // inte "billigaste vinnaren" sjuan) när simuleringen är strikt bättre.
    const combo = declarerThirdHandSuitCard(state, seat, winners, led)
    if (combo) {
      return {
        card: combo,
        reason:
          'Jag ser båda våra händer och spelar färgkombinationen: det här kortet ger flest ' +
          'stick i färgen totalt – att vinna billigast skulle skänka bort en honnör senare.',
      }
    }
    return { card: lowest(winners), reason: 'Jag vinner sticket så billigt som möjligt.' }
  }
  const guarded = guardedDiscard(state, seat, legal)
  if (guarded) return { card: guarded, reason: guardReason }
  const lav = signalsOn ? defenderFirstDiscardSignal(state, seat, legal) : null
  if (lav) return lav
  const defGuard = defenderGuardDiscard(state, seat, legal)
  if (defGuard) return { card: defGuard, reason: defenderGuardReason }
  const signal = signalsOn ? defensiveFollowSignal(state, seat, legal) : null
  if (signal) return signal
  return { card: lowAvoidRuff(legal, state.trump), reason: 'Inget av mina kort vinner sticket – jag kastar lågt.' }
}

/** Väljer ett lagligt kort åt `seat` enligt enkla tumregler. */
export function botCard(state: PlayState, seat: Seat): Card {
  return botCardReasoned(state, seat).card
}

export interface SmartOpts {
  /** Antal Monte-Carlo-sampel per beslut. */
  samples?: number
  /** Nodbudget per DDS-körning (håller webbläsaren responsiv). */
  maxNodes?: number
  /** Max kort kvar i handen för att MC ska köras (annars tumregler). */
  maxCardsForMC?: number
  /** Läs botarnas markeringar in i hand-modellen (markeringar Steg 5). Default på. */
  decodeSignals?: boolean
  /** Slumpkälla för Monte-Carlo-samplingen. Default = Math.random (oförändrat
   *  beteende i appen). Seedas (t.ex. mulberry32) för att återskapa exakt kortval. */
  rng?: () => number
}

/**
 * Adaptiv Monte-Carlo-budget efter hur många kort som är kvar. Uppmätt (riktiga
 * givar, se historiken): DDS-kostnaden växer brant med kortantalet. Ju djupare in
 * i given (färre kort) desto billigare → fler sampel = högre kvalitet. Vid den
 * tänjda kanten (8 kort) skärs sampel/nodbudget ner så en körning stannar run
 * ett par sekunder – acceptabelt eftersom MC nu körs i en webworker (av
 * huvudtråden), aldrig fryser gränssnittet.
 */
export function mcBudget(cardsLeft: number): { samples: number; maxNodes: number } {
  if (cardsLeft <= 6) return { samples: 30, maxNodes: 200_000 }
  if (cardsLeft === 7) return { samples: 24, maxNodes: 150_000 }
  return { samples: 12, maxNodes: 110_000 } // 8 kort (tänjt fönster): bantad budget
}

/**
 * Bottens kortval MED bot-hjärnan (docs/bot-hjarna.md, Steg 3c). Använder
 * Monte-Carlo-DDS (`chooseCardMonteCarlo`) i slutspelet – när given är liten nog
 * att lösas snabbt – och faller annars tillbaka på de ärliga tumreglerna
 * (`botCard`). Hand-modellen seedas ur den verkliga auktionen (`calls`) plus
 * kända renonser från spelet (`shownVoids`). Ingen tjuvkik: modellen och
 * samplingen ser bara ärligt känd information.
 *
 * MC hoppas över (→ tumregler) när:
 *  • det bara finns ett lagligt kort (inget att välja på),
 *  • det är öppningsutspelet (trick 1, motspelet – utspelsdoktrin gäller, §8.3),
 *  • handen är större än `maxCardsForMC` (tidiga, tunga ställningar = för långsamt;
 *    vinsten ligger ändå i slutspelet: stickföring, ingångar, slutkast).
 */
export function botCardSmartReasoned(
  state: PlayState,
  seat: Seat,
  calls: ResolvedCall[] = [],
  opts: SmartOpts = {},
): CardChoice {
  const legal = legalCards(state, seat)
  if (legal.length === 1) return { card: legal[0], reason: 'Bara ett lagligt kort att spela.' }

  const openingLead = state.completedTricks.length === 0 && state.currentTrick.length === 0
  const cardsLeft = state.hands[seat].length
  const maxCards = opts.maxCardsForMC ?? 8
  if (openingLead) {
    // Hål A+G: budstyrt utspel (bara här – botCardReasoned/botCard är budblinda).
    // Bara motspelaren leder ut; och bara när auktionen faktiskt visar någon färg.
    const defender = side(seat) !== side(state.contract.declarer)
    if (defender && calls.length > 0) {
      const info = analyzeAuctionForLead(calls, seat)
      if (info.partnerSuits.length > 0 || info.oppSuits.length > 0) {
        const choice = openingLeadWithAuction(legal, state.trump, info)
        return { card: unblockLead(state, seat, choice.card), reason: choice.reason }
      }
    }
    return botCardReasoned(state, seat)
  }
  if (cardsLeft > maxCards) return botCardReasoned(state, seat)

  const model = buildHandModel(calls, { voids: shownVoids(state) })
  // Signalavkodning (pt 50): skärp modellen med det öppningsutspelet avslöjar
  // (längd + ev. touchérande honnör), sett ur den agerande platsens synvinkel.
  applyOpeningLeadSignal(model, state, seat, { budstyrt: budstyrtOpeningLead(state, calls) })
  // Markeringar Steg 5: läs botarnas attitydmarkeringar under spelets gång.
  if (opts.decodeSignals !== false) applySignalReads(model, state, seat)
  const budget = mcBudget(cardsLeft)
  const choice = chooseCardMonteCarlo(state, seat, model, {
    samples: opts.samples ?? budget.samples,
    maxNodes: opts.maxNodes ?? budget.maxNodes,
    rng: opts.rng,
  })
  if (!choice) return botCardReasoned(state, seat)
  // Avblockning gäller även bot-hjärnans val: på lead får ett stickekvivalent
  // DDS-kort aldrig krossa en synlig singel-honnör hos medspelaren (felrapport #17).
  const card = state.currentTrick.length === 0 ? unblockLead(state, seat, choice.card) : choice.card
  return {
    card,
    reason:
      `Bot-hjärnan tänkte som en expert: jag delade ut ${choice.samples} troliga lägen (utifrån ` +
      `budgivningen och korten som fallit) och spelade igenom dem – det här kortet gav flest stick i snitt.`,
  }
}

/**
 * Sant om `botCardSmartReasoned` skulle köra Monte-Carlo (tung, sekunder) för det
 * här läget – i motsats till en direkt tumregel (öppningsutspel / ett lagligt kort
 * / över MC-fönstret). Gränssnittet använder detta för att avgöra om draget ska
 * räknas i en webworker (av huvudtråden) med en "tänker …"-indikator.
 */
export function usesMonteCarlo(state: PlayState, seat: Seat, opts: SmartOpts = {}): boolean {
  if (legalCards(state, seat).length <= 1) return false
  const openingLead = state.completedTricks.length === 0 && state.currentTrick.length === 0
  const maxCards = opts.maxCardsForMC ?? 8
  return !openingLead && state.hands[seat].length <= maxCards
}

/** Bottens kortval MED bot-hjärnan (docs/bot-hjarna.md, Steg 3c). Se `botCardSmartReasoned`. */
export function botCardSmart(
  state: PlayState,
  seat: Seat,
  calls: ResolvedCall[] = [],
  opts: SmartOpts = {},
): Card {
  return botCardSmartReasoned(state, seat, calls, opts).card
}
