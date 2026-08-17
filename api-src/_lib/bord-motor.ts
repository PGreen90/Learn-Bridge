// Beslut B etapp 4 (4B) — bordets spelmotor: servern är domaren.
//
// REN modul (ingen databas, ingen HTTP): allt räknas ur (bordsfrö, givnummer,
// händelselistan för given). Endpointen (bord.ts) läser loggen, kallar hit och
// bokför de nya händelserna. Samma motorfunktioner som tävlingsvalideringen
// (validera.ts) — decideCall/legalCalls för buden, playCard/legalCards för
// korten — så bordets domslut ÄR appens spelregler.
//
// Dold information (ägarbeslut 2026-08-17): händelserna innehåller aldrig
// ospelade dolda händer. Undantagen är exakt bridgens egna avslöjanden:
//  • 'trakarl' läggs som händelse direkt EFTER utspelet (då läggs träkarlen
//    upp vid ett riktigt bord),
//  • 'giv-klar' bär alla fyra händerna (given är färdigspelad — reveal).
// Budhändelser bär BARA budet ('bud' {bid}) — motorns förklaringar byggs av
// budgivarens faktiska hand och skulle läcka den via konsolen; klienten tolkar
// i stället systemiskt ur auktionen (interpretCall), samma läckvakt som
// spelbordets AuctionGrid.
//
// Botarnas kortval på serverless: strypt Monte-Carlo-profil (SERVER_SMART) +
// total tidsbudget per anrop — överskrids den faller resten av dragen tillbaka
// på tumreglerna (maxCardsForMC: 0). Ofarligt för korrektheten: vid bordet ÄR
// serverns drag facit, inget ska reproduceras i efterhand (till skillnad från
// tävlingsvalideringen). Fröet (bordPlaySeed → botDecisionSeed per beslut)
// behålls ändå så en giv kan spelas om exakt vid felsökning (spela-giv.ts).

import { createHmac } from 'node:crypto'
import type { Card, Deal, Seat } from '../../src/types/bridge'
import type { ResolvedCall } from '../../src/lib/bidding'
import { dealFromSeed, mulberry32 } from '../../src/lib/engine/deal'
import {
  auctionComplete,
  contractFromCalls,
  decideCall,
  legalCalls,
  seatToAct,
} from '../../src/lib/engine/auction-live'
import {
  contractResult,
  dummyOf,
  isComplete,
  legalCards,
  playCard,
  startPlay,
  type Contract,
  type PlayState,
} from '../../src/lib/engine/play'
import { botCardSmart, type SmartOpts } from '../../src/lib/engine/play-bot'
import { botDecisionSeed, playIndexOf } from '../../src/lib/engine/play-seed'
import { nsScore } from '../../src/lib/engine/matchpoints'

// ---------------------------------------------------------------------------
// Givarna ur bordsfröet.

/** Heltalsfrö för given (samma HMAC-mönster som tävlingens seed.ts — bordets
 *  hemliga frö bor i tables.seed och når aldrig klienten). `underIndex` används
 *  av läge 2 (4D) för att generera om en utpassad giv. */
export function bordGivSeed(seedHex: string, givNr: number, underIndex = 0): number {
  const mac = createHmac('sha256', seedHex).update(`giv:${givNr}:${underIndex}`).digest()
  return mac.readUInt32BE(0)
}

/** Play-fröet för bottarnas kortval i en giv (skilt från giv-fröet). */
export function bordPlaySeed(seedHex: string, givNr: number): number {
  const mac = createHmac('sha256', seedHex).update(`giv:${givNr}:play`).digest()
  return mac.readUInt32BE(0)
}

/** Given för ett givnummer vid bordet. Bricknumret = givnumret (boardInfo är
 *  modulär, så zonschemat rullar korrekt även över 16). */
export function bordGiv(seedHex: string, givNr: number, underIndex = 0): Deal {
  return { ...dealFromSeed(bordGivSeed(seedHex, givNr, underIndex), givNr), id: `bord-giv-${givNr}` }
}

// ---------------------------------------------------------------------------
// Projektionen: händelser → givläge.

/** En redan bokförd händelse för EN giv (delmängd av table_events-raden). */
export interface GivHandelse {
  typ: string
  seat: Seat | null
  data: unknown
}

/** Ny händelse att bokföra (seq sätts av endpointens sekvensvakt). */
export interface NyHandelse {
  giv: number
  typ: string
  seat?: Seat | null
  data?: unknown
}

