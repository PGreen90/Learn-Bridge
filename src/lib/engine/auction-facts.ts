// FAKTALAGRET (motorbytet etapp 2, docs/motorbyte-plan.md §2 steg 2).
//
// Ur betydelserna och buden räknas AUKTIONSLÄGET en gång per beslut: öppning
// och roller (öppnare/svarare/inklivare/advancer), vilka kontraktsbud var sida
// gjort, senaste bud, utpassningssitsen, passad hand, partnerns senast visade
// färg, överenskommen trumf, kravläget, det fria budet och den starka
// dubblingens läge. Lagret läser BARA auktionen — aldrig en hand — så
// kikvakten (`kikvakt.test.ts`) kan låsa det.
//
// Etapp 2 flyttade hjälparna hit ORDAGRANT från `auction-live.ts`
// (`openingBid`, `partnerLastSuit`, `opponentsHaveBid`, `opponentsBidStrain`,
// `agreedTrump`, `jacobyFitTrump`, `auctionForce`/`competitionForce`,
// `freeBidContext`, `strongDoubleContext`): inget bud ändras, bara var
// sanningen räknas. Detektorerna får fakta via `DetectorCtx.facts` i stället
// för att skanna `history` om och om igen. Beslutstabellen (etapp 3,
// `auction-decide.ts`) läser samma fakta.
//
// Facit: `auction-facts.test.ts`. Domare vid varje flytt: auktionsdiffen
// (`scripts/auktionsdiff.mjs`, kommandot i planen §3) ska visa noll ändrade bud.

