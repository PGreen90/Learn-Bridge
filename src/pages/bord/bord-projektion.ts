// Beslut B etapp 4 (4B) — klientens projektion av bordets händelselogg.
//
// REN modul: händelser in → spelläge ut. Klienten är en PROJEKTOR av serverns
// logg — den driver inga bottar och fattar inga spelbeslut. Med dolda händer
// kan den inte heller köra motorns playCard (som kräver alla fyra händerna);
// i stället byggs sticken direkt ur korthändelserna med motorns rena
// stickvinnar-logik (currentWinner) — trumf och utspelsfärg avgör, inga händer
// behövs.
//
// DEN VISUELLA VRIDNINGEN: varje spelare ser sig själv nertill (Syd), precis
// som vid ett riktigt bord. Motorns/serverns värld är alltid de VERKLIGA
// stolarna — vridningen är enbart en renderingsfråga och sker här, i ett steg,
// innan datat når presentationskomponenterna (samma matematik som useGames
// seatDealSouth: cyklisk rotation, udda rotation speglar NS/ÖV-zonen).
// Korten själva vrids aldrig — ett drag skickas till servern som det är.

import type { Card, Seat, Vulnerability } from '../../types/bridge'
import type { ResolvedCall } from '../../lib/bidding'
import type { BordHandelse } from '../../lib/backend/bord'
import { auctionComplete, contractFromCalls, seatToAct } from '../../lib/engine/auction-live'
import { interpretCall } from '../../lib/engine/auction-interpret'
import {
  currentWinner,
  NEXT_SEAT,
  dummyOf,
  side,
  type Contract,
  type PlayedCard,
  type PlayState,
  type Trick,
} from '../../lib/engine/play'

const SEAT_ORDER: Seat[] = ['N', 'E', 'S', 'W']

// ---------------------------------------------------------------------------
// Vridningen.

/** Verklig stol → visuell stol, så att `minStol` hamnar i Syd. */
export function vridStol(minStol: Seat): (verklig: Seat) => Seat {
  const shift = (2 - SEAT_ORDER.indexOf(minStol) + 4) % 4
  return (s) => SEAT_ORDER[(SEAT_ORDER.indexOf(s) + shift) % 4]
}

/** Visuell stol → verklig stol (för namnskyltarna: vem sitter var). */
export function vridTillbaka(minStol: Seat): (visuell: Seat) => Seat {
  const shift = (2 - SEAT_ORDER.indexOf(minStol) + 4) % 4
  return (s) => SEAT_ORDER[(SEAT_ORDER.indexOf(s) - shift + 4) % 4]
}

/** Zonen i den vridna världen: udda rotation byter partnerskapens platser. */
export function vridZon(minStol: Seat, v: Vulnerability): Vulnerability {
  const shift = (2 - SEAT_ORDER.indexOf(minStol) + 4) % 4
  if (shift % 2 === 0) return v
  return v === 'ns' ? 'ew' : v === 'ew' ? 'ns' : v
}

// ---------------------------------------------------------------------------
// Projektionen av aktuell giv.

export interface GivKlarData {
  hands: Record<Seat, Card[]>
  contract: Contract | null
  passadUt: boolean
  declarerTricks: number
  nsScore: number
  stallning: { ns: number; ew: number }
}

export interface BordSpelLage {
  giv: number
  board: number
  dealer: Seat
  vulnerability: Vulnerability
  /** Auktionen i VERKLIGA stolar. */
  history: ResolvedCall[]
  fas: 'bud' | 'spel' | 'klar'
  contract: Contract | null
  passadUt: boolean
  /** Träkarlen som avslöjad (hela den utdelade handen, verklig stol). */
  trakarl: { stol: Seat; hand: Card[] } | null
  /** Spelade kort i ordning (verkliga stolar ur händelserna). */
  kort: PlayedCard[]
  klar: GivKlarData | null
  /** Ställningen: klar-givens inbakade totaler, annars grundställningen. */
  stallning: { ns: number; ew: number }
  bordKlar: { stallning: { ns: number; ew: number } } | null
}