export interface GivLage {
  history: ResolvedCall[]
  fas: 'bud' | 'spel' | 'klar'
  contract: Contract | null
  passadUt: boolean
  /** Spelläget (null före utspelet/vid utpassad giv). */
  state: PlayState | null
  trakarlLagd: boolean
  givKlar: boolean
}

/** Bygg givläget ur givens händelser. Kastar vid korrupt logg (olagligt kort)
 *  — det kan bara hända vid ett programfel, aldrig av klientindata (allt
 *  validerades när det bokfördes). */
export function projiceraGiv(deal: Deal, handelser: GivHandelse[]): GivLage {
  const history: ResolvedCall[] = []
  const kort: Card[] = []
  let trakarlLagd = false
  let givKlar = false
  for (const h of handelser) {
    if (h.typ === 'bud' && h.seat) {
      history.push({ seat: h.seat, bid: (h.data as { bid: string }).bid })
    } else if (h.typ === 'kort') {
      kort.push((h.data as { card: Card }).card)
    } else if (h.typ === 'trakarl') {
      trakarlLagd = true
    } else if (h.typ === 'giv-klar') {
      givKlar = true
    }
  }

  if (!auctionComplete(history)) {
    return { history, fas: 'bud', contract: null, passadUt: false, state: null, trakarlLagd, givKlar }
  }
  const contract = contractFromCalls(history)
  if (!contract) {
    return { history, fas: 'klar', contract: null, passadUt: true, state: null, trakarlLagd, givKlar }
  }
  let state = startPlay(deal, contract)
  for (const c of kort) state = playCard(state, c)
  const fas = givKlar || isComplete(state) ? 'klar' : 'spel'
  return { history, fas, contract, passadUt: false, state, trakarlLagd, givKlar }
}

// ---------------------------------------------------------------------------
// Vem styr vad.

/** Stolen som AGERAR för `toAct`: träkarlens kort läggs av spelföraren (bridgens
 *  regel — och bordets: träkarlens ägare sitter passiv under given). */
export function agerande(contract: Contract, toAct: Seat): Seat {
  return toAct === dummyOf(contract) ? contract.declarer : toAct
}

// ---------------------------------------------------------------------------
// Mänskliga drag.

export type BordDrag = { typ: 'bud'; bid: string } | { typ: 'kort'; card: Card }

/** Validera ett mänskligt drag mot givläget. Returnerar händelsen att bokföra
 *  (trakarl/giv-klar läggs av drivFram som körs direkt efter). */
export function utforDrag(
  deal: Deal,
  givNr: number,
  lage: GivLage,
  stol: Seat,
  drag: BordDrag,
): { ok: true; handelse: NyHandelse } | { ok: false; fel: string } {
  if (drag.typ === 'bud') {
    if (lage.fas !== 'bud') return { ok: false, fel: 'Budgivningen är avslutad' }
    const seat = seatToAct(deal.dealer, lage.history.length)
    if (seat !== stol) return { ok: false, fel: 'Inte din tur att bjuda' }
    if (!legalCalls(lage.history, stol).includes(drag.bid)) {
      return { ok: false, fel: 'Ogiltigt bud' }
    }
    return { ok: true, handelse: { giv: givNr, typ: 'bud', seat: stol, data: { bid: drag.bid } } }
  }

  if (lage.fas !== 'spel' || !lage.state || !lage.contract) {
    return { ok: false, fel: 'Kortspelet pågår inte' }
  }
  const toAct = lage.state.toAct
  if (agerande(lage.contract, toAct) !== stol) {
    return { ok: false, fel: 'Inte din tur att spela' }
  }
  const card = drag.card
  if (
    !card ||
    !legalCards(lage.state, toAct).some((c) => c.suit === card.suit && c.rank === card.rank)
  ) {
    return { ok: false, fel: 'Ogiltigt kort' }
  }
  return { ok: true, handelse: { giv: givNr, typ: 'kort', seat: toAct, data: { card } } }
}

// ---------------------------------------------------------------------------
// Botframdrivningen.

/** Strypt MC-profil för serverless (mot klientens fönster på 8 kort och
 *  budget upp till 30 sampel / 200k noder): mindre fönster, färre sampel.
 *  Facit: bord-motor.test.ts mäter att en hel giv spelas inom tidsbudgeten. */
export const SERVER_SMART: SmartOpts = { maxCardsForMC: 7, samples: 8, maxNodes: 60_000 }

