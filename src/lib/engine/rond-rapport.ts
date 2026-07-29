// Rondgenomgångens textmotor (etapp 1). Ren funktion: färdigspelad giv in →
// hela rapporten som DATA ut. UI:t (RondRapport-vyn) renderar bara — ingen text
// formuleras i komponenterna, så allt går att facittesta här.
//
// Perspektivet följer controls() i pages/play/common.tsx: när NS är spelförar-
// sida spelar användaren BÅDA händerna N och S. Därför är Syd alltid "du",
// Nord "Nord (dina kort)" när NS spelför och "Nord (din partner)" i försvar.
// Öst/Väst omtalas i tredje person. DD-domen ("du borde ha tagit ett stick
// till") är etapp 3 och läggs ovanpå — den här modulen säger bara sådant som
// går att läsa rakt ur budgivningen och sticken.

import type { Bid, Card, Deal, Hand, Seat, Suit, Vulnerability } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { interpretCall, type Confidence } from './auction-interpret'
import { side, type Contract, type PlayResult, type Trick } from './play'
import { isAlertRule } from './rules'
import type { ScoreLine } from './scoring'
import { honorLead } from './signals'

export interface RondRapportInput {
  deal: Deal
  contract: Contract
  calls: ResolvedCall[]
  tricks: Trick[]
  result: PlayResult
  score: ScoreLine | null
  claimed: { total: number; auto: boolean } | null
  /** Botarnas motivering per spelat kort, nyckel `${suit}${rank}` (usePlayTable). */
  botReasons: Record<string, { seat: Seat; reason: string }>
}

export interface BudPunkt {
  seat: Seat
  bid: Bid
  /** Förklaringen — alltid ifylld (interpretCall lovar det, även för nakna pass). */
  text: string
  confidence: Confidence
  alert: boolean
  /** Sant för användarens egna bud (Syd). */
  du: boolean
}

export interface StickPunkt {
  /** 1-baserat sticknummer. */
  index: number
  /** Sticket självt — UI:t ritar minikorten ur det. */
  trick: Trick
  /** Enradsrubrik för stickets <details>-summary. */
  rubrik: string
  /** 2–4 korta punkter; ställningen är alltid sist. */
  rader: string[]
  /** Botmotivering per kort i sticket (visas vid tap), nyckel `${suit}${rank}`. */
  botRadFor: Record<string, string>
}

export interface ResultatRad {
  text: string
  ton: 'berom' | 'laxa' | 'neutral'
}

export interface RondRapport {
  rubrik: { kontraktText: string; brickText: string; zonText: string }
  budgivning: BudPunkt[]
  spelforing: StickPunkt[]
  resultat: ResultatRad[]
}

// Samma zontexter som spelbordet (pages/play/common.tsx VUL_TEXT — dupliceras
// här för att motorn inte ska importera UI-lagret).
const ZON_TEXT: Record<Vulnerability, string> = {
  none: 'Ingen i zon',
  ns: 'NS i zon',
  ew: 'ÖV i zon',
  all: 'Alla i zon',
}

const STRAIN_SYM: Record<string, string> = {
  spades: '♠',
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  NT: 'NT',
}

const SUIT_NAME: Record<Suit, string> = {
  spades: 'spader',
  hearts: 'hjärter',
  diamonds: 'ruter',
  clubs: 'klöver',
}

/** Kort som text, samma ordning som CardLabel på bordet: valör + symbol. */
function kortText(card: Card): string {
  return `${card.rank}${STRAIN_SYM[card.suit]}`
}

/** Nyckeln botReasons använder (usePlayTable): färg + valör. */
function kortNyckel(card: Card): string {
  return `${card.suit}${card.rank}`
}

/**
 * Vem en plats ÄR för användaren, i grundform ("du"/"Nord (dina kort)"/"Öst").
 * `declSide` avgör om Nord är användarens egna kort eller partnerboten.
 */
function subjekt(seat: Seat, declSide: 'NS' | 'EW'): string {
  if (seat === 'S') return 'du'
  if (seat === 'N') return declSide === 'NS' ? 'Nord (dina kort)' : 'Nord (din partner)'
  return seat === 'E' ? 'Öst' : 'Väst'
}