import type { Bid, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { meaningOf, type Meaning } from './auction-meaning'
import { side } from './play'

// ---- Bud-tolkning (delas med auction-live.ts) --------------------------------

export const PARTNER: Record<Seat, Seat> = { N: 'S', S: 'N', E: 'W', W: 'E' }
export const SUIT_OF_LETTER: Record<string, Suit> = { C: 'clubs', D: 'diamonds', H: 'hearts', S: 'spades' }
export const SUIT_STRAINS = ['C', 'D', 'H', 'S'] as const
export const STRAINS = ['C', 'D', 'H', 'S', 'NT'] as const

const CONTRACT_BID = /^([1-7])(C|D|H|S|NT)$/

/** Ett kontraktsbud (nivå + färg) tolkat, eller null för P/X/XX. */
export function parseContractBid(bid: Bid): { level: number; strain: string } | null {
  const m = CONTRACT_BID.exec(bid)
  return m ? { level: Number(m[1]), strain: m[2] } : null
}

/** Rang inom en färg (C<D<H<S) – skiljer ett 2/1 från ett hoppskift/reverse. */
export function strainRank(strain: string): number {
  return SUIT_STRAINS.indexOf(strain as (typeof SUIT_STRAINS)[number])
}

/** Är budet minst utgång (3NT, 4 i högfärg, 5 i lågfärg, eller slam)? */
export function isGameOrHigher(bid: Bid): boolean {
  const cb = parseContractBid(bid)
  if (!cb) return false
  if (cb.strain === 'NT') return cb.level >= 3
  if (cb.strain === 'H' || cb.strain === 'S') return cb.level >= 4
  return cb.level >= 5 // lågfärg
}

// ---- Faktaobjektet -----------------------------------------------------------

/** Stolens roll i auktionen, sedd ur vem som öppnade. */
export type Role = 'öppnare' | 'svarare' | 'inklivare' | 'advancer'

export interface OpeningFact {
  seat: Seat
  level: number
  strain: string
  /** Plats i `history`. */
  index: number
}

export interface Force {
  kind: 'round' | 'game'
}

export interface FreeBidFact {
  opener: Seat
  responder: Seat
  free: { strain: string; level: number }
  /** Auktionens kontraktsbud i ordning (öppning, inkliv, fritt bud, …). */
  contracts: ResolvedCall[]
}

export interface StrongDoubleFact {
  role: 'doubler' | 'advancer'
  doubler: Seat
  advancer: Seat
  openStrain: string
  theirSuits: Set<Suit>
  /** Det starka återbudets färg (dubblarens första egna färg efter X). */
  doublerSuit: Suit
  /** Dubblarens kontraktsbud EFTER X, i ordning (återbud, ev. andra återbud). */
  doublerBids: { level: number; strain: string }[]
  /** Advancerns kontraktsbud, i ordning (tvångssvar, ev. svar på återbudet). */
  advancerBids: { level: number; strain: string }[]
}

/**
 * Auktionsläget sett från `seat`, räknat EN gång per beslut ur auktionen ensam.
 * Allt här är härlett ur `history` — inget fält får bero på en hand.
 */
export interface AuctionFacts {
  history: ResolvedCall[]
  seat: Seat
  partner: Seat

  /** Auktionens kontraktsbud i ordning (pass/X/XX bortfiltrerade). */
  contractBids: ResolvedCall[]
  /** Vår sidas resp. motståndarnas kontraktsbud, i ordning. */
  ourContractBids: ResolvedCall[]
  theirContractBids: ResolvedCall[]
  /** Färger (bokstav, inkl. 'NT') som vår sida resp. motståndarna bjudit som kontraktsbud. */
  ourStrains: Set<string>
  theirStrains: Set<string>
  /** Har motståndarsidan gjort ett kontraktsbud? (konkurrens) */
  opponentsHaveBid: boolean

  /** Öppningen (första kontraktsbudet), eller null när inget bjudits. */
  opening: OpeningFact | null
  weOpened: boolean
  opener: Seat | null
  responder: Seat | null
  /** Stolens roll, eller null innan någon öppnat. */
  role: Role | null
  /** Passad hand per stol: stolens FÖRSTA bud i auktionen var pass. */
  passedHand: Record<Seat, boolean>

  /** Senaste icke-pass i auktionen (bud, X eller XX), eller null. */
  lastNonPass: ResolvedCall | null
  /** Senaste kontraktsbudet, eller null. */
  lastContract: ResolvedCall | null
  /** Bara pass sedan senaste kontraktsbudet (inga X/XX)? Falskt utan kontraktsbud. */
  quietSinceLastContract: boolean
  /** Utpassningssitsen: två pass ligger på ett bud, så mitt pass avslutar auktionen. */
  passOut: boolean

  /** Partnerns senast visade naturliga färg (med nivån), eller null. */
  partnerLastSuit: { strain: string; level: number } | null
  /** Parets överenskomna trumf: en färg BÅDA bjudit (senast bjudna om flera). */
  agreedTrump: Suit | null
  /** Högfärgsfit satt av Jacoby 2NT / Jordan 2NT (konstgjort, syns inte i `agreedTrump`). */
  jacobyTrump: Suit | null
  /** Är vår sida i krav just nu (rond/utgång), läst ur de spelade buden? */
  force: Force | null
  /** Läget kring svararens FRIA BUD (§5.5, felrapport #55), eller null. */
  freeBid: FreeBidFact | null
  /** Läget i en "stark upplysningsdubbling"-auktion (X + egen färg), eller null. */
  strongDouble: StrongDoubleFact | null

  /** Systembetydelsen (betydelselagret) för bud nr `index` — memoiserad. */
  meaning: (index: number) => Meaning
}

export function auctionFacts(history: ResolvedCall[], seat: Seat): AuctionFacts {
  const partner = PARTNER[seat]
  const contractBids = history.filter((c) => parseContractBid(c.bid))
  const ourContractBids = contractBids.filter((c) => side(c.seat) === side(seat))
  const theirContractBids = contractBids.filter((c) => side(c.seat) !== side(seat))
  const ourStrains = new Set(ourContractBids.map((c) => parseContractBid(c.bid)!.strain))
  const theirStrains = new Set(theirContractBids.map((c) => parseContractBid(c.bid)!.strain))

  const opening = openingBid(history)
  const weOpened = !!opening && side(opening.seat) === side(seat)
  const opener = opening ? opening.seat : null
  const responder = opening ? PARTNER[opening.seat] : null

  let role: Role | null = null
  if (opening) {
    if (weOpened) {
      role = seat === opening.seat ? 'öppnare' : 'svarare'
    } else {
      // Motståndarsidans första icke-pass (inkliv eller X) är inklivaren; har
      // ingen på vår sida agerat än är det jag (i tur) som är den.
      const first = history.find((c) => side(c.seat) === side(seat) && c.bid !== 'P')
      role = !first || first.seat === seat ? 'inklivare' : 'advancer'
    }
  }

  const passedHand = { N: false, E: false, S: false, W: false } as Record<Seat, boolean>
  for (const s of ['N', 'E', 'S', 'W'] as Seat[]) {
    const first = history.find((c) => c.seat === s)
    passedHand[s] = !!first && first.bid === 'P'
  }

  let lastNonPass: ResolvedCall | null = null
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].bid !== 'P') { lastNonPass = history[i]; break }
  }
  const lastContract = contractBids.length > 0 ? contractBids[contractBids.length - 1] : null
  const quietSinceLastContract =
    !!lastContract && history.slice(history.indexOf(lastContract) + 1).every((c) => c.bid === 'P')
  const n = history.length
  const passOut = !!lastNonPass && n >= 2 && history[n - 1].bid === 'P' && history[n - 2].bid === 'P'

  const meanings: (Meaning | undefined)[] = []
  const meaning = (index: number): Meaning => (meanings[index] ??= meaningOf(history, index))

  return {
    history,
    seat,
    partner,
    contractBids,
    ourContractBids,
    theirContractBids,
    ourStrains,
    theirStrains,
    opponentsHaveBid: theirContractBids.length > 0,
    opening,
    weOpened,
    opener,
    responder,
    role,
    passedHand,
    lastNonPass,
    lastContract,
    quietSinceLastContract,
    passOut,
    partnerLastSuit: partnerLastSuit(history, seat),
    agreedTrump: agreedTrump(history, seat),
    jacobyTrump: jacobyFitTrump(history, seat),
    force: auctionForce(history, seat),
    freeBid: freeBidContext(history, seat),
    strongDouble: strongDoubleContext(history, seat),
    meaning,
  }
}