export interface DrivMiljo {
  /** Stolar som styrs av en aktiv människa — servern spelar aldrig deras drag.
   *  (En människas stol vars PARTNER är spelförande bot styrs av boten när den
   *  är träkarl — det hanteras av agerande(), inte av den här mängden.) */
  manniskoStolar: Set<Seat>
  /** Bordets play-frö (bordPlaySeed) — reproducerbara botkort. */
  playSeed: number
  /** Ställningen FÖRE den här given ({ns, ew}-totaler) — bakas in i giv-klar. */
  stallning: { ns: number; ew: number }
  smart?: SmartOpts
  /** Total tidsbudget för botdragen i DETTA anrop (ms). Överskriden budget →
   *  resterande drag via tumreglerna (billiga, alltid lagliga). */
  budgetMs?: number
  /** Injektbar klocka (test). */
  nu?: () => number
}

/**
 * Spela alla väntande botdrag tills en människa är i tur, given är klar eller
 * budgeten är slut (då tumregel-drag tills stopp). Returnerar händelserna i
 * bokföringsordning: bud/kort + 'trakarl' direkt efter utspelet + 'giv-klar'
 * med reveal/poäng/ställning när sista sticket är lagt (eller given passats ut).
 */
export function drivFram(
  deal: Deal,
  givNr: number,
  handelser: GivHandelse[],
  miljo: DrivMiljo,
): NyHandelse[] {
  const nu = miljo.nu ?? Date.now
  const budget = miljo.budgetMs ?? 5_000
  const start = nu()
  const nya: NyHandelse[] = []

  const lage = projiceraGiv(deal, handelser)
  if (lage.givKlar) return nya
  let { history, fas, contract, state, trakarlLagd } = lage

  const givKlarHandelse = (declarerTricks: number, poang: number, passadUt: boolean): NyHandelse => ({
    giv: givNr,
    typ: 'giv-klar',
    data: {
      hands: deal.hands,
      contract,
      passadUt,
      declarerTricks,
      nsScore: poang,
      stallning: {
        ns: miljo.stallning.ns + (poang > 0 ? poang : 0),
        ew: miljo.stallning.ew + (poang < 0 ? -poang : 0),
      },
    },
  })

  let vakt = 0
  while (vakt++ < 120) {
    if (fas === 'bud') {
      if (auctionComplete(history)) {
        contract = contractFromCalls(history)
        if (!contract) {
          nya.push(givKlarHandelse(0, 0, true))
          break
        }
        state = startPlay(deal, contract)
        fas = 'spel'
        continue
      }
      const seat = seatToAct(deal.dealer, history.length)
      if (miljo.manniskoStolar.has(seat)) break
      const call = decideCall(deal, history, seat)
      history = [...history, { seat, bid: call.bid }]
      nya.push({ giv: givNr, typ: 'bud', seat, data: { bid: call.bid } })
      continue
    }

    // fas === 'spel'
    const st = state!
    const spelade = st.completedTricks.length * 4 + st.currentTrick.length
    if (spelade >= 1 && !trakarlLagd) {
      const dummy = dummyOf(contract!)
      nya.push({ giv: givNr, typ: 'trakarl', seat: dummy, data: { hand: deal.hands[dummy] } })
      trakarlLagd = true
      continue
    }
    if (isComplete(st)) {
      const declarerTricks = contractResult(st).declarerTricks
      nya.push(
        givKlarHandelse(declarerTricks, nsScore(contract!, declarerTricks, deal.vulnerability), false),
      )
      break
    }
    const toAct = st.toAct
    if (miljo.manniskoStolar.has(agerande(contract!, toAct))) break

    const rng = mulberry32(botDecisionSeed(miljo.playSeed, playIndexOf(st.completedTricks.length, st.currentTrick.length)))
    const profil: SmartOpts =
      nu() - start > budget
        ? { maxCardsForMC: 0 } // budgeten slut → tumreglerna resten av anropet
        : { ...SERVER_SMART, ...miljo.smart, rng }
    const card = botCardSmart(st, toAct, history, profil)
    state = playCard(st, card)
    nya.push({ giv: givNr, typ: 'kort', seat: toAct, data: { card } })
  }

  return nya
}

/** Giv-start-händelsen: klientens enda källa till bricka/giv/zon (den läser
 *  ALDRIG bricknummerformeln själv — händelsen är sanningen). */
export function givStartHandelse(deal: Deal, givNr: number): NyHandelse {
  return {
    giv: givNr,
    typ: 'giv-start',
    data: { board: deal.board, dealer: deal.dealer, vulnerability: deal.vulnerability },
  }
}