/** Projektionen: senaste giv-start avgör aktuell giv; bara dess händelser
 *  (+ bordshändelsen bord-klar) spelar roll. Returnerar null före första given. */
export function projiceraBord(
  events: BordHandelse[],
  grundStallning: { ns: number; ew: number },
): BordSpelLage | null {
  let startIndex = -1
  for (let i = events.length - 1; i >= 0; i--) {
    if (events[i].typ === 'giv-start') {
      startIndex = i
      break
    }
  }
  if (startIndex === -1) return null
  const start = events[startIndex]
  const startData = start.data as { board: number; dealer: Seat; vulnerability: Vulnerability }

  const history: ResolvedCall[] = []
  const kort: PlayedCard[] = []
  let trakarl: BordSpelLage['trakarl'] = null
  let klar: GivKlarData | null = null
  let bordKlar: BordSpelLage['bordKlar'] = null
  for (const h of events.slice(startIndex + 1)) {
    if (h.typ === 'bord-klar') {
      bordKlar = h.data as { stallning: { ns: number; ew: number } }
    } else if (h.giv !== start.giv) {
      continue
    } else if (h.typ === 'bud' && h.seat) {
      history.push({ seat: h.seat, bid: (h.data as { bid: string }).bid })
    } else if (h.typ === 'kort' && h.seat) {
      kort.push({ seat: h.seat, card: (h.data as { card: Card }).card })
    } else if (h.typ === 'trakarl' && h.seat) {
      trakarl = { stol: h.seat, hand: (h.data as { hand: Card[] }).hand }
    } else if (h.typ === 'giv-klar') {
      klar = h.data as unknown as GivKlarData
    }
  }

  const budklar = auctionComplete(history)
  const contract = budklar ? contractFromCalls(history) : null
  const passadUt = budklar && !contract
  const fas: BordSpelLage['fas'] = klar || passadUt ? 'klar' : budklar ? 'spel' : 'bud'
  return {
    giv: start.giv,
    board: startData.board,
    dealer: startData.dealer,
    vulnerability: startData.vulnerability,
    history,
    fas,
    contract,
    passadUt,
    trakarl,
    kort,
    klar,
    stallning: klar?.stallning ?? grundStallning,
    bordKlar,
  }
}

// ---------------------------------------------------------------------------
// Den visuella auktionen.

export interface VisuellAuktion {
  calls: ResolvedCall[]
  dealer: Seat
  vulnerability: Vulnerability
  /** Stolen (visuell) som ska bjuda, eller null när auktionen är klar. */
  toAct: Seat | null
}

/** Auktionen vriden till min synvinkel. Egna bud får en systemisk förklaring
 *  (tolkningslagret, bara auktionen) så budrutan aldrig är tom — andras bud
 *  tolkas av AuctionGrid själv (hiddenHands-läckvakten). */
export function visuellAuktion(lage: BordSpelLage, minStol: Seat): VisuellAuktion {
  const v = vridStol(minStol)
  const calls: ResolvedCall[] = lage.history.map((c) => ({ seat: v(c.seat), bid: c.bid }))
  calls.forEach((c, i) => {
    if (c.seat === 'S') c.explanation = interpretCall(calls, i).text
  })
  return {
    calls,
    dealer: v(lage.dealer),
    vulnerability: vridZon(minStol, lage.vulnerability),
    toAct: lage.fas === 'bud' ? v(seatToAct(lage.dealer, lage.history.length)) : null,
  }
}

/** De färdigspelade sticken i VERKLIGA stolar (felrapporten m.m.) — byggda
 *  direkt ur korthändelserna med motorns stickvinnarlogik, så de funkar även
 *  under en pågående giv när dolda händer saknas. */
