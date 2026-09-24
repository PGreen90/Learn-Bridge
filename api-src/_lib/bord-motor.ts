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
// Bottarna spelar EXAKT som i Dagens tävling (ägarbeslut 2026-09-24, "borden =
// tävlingen"): samma budfunktion (botBud — tabellen, och resonemangslagret där
// tabellen saknar regel och ett DD-orakel finns) och samma Monte-Carlo-profil
// som klientens spelbord (SERVER_SMART = klientens standard). Serverless-taket
// hanteras med en tidsbudget per anrop: är den slut STANNAR framdrivningen
// (inga billigare tumregeldrag) och nästa hjärtslag fortsätter där den slutade
// — kvaliteten är aldrig lägre än på telefonen, bara utspridd över fler anrop.
// Fröet (bordPlaySeed → botDecisionSeed per beslut) gör varje kortval
// reproducerbart (spela-giv.ts); budet i ett tänkande läge är deterministiskt
// ur egen hand + auktionen (resonemangFro), samma som i tävlingen.

import { createHmac } from 'node:crypto'
import type { Card, Deal, Seat } from '../../src/types/bridge'
import type { ResolvedCall } from '../../src/lib/bidding'
import { dealFromSeed, mulberry32 } from '../../src/lib/engine/deal'
import {
  auctionComplete,
  contractFromCalls,
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
import { declarerTricksWon, remainingTricks } from '../../src/lib/engine/claim'
import { botBud } from '../../src/lib/engine/resonemang'
import type { DDSolver } from '../../src/lib/engine/revisor'

/** DD-orakel för resonemangslagret: en (slumpad) giv → DD-tabellens uppslag.
 *  Saknas det bjuder bottarna bara ur tabellen (som före 2026-09-24). */
export type BudOrakel = (d: Deal) => DDSolver

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

const SEAT_ORDER: Seat[] = ['N', 'E', 'S', 'W']

/** Rotera en giv `shift` steg medurs: händer, given och zonen följer med
 *  konsekvent (samma matematik som klientens seatDealSouth — udda rotation
 *  byter partnerskap och därmed NS/ÖV-zonen). Auktionen är en funktion av
 *  (händer, given) och roterar därför exakt med. */
export function roteraDeal(deal: Deal, shift: number): Deal {
  const s = ((shift % 4) + 4) % 4
  if (s === 0) return deal
  const hands = {} as Deal['hands']
  SEAT_ORDER.forEach((seat, i) => {
    hands[seat] = deal.hands[SEAT_ORDER[(i - s + 4) % 4]]
  })
  const dealer = SEAT_ORDER[(SEAT_ORDER.indexOf(deal.dealer) + s) % 4]
  const vul =
    s % 2 === 0
      ? deal.vulnerability
      : deal.vulnerability === 'ns'
        ? 'ew'
        : deal.vulnerability === 'ew'
          ? 'ns'
          : deal.vulnerability
  return { ...deal, hands, dealer, vulnerability: vul }
}

/** Motorns hela kanoniska auktion för en giv (facit-genomgången i läge 1 och
 *  läge 2:s autobud): bottens bud stol för stol tills auktionen är klar —
 *  med orakel tänker bottarna precis som i tävlingen. */
export function autoAuktion(deal: Deal, oracle?: BudOrakel): ResolvedCall[] {
  const history: ResolvedCall[] = []
  let vakt = 0
  while (!auctionComplete(history) && vakt++ < 60) {
    const seat = seatToAct(deal.dealer, history.length)
    const call = botBud(deal, history, seat, oracle)
    history.push({ seat, bid: call.bid })
  }
  return history
}

/** Läge 2 ("endast spelföring"): given som spelas av `malStol`. Motorn bjuder
 *  själv; en utpassad giv genereras om ur nästa underindex (läget ska alltid
 *  ha en spelförare), och händerna roteras så spelförarstolen hamnar hos
 *  människan på tur. Deterministisk ur (frö, givnummer, målstol). */
export function lage2Giv(
  seedHex: string,
  givNr: number,
  malStol: Seat,
  oracle?: BudOrakel,
): { deal: Deal; underIndex: number; shift: number } {
  for (let k = 0; k < 20; k++) {
    const ratt = bordGiv(seedHex, givNr, k)
    const auktion = autoAuktion(ratt, oracle)
    const contract = contractFromCalls(auktion)
    if (!contract) continue // utpassad — nästa underindex
    const shift = (SEAT_ORDER.indexOf(malStol) - SEAT_ORDER.indexOf(contract.declarer) + 4) % 4
    return { deal: roteraDeal(ratt, shift), underIndex: k, shift }
  }
  // 20 utpassade givar i rad händer inte i praktiken — men om, ta den sista rakt av.
  return { deal: bordGiv(seedHex, givNr, 19), underIndex: 19, shift: 0 }
}

/** Återskapa givens EXAKTA deal ur giv-start-händelsens data (läge 2 bär
 *  underindex + rotation; läge 1/3 använder standardvärdena). */
export function dealUrGivStart(
  seedHex: string,
  givNr: number,
  data: unknown,
): Deal {
  const d = (data ?? {}) as { underIndex?: number; shift?: number }
  return roteraDeal(bordGiv(seedHex, givNr, d.underIndex ?? 0), d.shift ?? 0)
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

/** Claimen vid bordet (etapp 3, 2026-09-14): servern föreslog att spelföraren
 *  tar resten ('claim-forslag'), människorna svarar ('claim-svar' per stol).
 *  Ett nej → `avbojd`, spelet fortsätter och ingen ny claim föreslås i given. */
export interface ClaimLage {
  /** Spelförarens totala stick om claimen bokförs (vunna + alla återstående). */
  total: number
  stol: Seat
  svar: Partial<Record<Seat, boolean>>
  avbojd: boolean
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
  /** Föreslagen claim i given (null = ingen). */
  claim: ClaimLage | null
}

/** Stolarna som måste svara på en claim: de aktiva människorna utom träkarlen
 *  (som inte spelar). Tom mängd → claimen bokförs direkt. */
export function claimSvarande(contract: Contract, manniskoStolar: Set<Seat>): Seat[] {
  const dummy = dummyOf(contract)
  return [...manniskoStolar].filter((s) => s !== dummy)
}

/** Har alla som måste svara sagt OK? (Ett nej syns som `avbojd`.) */
export function claimGodkand(claim: ClaimLage, svarande: Seat[]): boolean {
  return !claim.avbojd && svarande.every((s) => claim.svar[s] === true)
}

/** Bygg givläget ur givens händelser. Kastar vid korrupt logg (olagligt kort)
 *  — det kan bara hända vid ett programfel, aldrig av klientindata (allt
 *  validerades när det bokfördes). */
export function projiceraGiv(deal: Deal, handelser: GivHandelse[]): GivLage {
  const history: ResolvedCall[] = []
  const kort: Card[] = []
  let trakarlLagd = false
  let givKlar = false
  let claim: ClaimLage | null = null
  for (const h of handelser) {
    if (h.typ === 'bud' && h.seat) {
      history.push({ seat: h.seat, bid: (h.data as { bid: string }).bid })
    } else if (h.typ === 'kort') {
      kort.push((h.data as { card: Card }).card)
    } else if (h.typ === 'trakarl') {
      trakarlLagd = true
    } else if (h.typ === 'giv-klar' || h.typ === 'facit') {
      // 'facit' är läge 1:s slutpunkt (4D) — given är genomgången, inget spel.
      givKlar = true
    } else if (h.typ === 'claim-forslag') {
      const d = h.data as { total: number; stol: Seat }
      claim = { total: d.total, stol: d.stol, svar: {}, avbojd: false }
    } else if (h.typ === 'claim-svar' && h.seat && claim) {
      const ok = (h.data as { ok: boolean }).ok === true
      claim.svar[h.seat] = ok
      if (!ok) claim.avbojd = true
    }
  }

  if (!auctionComplete(history)) {
    return { history, fas: 'bud', contract: null, passadUt: false, state: null, trakarlLagd, givKlar, claim }
  }
  const contract = contractFromCalls(history)
  if (!contract) {
    return { history, fas: 'klar', contract: null, passadUt: true, state: null, trakarlLagd, givKlar, claim }
  }
  let state = startPlay(deal, contract)
  for (const c of kort) state = playCard(state, c)
  const fas = givKlar || isComplete(state) ? 'klar' : 'spel'
  return { history, fas, contract, passadUt: false, state, trakarlLagd, givKlar, claim }
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
  // Etapp 3: medan en föreslagen claim väntar på svar spelas inga kort —
  // dialogen kräver ett val (OK eller spela klart) av var och en.
  if (lage.claim && !lage.claim.avbojd) {
    return { ok: false, fel: 'Claimen väntar på svar' }
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

/** Serverns MC-profil = KLIENTENS standard (tomt objekt → botCardSmarts egna
 *  standardvärden: 8-kortsfönster, mcBudget per kortantal). Ägarbeslut
 *  2026-09-24: bottarna vid bordet spelar exakt som i tävlingen. Tidsbudgeten
 *  per anrop (nedan) sköter serverless-taket — inte en sämre profil.
 *  Facit: bord-motor.test.ts jämför serverns kort med klientvägens. */
export const SERVER_SMART: SmartOpts = {}

export interface DrivMiljo {
  /** Stolar som styrs av en aktiv människa — servern spelar aldrig deras drag.
   *  (En människas stol vars PARTNER är spelförande bot styrs av boten när den
   *  är träkarl — det hanteras av agerande(), inte av den här mängden.) */
  manniskoStolar: Set<Seat>
  /** Bordets play-frö (bordPlaySeed) — reproducerbara botkort. */
  playSeed: number
  /** Ställningen FÖRE den här given ({ns, ew}-totaler) — bakas in i giv-klar. */
  stallning: { ns: number; ew: number }
  /** Bordets spelform (4D): 'budgivning' stannar när auktionen är klar och
   *  bokför 'facit' (reveal + motorns systemlinje) i stället för kortspel.
   *  Default 'full' (läge 2 spelar också kort — auktionen är redan bokförd). */
  spelform?: 'budgivning' | 'spelforing' | 'full'
  smart?: SmartOpts
  /** Total tidsbudget för botdragen i DETTA anrop (ms). Är den slut STANNAR
   *  framdrivningen före nästa botbeslut — resten tar nästa hjärtslag. Ett
   *  påbörjat beslut (t.ex. ett tänkande bud) körs alltid klart. */
  budgetMs?: number
  /** DD-orakel för resonemangslagret (bud utan tabellrad). Saknas → tabellen. */
  oracle?: BudOrakel
  /** Injektbar klocka (test). */
  nu?: () => number
  /** Claimens DD-dom (etapp 3, claim-dd.ts): tar spelförarsidan alla
   *  återstående stick från det här stickstartet? Saknas → inga claims. */
  claimKontroll?: (state: PlayState) => boolean
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

  const givKlarHandelse = (
    declarerTricks: number,
    poang: number,
    passadUt: boolean,
    claim?: { total: number; stol: Seat },
  ): NyHandelse => ({
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
      ...(claim ? { claim } : {}),
    },
  })

  let vakt = 0
  while (vakt++ < 120) {
    if (fas === 'bud') {
      if (auctionComplete(history)) {
        contract = contractFromCalls(history)
        // Läge 1 (endast budgivning, 4D): auktionen ÄR given — bokför facit
        // (reveal + motorns kanoniska linje som jämförelse) och stanna.
        if (miljo.spelform === 'budgivning') {
          nya.push({
            giv: givNr,
            typ: 'facit',
            data: { hands: deal.hands, contract, systemlinje: autoAuktion(deal, miljo.oracle) },
          })
          break
        }
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
      if (nu() - start > budget) break // budgeten slut → nästa hjärtslag fortsätter
      const call = botBud(deal, history, seat, miljo.oracle)
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
    // Etapp 3 — claimen: en föreslagen claim pausar spelet tills alla som ska
    // svara har svarat. Alla OK → given bokförs med claimens total (resten av
    // sticken utan spel). Ett nej → spelet fortsätter, aldrig ett nytt förslag.
    if (lage.claim && !lage.claim.avbojd) {
      if (claimGodkand(lage.claim, claimSvarande(contract!, miljo.manniskoStolar))) {
        const total = lage.claim.total
        nya.push(
          givKlarHandelse(total, nsScore(contract!, total, deal.vulnerability), false, {
            total,
            stol: lage.claim.stol,
          }),
        )
      }
      break
    }
    // Vid varje stickstart: vill DD claima? (Ägarbeslut 2026-09-14: då gör den
    // det, och människorna får välja OK eller spela klart.) Ett enda stick kvar
    // claimas aldrig (2026-09-19): korten är tvingade — sticket spelas ut. Och
    // en MÄNSKLIG spelförare får aldrig ett förslag (ägarbeslut 2026-09-19):
    // datorn gör inte anspråk åt en människa — hen spelar sin hand.
    if (
      !lage.claim &&
      st.currentTrick.length === 0 &&
      remainingTricks(st) > 1 &&
      !miljo.manniskoStolar.has(contract!.declarer) &&
      miljo.claimKontroll?.(st)
    ) {
      const total = declarerTricksWon(st) + remainingTricks(st)
      const claim = { total, stol: contract!.declarer }
      nya.push({ giv: givNr, typ: 'claim-forslag', seat: contract!.declarer, data: claim })
      // Ingen som behöver svara (bara bottar, eller människan är träkarl) →
      // bokför direkt i samma anrop, precis som om alla sagt OK.
      if (claimSvarande(contract!, miljo.manniskoStolar).length === 0) {
        nya.push(givKlarHandelse(total, nsScore(contract!, total, deal.vulnerability), false, claim))
      }
      break
    }
    const toAct = st.toAct
    if (miljo.manniskoStolar.has(agerande(contract!, toAct))) break

    if (nu() - start > budget) break // budgeten slut → nästa hjärtslag fortsätter
    const rng = mulberry32(botDecisionSeed(miljo.playSeed, playIndexOf(st.completedTricks.length, st.currentTrick.length)))
    const profil: SmartOpts = { ...SERVER_SMART, ...miljo.smart, rng }
    const card = botCardSmart(st, toAct, history, profil)
    state = playCard(st, card)
    nya.push({ giv: givNr, typ: 'kort', seat: toAct, data: { card } })
  }

  return nya
}

/** Giv-start-händelsen: klientens enda källa till bricka/giv/zon (den läser
 *  ALDRIG bricknummerformeln själv — händelsen är sanningen). Läge 2 bär
 *  dessutom underindex + rotation så servern kan återskapa exakt samma deal
 *  ur fröet i varje senare anrop (dealUrGivStart). */
export function givStartHandelse(
  deal: Deal,
  givNr: number,
  extra?: { underIndex: number; shift: number },
): NyHandelse {
  return {
    giv: givNr,
    typ: 'giv-start',
    data: {
      board: deal.board,
      dealer: deal.dealer,
      vulnerability: deal.vulnerability,
      ...(extra ?? {}),
    },
  }
}