// ---- Hjälparna (flyttade ordagrant från auction-live.ts, etapp 2) -----------

/** Första kontraktsbudet i historiken (öppningen), eller null om inget bjudits. */
export function openingBid(history: ResolvedCall[]): OpeningFact | null {
  for (const [index, c] of history.entries()) {
    const cb = parseContractBid(c.bid)
    if (cb) return { seat: c.seat, level: cb.level, strain: cb.strain, index }
  }
  return null
}

/**
 * Partnerns SENAST visade naturliga färg (med nivån hen bjöd den på), läst ur
 * historiken. En cue i motståndarnas färg räknas inte som en egen färg, och
 * sang räknas inte som färg. Returnerar null om partnern inte visat någon färg.
 */
export function partnerLastSuit(history: ResolvedCall[], seat: Seat): { strain: string; level: number } | null {
  let found: { strain: string; level: number } | null = null
  for (const [idx, c] of history.entries()) {
    if (c.seat !== PARTNER[seat]) continue
    const cb = parseContractBid(c.bid)
    if (!cb || cb.strain === 'NT') continue
    // Cue i motståndarnas färg är ingen egen färg att stödja.
    const isTheirSuit = history.some((x) => {
      const xb = parseContractBid(x.bid)
      return xb && xb.strain === cb.strain && side(x.seat) !== side(seat)
    })
    if (isTheirSuit) continue
    // Konstgjorda sang-svar är ingen färg: 2♣/3♣ (Stayman) och 2♦/2♥ resp.
    // 3♦/3♥ (överföringar) direkt över egen sidas 1NT/2NT lovar INTE färgen —
    // 5♣-ryckaren (fel färg-spåret fix 1) uppstod när Stayman-2♣ lästes som
    // klöver och "höjdes" till 5♣ över partnerns färdiga 3NT.
    if (isArtificialNTResponse(history, idx)) continue
    found = { strain: cb.strain, level: cb.level }
  }
  return found
}

/**
 * Är budet på plats `idx` ett KONSTGJORT svar på egen sidas sangbud (Stayman
 * 2♣/3♣ eller överföring 2♦/2♥/3♦/3♥)? Sant när närmast föregående
 * kontraktsbud är 1NT/2NT från SAMMA sida och budet ligger exakt en nivå upp
 * i klöver/ruter/hjärter (systemets sangkonventioner, systems on efter 2♣).
 */