/** Samma som subjekt, men i objektsform efter "från" ("dig" i stället för "du"). */
function franForm(seat: Seat, declSide: 'NS' | 'EW'): string {
  return seat === 'S' ? 'dig' : subjekt(seat, declSide)
}

/** Versal i början av en mening ("du sakade" → "Du sakade"). */
function versal(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function buildRubrik(deal: Deal, contract: Contract, declSide: 'NS' | 'EW') {
  const dubbel = contract.doubled === 'XX' ? ' redubblat' : contract.doubled === 'X' ? ' dubblat' : ''
  return {
    kontraktText: `${contract.level}${STRAIN_SYM[contract.strain]}${dubbel} av ${franForm(contract.declarer, declSide)}`,
    brickText: `Bricka ${deal.board}`,
    zonText: ZON_TEXT[deal.vulnerability],
  }
}

function buildBudgivning(calls: ResolvedCall[]): BudPunkt[] {
  return calls.map((call, i) => {
    const tolkning = interpretCall(calls, i)
    return {
      seat: call.seat,
      bid: call.bid,
      text: tolkning.text,
      confidence: tolkning.confidence,
      alert: isAlertRule(call.rule),
      du: call.seat === 'S',
    }
  })
}

/** Max antal rader per stick (ägarkrav: ingen textvägg). */
const MAX_RADER = 4

const RANK_ORDER = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const rankVal = (r: string) => RANK_ORDER.indexOf(r)

/**
 * Vilken §8.3-regel utspelet följer, läst ur utspelarens FAKTISKA kort i färgen
 * i utspelsögonblicket (given är slut — alla kort är kända). Returnerar null
 * när inget mönster passar eller korten inte går att rekonstruera (då påstås
 * ingenting). Längdbudskapen (3:e/5:e, dubbelton) är FÖRSVARETS markeringar —
 * de sätts bara ut när utspelaren är motspelare; honnörssekvens och singel är
 * neutral teknik och namnges för alla.
 */
function utspelsRegel(suitCards: Card[], card: Card, forsvarare: boolean): string | null {
  if (!suitCards.some((c) => c.suit === card.suit && c.rank === card.rank)) return null
  if (suitCards.length === 1) return 'singelutspel.'
  const honnör = honorLead(suitCards)
  if (honnör && honnör.rank === card.rank) return 'topp av honnörssekvens (§8.3).'
  if (!forsvarare) return null
  const sorterade = [...suitCards].sort((a, b) => rankVal(b.rank) - rankVal(a.rank))
  const n = sorterade.length
  if (n === 2 && card.rank === sorterade[0].rank) return 'topp av dubbelton (§8.3).'
  if (n % 2 === 0 && n >= 4 && card.rank === sorterade[2].rank) {
    return '3:e bästa från jämn längd (§8.3), visar längden för partnern.'
  }
  if (n % 2 === 1 && card.rank === sorterade[n - 1].rank) {
    return 'lägsta från udda längd (§8.3), visar längden för partnern.'
  }
  return null
}

function buildSpelforing(
  deal: Deal,
  tricks: Trick[],
  trump: Suit | null,
  declSide: 'NS' | 'EW',
  botReasons: RondRapportInput['botReasons'],
): StickPunkt[] {
  let ns = 0
  let ew = 0
  // Kvarvarande kort per plats, för utspelsregeln — given är slut så alla
  // händer är kända; vi spolar bara tillbaka till respektive utspelsögonblick.
  const kvar: Record<Seat, Hand> = {
    N: [...deal.hands.N],
    E: [...deal.hands.E],
    S: [...deal.hands.S],
    W: [...deal.hands.W],
  }
  return tricks.map((trick, i) => {
    if (side(trick.winner) === 'NS') ns++
    else ew++

    const ledSuit = trick.cards[0].card.suit
    const winnerCard = trick.cards.find((pc) => pc.seat === trick.winner)!.card
    const stal = trump !== null && winnerCard.suit === trump && ledSuit !== trump
    const rubrik = `Stick ${i + 1} — ${subjekt(trick.winner, declSide)} ${stal ? 'stal' : 'vann'} med ${kortText(winnerCard)}`

    // Händelserader: trumfningar först (mest berättande), sedan sakningar.
    // Utspelet + ställningen är fasta → plats för högst MAX_RADER − 2 händelser.
    const trumfningar: string[] = []
    const sakningar: string[] = []
    for (const pc of trick.cards.slice(1)) {
      if (pc.card.suit === ledSuit) continue
      const vem = versal(subjekt(pc.seat, declSide))
      if (trump !== null && pc.card.suit === trump) {
        trumfningar.push(`${vem} saknade ${SUIT_NAME[ledSuit]} och trumfade med ${kortText(pc.card)}.`)
      } else {
        sakningar.push(`${vem} sakade ${kortText(pc.card)}.`)
      }
    }
    const handelser = [...trumfningar, ...sakningar].slice(0, MAX_RADER - 2)

    // Utspelsregeln bakas in i utspelsraden (radbudgeten hålls). Bara stick 1
    // är ett äkta utspel i doktrinens mening; senare ledningar namnges bara
    // när mönstret är otvetydigt (sekvens/singel — utspelsRegel avgör).
    const ledCard = trick.cards[0].card
    const ledSuitCards = kvar[trick.leader].filter((c) => c.suit === ledCard.suit)
    const forsvarare = side(trick.leader) !== declSide
    const regel = utspelsRegel(ledSuitCards, ledCard, forsvarare && i === 0)
    const utspelsRad = regel
      ? `Utspel ${kortText(ledCard)} från ${franForm(trick.leader, declSide)} — ${regel}`
      : `Utspel ${kortText(ledCard)} från ${franForm(trick.leader, declSide)}.`
    for (const pc of trick.cards) {
      kvar[pc.seat] = kvar[pc.seat].filter(
        (c) => !(c.suit === pc.card.suit && c.rank === pc.card.rank),
      )
    }

    const rader = [utspelsRad, ...handelser, `Ställning: NS ${ns} – ÖV ${ew}.`]

    // Botmotiveringar för just det här stickets kort (nyckel + sits måste stämma).
    const botRadFor: Record<string, string> = {}
    for (const pc of trick.cards) {
      const info = botReasons[kortNyckel(pc.card)]
      if (info && info.seat === pc.seat) botRadFor[kortNyckel(pc.card)] = info.reason
    }

    return { index: i + 1, trick, rubrik, rader, botRadFor }
  })
}

function buildResultat(input: RondRapportInput, declSide: 'NS' | 'EW'): ResultatRad[] {
  const { contract, tricks, result, score, claimed } = input
  const rader: ResultatRad[] = []

  const kontrakt = `${contract.level}${STRAIN_SYM[contract.strain]} av ${franForm(contract.declarer, declSide)}`
  const utfall = result.made
    ? result.diff === 0
      ? 'hemma, exakt bud.'
      : result.diff === 1
        ? 'hemma med ett övertrick.'
        : `hemma med ${result.diff} övertrick.`
    : `${-result.diff} bet.`
  // Tonen utgår från ANVÄNDARENS sida (alltid NS): egen hemgång och lyckat
  // motspel är beröm; egen bet är en läxa; att motståndarna går hem säger utan
  // facit ingenting om motspelet — neutralt (DD-domen i etapp 3 skärper detta).
  const ton: ResultatRad['ton'] =
    declSide === 'NS' ? (result.made ? 'berom' : 'laxa') : result.made ? 'neutral' : 'berom'
  rader.push({ text: `${kontrakt}: ${result.declarerTricks} stick — ${utfall}`, ton })

  if (claimed) {
    rader.push({
      text: claimed.auto
        ? 'Auto Claim: resten av sticken var 100 % säkra för spelföraren och bokfördes utan spel.'
        : `Claim godkänd efter stick ${tricks.length} — resten bokfördes utan spel (claimen prövades mot facitlösaren).`,
      ton: 'neutral',
    })
  }

  if (score) rader.push({ text: `Poäng: ${score.label}.`, ton: 'neutral' })

  return rader
}

/** Bygger hela rondgenomgången som data. Ren och deterministisk. */
export function buildRondRapport(input: RondRapportInput): RondRapport {
  const declSide = side(input.contract.declarer)
  const trump: Suit | null = input.contract.strain === 'NT' ? null : input.contract.strain
  return {
    rubrik: buildRubrik(input.deal, input.contract, declSide),
    budgivning: buildBudgivning(input.calls),
    spelforing: buildSpelforing(input.deal, input.tricks, trump, declSide, input.botReasons),
    resultat: buildResultat(input, declSide),
  }
}