export function verkligaStick(lage: BordSpelLage): Trick[] {
  if (!lage.contract) return []
  const trump = lage.contract.strain === 'NT' ? null : lage.contract.strain
  const stick: Trick[] = []
  let leader: Seat = NEXT_SEAT[lage.contract.declarer]
  let aktuellt: PlayedCard[] = []
  for (const pc of lage.kort) {
    aktuellt = [...aktuellt, pc]
    if (aktuellt.length === 4) {
      const winner = currentWinner(aktuellt, trump)
      stick.push({ leader, cards: aktuellt, winner })
      leader = winner
      aktuellt = []
    }
  }
  return stick
}

// ---------------------------------------------------------------------------
// Det visuella spelet.

const sammaKort = (a: Card, b: Card) => a.suit === b.suit && a.rank === b.rank

export interface VisuellSpel {
  /** Syntetiskt spelläge i den VISUELLA världen: mina + träkarlens kort är
   *  riktiga, dolda händer är tomma listor (isComplete räknar stick, inte
   *  händer — och legalCards frågas bara för synliga händer). */
  state: PlayState
  /** Träkarlens visuella stol (spelförarens partner). */
  dummy: Seat
  /** Kort kvar per visuell stol (13 − spelade) — FaceDownFan-räknarna. */
  kvar: Record<Seat, number>
}

/** Bygg det visuella spelläget ur projektionen + min hand. null före spelet. */
export function byggVisuelltSpel(
  lage: BordSpelLage,
  dinHand: Card[] | null,
  minStol: Seat,
): VisuellSpel | null {
  if (!lage.contract || lage.fas === 'bud') return null
  const v = vridStol(minStol)
  const contract: Contract = { ...lage.contract, declarer: v(lage.contract.declarer) }
  const trump = contract.strain === 'NT' ? null : contract.strain
  const dummy = dummyOf(contract)

  // Sticken byggs med motorns stickvinnarlogik — inga händer behövs.
  const completedTricks: Trick[] = []
  let currentTrick: PlayedCard[] = []
  let leader: Seat = NEXT_SEAT[contract.declarer]
  let tricksNS = 0
  let tricksEW = 0
  const spelatAv: Record<Seat, Card[]> = { N: [], E: [], S: [], W: [] }
  for (const pc of lage.kort) {
    const seatV = v(pc.seat)
    spelatAv[seatV].push(pc.card)
    currentTrick = [...currentTrick, { seat: seatV, card: pc.card }]
    if (currentTrick.length === 4) {
      const winner = currentWinner(currentTrick, trump)
      completedTricks.push({ leader, cards: currentTrick, winner })
      if (side(winner) === 'NS') tricksNS++
      else tricksEW++
      leader = winner
      currentTrick = []
    }
  }
  const toAct: Seat =
    currentTrick.length === 0 ? leader : NEXT_SEAT[currentTrick[currentTrick.length - 1].seat]

  const kvarHand = (utdelad: Card[] | null, seatV: Seat): Card[] =>
    (utdelad ?? []).filter((c) => !spelatAv[seatV].some((s) => sammaKort(s, c)))

  const dummyV = lage.trakarl ? v(lage.trakarl.stol) : null
  const hands: Record<Seat, Card[]> = { N: [], E: [], S: [], W: [] }
  hands.S = kvarHand(dinHand, 'S')
  if (dummyV && lage.trakarl) hands[dummyV] = kvarHand(lage.trakarl.hand, dummyV)

  const kvar: Record<Seat, number> = { N: 13, E: 13, S: 13, W: 13 }
  for (const s of SEAT_ORDER) kvar[s] = 13 - spelatAv[s].length

  return {
    state: {
      contract,
      trump,
      hands,
      leader,
      toAct,
      currentTrick,
      completedTricks,
      tricksNS,
      tricksEW,
    },
    dummy,
    kvar,
  }
}