export function isArtificialNTResponse(history: ResolvedCall[], idx: number): boolean {
  const cb = parseContractBid(history[idx].bid)
  if (!cb || !['C', 'D', 'H'].includes(cb.strain)) return false
  for (let i = idx - 1; i >= 0; i--) {
    const prev = parseContractBid(history[i].bid)
    if (!prev) continue
    return (
      prev.strain === 'NT' &&
      prev.level <= 2 &&
      cb.level === prev.level + 1 &&
      side(history[i].seat) === side(history[idx].seat)
    )
  }
  return false
}

/** Har motståndarsidan (sett från `seat`) gjort ett kontraktsbud? (konkurrens) */
export function opponentsHaveBid(history: ResolvedCall[], seat: Seat): boolean {
  return history.some((c) => side(c.seat) !== side(seat) && parseContractBid(c.bid))
}

/** Har motståndarsidan bjudit `strain` som kontraktsbud? (då är det inte en egen färg) */
export function opponentsBidStrain(history: ResolvedCall[], seat: Seat, strain: string): boolean {
  return history.some((c) => {
    const cb = parseContractBid(c.bid)
    return cb && cb.strain === strain && side(c.seat) !== side(seat)
  })
}

/**
 * Parets ÖVERENSKOMNA trumf: en färg BÅDA parterna bjudit som kontraktsbud
 * (senast bjudna om flera). null när ingen fit är överenskommen.
 */
export function agreedTrump(history: ResolvedCall[], seat: Seat): Suit | null {
  const strainsOf = (s: Seat) =>
    new Set(
      history
        .filter((c) => c.seat === s)
        .map((c) => parseContractBid(c.bid)?.strain)
        .filter((st): st is string => !!st && st !== 'NT'),
    )
  const mine = strainsOf(seat)
  const partners = strainsOf(PARTNER[seat])
  const agreed = [...mine].filter((st) => partners.has(st))
  if (agreed.length === 0) return null
  for (let i = history.length - 1; i >= 0; i--) {
    const cb = parseContractBid(history[i].bid)
    if (cb && agreed.includes(cb.strain)) return SUIT_OF_LETTER[cb.strain]
  }
  return SUIT_OF_LETTER[agreed[0]]
}

/**
 * Har vår sida etablerat en HÖGFÄRGS-fit via **Jacoby 2NT** (systembok §4.1)?
 * Mönstret: vår sidas 1♥/1♠-öppning, och svararens (partnern till öppnaren)
 * FÖRSTA bud efter öppningen är **2NT** – i 2/1 är direkt 2NT över 1M alltid
 * Jacoby (utgångskravande högfärgshöjning). Även 1M–(X)–2NT (Jordan) sätter
 * majoren som fit. Trumfen är då öppnarens högfärg, även om ingen bjudit den som
 * ett naturligt FÄRGbud (2NT är konstgjort) – därför missar `agreedTrump` den.
 * Returnerar högfärgen, annars null. Ett motståndar-KONTRAKTsbud mellan
 * öppningen och 2NT betyder att 2NT är något annat → null.
 */
export function jacobyFitTrump(history: ResolvedCall[], seat: Seat): Suit | null {
  const open = openingBid(history)
  if (!open || side(open.seat) !== side(seat) || open.level !== 1) return null
  const major = SUIT_OF_LETTER[open.strain]
  if (major !== 'hearts' && major !== 'spades') return null
  const openIdx = history.findIndex((c) => parseContractBid(c.bid))
  // Första KONTRAKTsbudet efter öppningen (pass/X/XX hoppas över).
  for (let i = openIdx + 1; i < history.length; i++) {
    if (!parseContractBid(history[i].bid)) continue
    if (side(history[i].seat) !== side(seat)) return null // motståndarna bjöd → ej Jacoby
    if (history[i].seat === open.seat) return null // öppnarens eget bud, inte svararens svar
    return history[i].bid === '2NT' ? major : null // svararens första svar
  }
  return null
}

// ---- Kravläget: "är vi i krav?" (grunden bakom "krav får aldrig passas") ----
//
// Off-book-lagret hade förut inget minne av auktionens tillstånd: varje bud
// avgjordes från den egna handens poäng, och säkert standardval var pass. Krav
// låg bara UNDERFÖRSTÅTT i den kanoniska linjen, så varje ny kravsituation
// krävde en egen detektor (en per felrapport). `auctionForce` läser i stället
// kravet direkt ur de SPELADE buden, så "passa aldrig ett krav" blir EN regel.

/**
 * Är VÅR sida i krav just nu (och av vilket slag), läst ur de SPELADE buden?
 * STEG 1 (grunder) täcker bara OSTÖRDA auktioner (motståndarna har inte gjort
 * något kontraktsbud) och tre klassiska krav – annars null:
 *   - 'game':  ett 2-över-1-svar har etablerat utgångskrav och utgång är EJ nådd.
 *   - 'round': ett OBESVARAT rondkrav ligger på bordet och det är vår tur att
 *      svara det – (a) partnerns nya färg (öppnaren måste rebjuda) eller
 *      (b) öppnarens reverse (svararen måste svara).
 * Konkurrens och fler kravtyper (fjärde färg, hoppskift, slamkrav) ligger utanför
 * steg 1 med flit – de täcks redan av egna detektorer eller tas i senare steg.
 */
export function auctionForce(history: ResolvedCall[], seat: Seat): Force | null {
  const contractBids = history.filter((c) => parseContractBid(c.bid))
  if (contractBids.length < 2) return null // öppning + minst ett svar krävs
  // Störd budgivning har EGEN kravsemantik (ett inkliv "lånar" utrymme → ett 2/1
  // lovar värden men ej garanterad utgång). Egen gren; koden nedan är OSTÖRT.
  if (contractBids.some((c) => side(c.seat) !== side(seat))) {
    return competitionForce(history, seat, contractBids)
  }

  const opener = contractBids[0].seat
  const open = parseContractBid(contractBids[0].bid)!
  const responderSeat = PARTNER[opener]
  const openerBids = contractBids.filter((c) => c.seat === opener)
  const responderBids = contractBids.filter((c) => c.seat === responderSeat)
  const firstResp = responderBids[0] ? parseContractBid(responderBids[0].bid)! : null

  // Passade svararen INNAN sitt första bud? Då är ett 2/1 inte utgångskrav.
  const responderPassedFirst =
    !!responderBids[0] &&
    history
      .slice(0, history.indexOf(responderBids[0]))
      .some((c) => c.seat === responderSeat && c.bid === 'P')

  const highest = contractBids[contractBids.length - 1]
  const gameReached = isGameOrHigher(highest.bid)

  // ---- Stark 2♣-öppning = utgångskrav (tills utgång nåtts) ----
  // 2♣ är ovillkorligt game-krav: auktionen får aldrig dö i delkontrakt. Enda
  // undantaget (som i standard 2/1): 2♣–2♦–2NT — öppnarens 22–24 balanserade
  // återbud är INBJUDANDE, inte krav, så svararen får passa. `buildAuction`
  // bygger bara ett par bud av 2♣-linjen och lämnar över resten hit; utan denna
  // gren spårades kravet aldrig och ~64 % av alla 2♣ dog under utgång.
  if (open.level === 2 && open.strain === 'C') {
    const openerRebid = openerBids[1] ? parseContractBid(openerBids[1].bid) : null
    const twoNoTrumpRebid = openerRebid?.level === 2 && openerRebid.strain === 'NT'
    if (twoNoTrumpRebid || gameReached) return null // inbjudan (2♦–2NT) eller redan i utgång
    return { kind: 'game' }
  }

  // ---- 2/1 = utgångskrav (gäller tills utgång nåtts, även mitt i sekvensen) ----
  const isTwoOverOne =
    !!firstResp &&
    open.level === 1 && open.strain !== 'NT' &&
    firstResp.level === 2 && firstResp.strain !== 'NT' &&
    strainRank(firstResp.strain) < strainRank(open.strain) &&
    !responderPassedFirst
  if (isTwoOverOne && !gameReached) return { kind: 'game' }

  // ---- Obesvarat rondkrav: bara pass efter vår sidas senaste kontraktsbud ----
  const onlyPassAfter = history
    .slice(history.indexOf(highest) + 1)
    .every((c) => c.bid === 'P')
  if (!onlyPassAfter) return null

  // (a) Partnerns NYA färg → öppnaren måste rebjuda (rondkrav). En färg som
  // ÖPPNAREN redan bjudit är en HÖJNING (ingen ny färg), och ett bud på
  // utgångsnivå lämnar inget rondkrav hängande (fix 6, frö 20261112: svararens
  // 4♥ i öppnarens hjärter lästes som ny färg → öppnaren "tvingades" dra
  // partnerns utgång till 5♦ bet).
  if (seat === opener && highest.seat === responderSeat && !isGameOrHigher(highest.bid as Bid)) {
    const bid = parseContractBid(highest.bid)!
    const responderTimesInSuit = responderBids.filter(
      (c) => parseContractBid(c.bid)!.strain === bid.strain,
    ).length
    const openerBidSuit = openerBids.some((c) => parseContractBid(c.bid)!.strain === bid.strain)
    const isNewSuit =
      bid.strain !== 'NT' && bid.strain !== open.strain && responderTimesInSuit === 1 && !openerBidSuit
    // Undantag (felrapport #59, §5.1): svararens EGEN färg på 2-läget efter
    // sitt 1NT-svar (1M–1NT–2x–2y) är till spel — svag hand, 5+ kort, inget
    // stöd. Utan undantaget "tvingades" öppnaren rebjuda sin högfärg (2♠ på
    // en 5-1-fit) fast partnern bad om att få spela 2♦.
    const openerRebid = openerBids[1] ? parseContractBid(openerBids[1].bid) : null
    const ownSuitAfterOwn1NT =
      open.level === 1 && (open.strain === 'H' || open.strain === 'S') &&
      firstResp?.level === 1 && firstResp.strain === 'NT' &&
      responderBids.length === 2 && openerBids.length === 2 &&
      !!openerRebid && openerRebid.level === 2 && openerRebid.strain !== 'NT' && openerRebid.strain !== open.strain &&
      bid.level === 2
    if (isNewSuit && !ownSuitAfterOwn1NT) return { kind: 'round' }
  }

  // (b) Öppnarens REVERSE → svararen måste svara (rondkrav).
  if (seat === responderSeat && highest.seat === opener && openerBids.length >= 2 && firstResp?.level === 1) {
    const first = parseContractBid(openerBids[0].bid)!
    const second = parseContractBid(highest.bid)!
    const isReverse =
      second.level === 2 && second.strain !== 'NT' &&
      second.strain !== first.strain &&
      strainRank(second.strain) > strainRank(first.strain)
    if (isReverse) return { kind: 'round' }
  }

  return null
}

/**
 * Är VÅR sida i krav i en STÖRD auktion (motståndarna har klivit in)?
 * Ägarbeslut 2026-07-05: ett inkliv "lånar" utrymme, så ett fritt 2-över-1 lovar
 * värden men INTE garanterad utgång. Därför finns bara RONDKRAV här (aldrig
 * 'game'): partnern får inte passa, men budgivningen får stanna UNDER utgång.
 * Två klassiska krav honoreras — och bara när VÅR sida öppnade:
 *   (a) svararens FRIA nya färg (ej hopp, ej cue i deras färg) → öppnaren måste
 *       rebjuda,
 *   (b) öppnarens REVERSE → svararen måste svara.
 * Allt annat (deras öppning + våra inkliv, sang-öppning, hopp, passad svarare) →
 * null. Störd semantik skiljer sig alltså från ostört: inget game-krav här.
 */
function competitionForce(
  history: ResolvedCall[],
  seat: Seat,
  contractBids: ResolvedCall[],
): { kind: 'round' } | null {
  const first = contractBids[0]
  if (side(first.seat) !== side(seat)) return null // VÅR sida måste ha öppnat
  const open = parseContractBid(first.bid)!
  if (open.strain === 'NT') return null // sang-öppning: annan struktur
  const opener = first.seat
  const responderSeat = PARTNER[opener]

  // Ett OBESVARAT krav: senaste kontraktsbudet är VÅRT och bara pass har följt.
  const highest = contractBids[contractBids.length - 1]
  if (side(highest.seat) !== side(seat)) return null
  const highestIdx = history.indexOf(highest)
  if (history.slice(highestIdx + 1).some((c) => c.bid !== 'P')) return null

  const openerBids = contractBids.filter((c) => c.seat === opener)
  const responderBids = contractBids.filter((c) => c.seat === responderSeat)
  const oppStrains = new Set(
    contractBids
      .filter((c) => side(c.seat) !== side(seat))
      .map((c) => parseContractBid(c.bid)!.strain),
  )
  // Passad svarare skapar inget krav: en ny färg efter en inledande pass är fri
  // men icke-krav (svararen är redan begränsad).
  const responderPassedFirst =
    !!responderBids[0] &&
    history
      .slice(0, history.indexOf(responderBids[0]))
      .some((c) => c.seat === responderSeat && c.bid === 'P')

  // (a) Svararens FRIA nya färg → öppnaren måste rebjuda. UNDANTAG (fix 5b):
  // dubblade svararen tidigare (negativ dubbling) är den senare färgen
  // DUBBLARENS OMBUD — X + egen färg är svagare än att bjuda färgen direkt
  // (invit, ej krav), så öppnaren får passa på minimum (frö 20261179: 2♥ efter
  // X ska stå, inte tvinga fram ett 2♠-rebud).
  const responderDoubledEarlier = history.some(
    (c, i) => i < highestIdx && c.seat === responderSeat && c.bid === 'X',
  )
  if (
    seat === opener && highest.seat === responderSeat && !responderPassedFirst &&
    !responderDoubledEarlier && !isGameOrHigher(highest.bid as Bid) // utgång = inget hängande rondkrav (fix 6)
  ) {
    const bid = parseContractBid(highest.bid)!
    const timesInStrain = responderBids.filter(
      (c) => parseContractBid(c.bid)!.strain === bid.strain,
    ).length
    const isNewSuit =
      bid.strain !== 'NT' &&
      bid.strain !== open.strain &&
      timesInStrain === 1 &&
      !oppStrains.has(bid.strain) && // ett cue i deras färg är en höjning, ej ny färg
      !openerBids.some((c) => parseContractBid(c.bid)!.strain === bid.strain) // öppnarens färg = höjning (fix 6)
    if (isNewSuit && !isJumpBid(history, highestIdx)) return { kind: 'round' }
  }

  // (b) Öppnarens REVERSE → svararen måste svara.
  if (seat === responderSeat && highest.seat === opener && openerBids.length >= 2) {
    const firstOpen = parseContractBid(openerBids[0].bid)!
    const second = parseContractBid(highest.bid)!
    const firstResp = responderBids[0] ? parseContractBid(responderBids[0].bid)! : null
    const isReverse =
      firstResp?.level === 1 &&
      second.level === 2 && second.strain !== 'NT' &&
      second.strain !== firstOpen.strain &&
      second.strain !== firstResp.strain && // öppnarens HÖJNING av svararens färg är ingen reverse (felrapport #55)
      strainRank(second.strain) > strainRank(firstOpen.strain)
    if (isReverse) return { kind: 'round' }
  }

  return null
}

/**
 * Är kontraktsbudet vid `idx` ett HOPP (högre nivå än billigaste möjliga för dess
 * färg givet auktionen dittills)? Ett fritt icke-hopp är entydigt krav; ett hopp
 * i konkurrens kan vara svagt/spärrartat (systemberoende) → honoreras ej som krav.
 */
export function isJumpBid(history: ResolvedCall[], idx: number): boolean {
  const cb = parseContractBid(history[idx].bid)
  if (!cb) return false
  let prevLevel = 0
  let prevRank = -1
  for (let i = 0; i < idx; i++) {
    const p = parseContractBid(history[i].bid)
    if (!p) continue
    prevLevel = p.level
    prevRank = p.strain === 'NT' ? SUIT_STRAINS.length : strainRank(p.strain)
  }
  const targetRank = cb.strain === 'NT' ? SUIT_STRAINS.length : strainRank(cb.strain)
  const minLevel = targetRank > prevRank ? prevLevel : prevLevel + 1
  return cb.level > minLevel
}

/**
 * Felrapport #55: läget kring partnerns/mitt FRIA BUD (§5.5) — svararens nya
 * färg (ej hopp, ej cue, ej sang) direkt över motståndarnas färginkliv på vår
 * 1-lägesöppning, som svararens första aktion. Sett från `seat` (öppnare eller
 * svarare). `contracts` = auktionens kontraktsbud i ordning (öppning, inkliv,
 * fritt bud, …). null när mönstret inte stämmer.
 */
export function freeBidContext(history: ResolvedCall[], seat: Seat): FreeBidFact | null {
  const open = openingBid(history)
  if (!open || open.level !== 1 || open.strain === 'NT' || side(open.seat) !== side(seat)) return null
  const contracts = history.filter((c) => parseContractBid(c.bid))
  if (contracts.length < 3) return null
  const [, ov, free] = contracts
  if (side(ov.seat) === side(seat)) return null
  const ovb = parseContractBid(ov.bid)!
  if (ovb.strain === 'NT') return null
  const responder = PARTNER[open.seat]
  if (free.seat !== responder) return null
  const fb = parseContractBid(free.bid)!
  if (fb.strain === 'NT' || fb.strain === open.strain || fb.strain === ovb.strain) return null
  const cheapest = ovb.level + (SUIT_STRAINS.indexOf(fb.strain as 'C') > SUIT_STRAINS.indexOf(ovb.strain as 'C') ? 0 : 1)
  if (fb.level !== cheapest) return null // ett hopp är inget fritt bud
  const responderActions = history.filter((c) => c.seat === responder && c.bid !== 'P')
  if (responderActions[0] !== free) return null // t.ex. X först → inte ett fritt bud
  return { opener: open.seat, responder, free: fb, contracts }
}

/**
 * Läser en "stark upplysningsdubbling"-auktion sett från `seat`: motståndarna
 * öppnade 1 i färg, vår sida dubblade (takeout) och dubblaren har sedan
 * "överröstat" partnern med en EGEN objuden färg (det starka återbudet). Returnerar
 * rollerna + budhistoriken, eller null om mönstret inte gäller ännu.
 */
export function strongDoubleContext(history: ResolvedCall[], seat: Seat): StrongDoubleFact | null {
  const open = openingBid(history)
  if (!open || side(open.seat) === side(seat) || open.level !== 1) return null

  // Vem på vår sida dubblade? Dubblarens FÖRSTA icke-pass-bud måste vara X.
  // Har BÅDA i paret X som första bud (upplysnings-X följd av partnerns
  // RESPONSIVA X, felrapport #35) är det den FÖRSTA dubblingen i tid som är
  // upplysningsdubblingen — den senare är responsiv och får inte utse en
  // "stark dubblare" vars fitvisande höjning sedan läses som starkt återbud.
  let doubler: Seat | null = null
  let doublerIdx = Number.POSITIVE_INFINITY
  for (const s of [seat, PARTNER[seat]] as Seat[]) {
    const idx = history.findIndex((c) => c.seat === s && c.bid !== 'P')
    if (idx !== -1 && history[idx].bid === 'X' && idx < doublerIdx) {
      doubler = s
      doublerIdx = idx
    }
  }
  if (!doubler) return null
  const advancer = PARTNER[doubler]

  // Motståndarnas färger + dubblarens/advancerns kontraktsbud i ordning.
  const theirSuits = new Set<Suit>()
  for (const c of history) {
    const cb = parseContractBid(c.bid)
    if (cb && side(c.seat) !== side(seat)) {
      const s = SUIT_OF_LETTER[cb.strain]
      if (s) theirSuits.add(s)
    }
  }
  const contractBidsOf = (s: Seat) =>
    history.filter((c) => c.seat === s).map((c) => parseContractBid(c.bid)).filter((b): b is { level: number; strain: string } => b !== null)
  const doublerBids = contractBidsOf(doubler)
  const advancerBids = contractBidsOf(advancer)

  // Dubblaren måste ha gjort sitt starka återbud (bjudit en egen OBJUDEN färg).
  if (doublerBids.length < 1) return null
  const doublerSuit = SUIT_OF_LETTER[doublerBids[0].strain]
  if (!doublerSuit || theirSuits.has(doublerSuit)) return null
  // … och en HÖJNING av en färg advancern själv bjudit FÖRE dubblarens bud är
  // inget starkt återbud (etapp 6 hål 2: dubblarens invithöjning av det fria
  // svaret lästes som "X + egen färg" → advancern blastade utgång på 8 hp).
  const doublerFirstIdx = history.findIndex((c) => c.seat === doubler && parseContractBid(c.bid))
  const advancerBidItFirst = history.some(
    (c, i) => i < doublerFirstIdx && c.seat === advancer && parseContractBid(c.bid)?.strain === doublerBids[0].strain,
  )
  if (advancerBidItFirst) return null

  return {
    role: seat === doubler ? 'doubler' : 'advancer',
    doubler, advancer, openStrain: open.strain, theirSuits, doublerSuit, doublerBids, advancerBids,
  }
}
