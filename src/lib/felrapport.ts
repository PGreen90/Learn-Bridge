// Felrapportering från spelbordet: gör om HELA given (händer, budgivning,
// kontrakt, spelade stick) till ett ärende i projektets ärendelista. Sedan
// 2026-11-11 skickas den via den öppna mottagaren (/api/rapport) — vem som
// helst kan rapportera, utan konto. Kommandot /felrapporter läser rapporten,
// återskapar given som test (FACIT FÖRE FIX) och lagar felet.

import type { Card, Deal, Hand, Rank, Seat, Suit, Vulnerability } from '../types/bridge'
import { SEAT_LABEL, type ResolvedCall } from './bidding'
import { MOTORSTAMPEL } from './build'
import type { Rapport } from './backend/rapport'
import { auctionComplete } from './engine/auction-live'
import { side, type Contract, type Trick } from './engine/play'

/**
 * Förslagskategorierna (2026-11-11): "jag hade gjort annorlunda" är ett
 * FÖRSLAG, inte ett fel — det får etiketten `forslag` och hamnar i en egen kö,
 * så riktiga fel aldrig drunknar i smakfrågor. Allt som börjar med "Förslag: "
 * räknas som förslag (se rapportTyp).
 */
const FORSLAG_PREFIX = 'Förslag: '
export const FORSLAG_SPEL = `${FORSLAG_PREFIX}jag hade bjudit eller spelat annorlunda`
export const FORSLAG_BUD = `${FORSLAG_PREFIX}jag hade bjudit annorlunda`

/** Kategorierna i rapportdialogen från spelbordet (hela given). */
export const REPORT_CATEGORIES = [
  'Felaktig budgivning',
  'Fel budförklaring',
  'Datorn spelade korten fel',
  'Fel i resultat/poäng',
  FORSLAG_SPEL,
  'Annat',
] as const
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]

/**
 * Kategorierna i Budvisningen: där spelas korten aldrig, så bara rent
 * budgivningsspecifika alternativ (+ "Annat") visas — inga stick/resultat.
 */
export const BIDDING_REPORT_CATEGORIES = [
  'Felaktig budgivning',
  'Fel budförklaring',
  'Fel slutkontrakt',
  FORSLAG_BUD,
  'Annat',
] as const

/** Fel eller förslag? Avgörs av kategorin — styr rubrik och etikett. */
export function rapportTyp(category: string): 'felrapport' | 'forslag' {
  return category.startsWith(FORSLAG_PREFIX) ? 'forslag' : 'felrapport'
}

export interface FelrapportInput {
  deal: Deal
  calls: ResolvedCall[]
  /** null = given passades ut (inget kortspel). */
  contract: Contract | null
  /** Färdigspelade stick, i ordning (tom lista om inget spelats). */
  tricks: Trick[]
  /** Vald kategori (ur REPORT_CATEGORIES eller BIDDING_REPORT_CATEGORIES). */
  category: string
  description: string
  /**
   * "Rätt bud + varför" (ägarbeslut 2026-10-06): vad som BORDE ha hänt och
   * skälet. Ifyllt är det facit för /felrapporter; tomt markeras tydligt i
   * rapporten så kommandot frågar ägaren i stället för att gissa.
   */
  expected?: string
  /** Var i appen rapporten skrevs ("Spela kort", "Dagens tävling", …). */
  lage?: string
}

const SUITS: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const SUIT_LETTER: Record<Suit, string> = { spades: 'S', hearts: 'H', diamonds: 'D', clubs: 'C' }
const SUIT_SYMBOL: Record<Suit, string> = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' }
const RANK_DESC: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']
const SEATS_REPORT: Seat[] = ['N', 'E', 'S', 'W']

const STRAIN_CODE: Record<string, string> = {
  clubs: 'C',
  diamonds: 'D',
  hearts: 'H',
  spades: 'S',
  NT: 'NT',
}

const VUL_TEXT: Record<Vulnerability, string> = {
  none: 'Ingen i zon',
  ns: 'NS i zon',
  ew: 'ÖV i zon',
  all: 'Alla i zon',
}

/**
 * En hand som kort text i övningarnas format: "S:AK974 H:K83 D:Q6 C:J52".
 * Tian skrivs "T", tom färg "-". Rundresa garanterad: parseHand(formatHand(h))
 * ger tillbaka exakt samma kort.
 */
export function formatHand(hand: Hand): string {
  return SUITS.map((suit) => {
    const ranks = RANK_DESC.filter((r) => hand.some((c) => c.suit === suit && c.rank === r))
    const text = ranks.map((r) => (r === '10' ? 'T' : r)).join('')
    return `${SUIT_LETTER[suit]}:${text || '-'}`
  }).join(' ')
}

/** Ett kort som kort ASCII-text för stick-raderna: "SA", "HT", "D5". */
function cardCode(card: Card): string {
  return `${SUIT_LETTER[card.suit]}${card.rank === '10' ? 'T' : card.rank}`
}

/** Ett bud med färgsymbol för läsbar text: "1H" → "1♥" (P/X/XX/NT orörda). */
function bidPretty(bid: string): string {
  const m = bid.match(/^([1-7])([SHDC])$/)
  if (!m) return bid
  const suit = SUITS.find((s) => SUIT_LETTER[s] === m[2])!
  return `${m[1]}${SUIT_SYMBOL[suit]}`
}

/** En hand med färgsymboler för läsbar text: "♠AKQ4 ♥32 ♦QJ2 ♣T987". */
function handPretty(hand: Hand): string {
  return SUITS.map((suit) => {
    const ranks = RANK_DESC.filter((r) => hand.some((c) => c.suit === suit && c.rank === r))
    const text = ranks.map((r) => (r === '10' ? 'T' : r)).join('')
    return `${SUIT_SYMBOL[suit]}${text || '—'}`
  }).join(' ')
}

/** Kontraktet som läsbar text: "4♥ av Nord" (dubblat: "4♥ X av Nord"). */
function contractPretty(contract: Contract): string {
  const code = STRAIN_CODE[contract.strain]
  const suit = SUITS.find((s) => SUIT_LETTER[s] === code)
  const dbl = contract.doubled ? ` ${contract.doubled}` : ''
  return `${contract.level}${suit ? SUIT_SYMBOL[suit] : 'NT'}${dbl} av ${SEAT_LABEL[contract.declarer]}`
}

/** Spelförarens sticksumma + resultattext ("9 stick — 1 bet"), om given spelats. */
function resultPretty(contract: Contract, tricks: Trick[]): string {
  const declSide = side(contract.declarer)
  const won = tricks.filter((t) => side(t.winner) === declSide).length
  const needed = 6 + contract.level
  const diff = won - needed
  if (tricks.length < 13) return `${won} stick efter ${tricks.length} spelade stick (given ej färdigspelad)`
  return diff >= 0 ? `hemma, ${won} stick${diff > 0 ? ` (+${diff})` : ''}` : `${-diff} bet (${won} stick)`
}

/**
 * Utan kontrakt är given antingen UTPASSAD (färdig auktion utan bud) eller
 * rapporterad MITT I budgivningen (felrapport #58 skickades efter sju bud och
 * skrevs "passades ut" — vilseledande). Skiljs på om auktionen är komplett.
 */
function auctionOngoing(input: FelrapportInput): boolean {
  return !input.contract && !auctionComplete(input.calls)
}

export function buildIssueTitle(input: FelrapportInput): string {
  const what = input.contract
    ? `${input.contract.level}${STRAIN_CODE[input.contract.strain]} av ${input.contract.declarer}`
    : auctionOngoing(input)
      ? 'budgivning pågår'
      : 'utpassad'
  // Förslagskategorin bär redan sitt "Förslag: " — felen får "Felrapport: ".
  const rubrik = rapportTyp(input.category) === 'forslag' ? input.category : `Felrapport: ${input.category}`
  return `${rubrik} (bricka ${input.deal.board}, ${what})`
}

export function buildIssueBody(input: FelrapportInput): string {
  const { deal, calls, contract, tricks, category, description, expected, lage } = input

  const lines: string[] = []
  lines.push(`**Kategori:** ${category}`)
  lines.push('')
  lines.push(description.trim() || '_(ingen beskrivning)_')
  lines.push('')
  lines.push(`**Rätt bud + varför:** ${expected?.trim() || '_(inte angivet)_'}`)
  lines.push('')
  // Var rapporten skrevs + vilken version av appen (motorstämpeln = byggets
  // commit) — så /felrapporter kan reproducera mot rätt motor.
  lines.push(`**Läge:** ${lage ?? 'okänt'} · **Version:** ${MOTORSTAMPEL ?? 'utvecklingsbygge'}`)
  lines.push('')
  lines.push(`**Bricka ${deal.board}** · Giv: ${SEAT_LABEL[deal.dealer]} · ${VUL_TEXT[deal.vulnerability]}`)
  if (contract) {
    lines.push(`**Kontrakt:** ${contractPretty(contract)} · **Resultat:** ${resultPretty(contract, tricks)}`)
  } else if (auctionOngoing(input)) {
    lines.push('**Kontrakt:** inget ännu — rapporten skickades mitt i budgivningen.')
  } else {
    lines.push('**Kontrakt:** given passades ut.')
  }
  lines.push('')
  lines.push('**Händerna**')
  for (const seat of SEATS_REPORT) lines.push(`- ${SEAT_LABEL[seat]}: ${handPretty(deal.hands[seat])}`)
  lines.push('')
  lines.push(
    `**Budgivningen** (från ${SEAT_LABEL[deal.dealer]}): ${calls.map((c) => bidPretty(c.bid)).join(' – ')}`,
  )
  lines.push('')
  lines.push('### Maskinläsbar giv (rör ej — läses av /felrapporter)')
  lines.push('```felrapport')
  lines.push('version: 1')
  lines.push(`bricka: ${deal.board}`)
  lines.push(`giv: ${deal.dealer}`)
  lines.push(`zon: ${deal.vulnerability}`)
  for (const seat of SEATS_REPORT) lines.push(`hand ${seat}: ${formatHand(deal.hands[seat])}`)
  lines.push(`budgivning: ${calls.map((c) => c.bid).join(' ')}`)
  lines.push(
    contract
      ? `kontrakt: ${contract.level}${STRAIN_CODE[contract.strain]} ${contract.declarer}`
      : auctionOngoing(input)
        ? 'kontrakt: pågår'
        : 'kontrakt: utpassad',
  )
  tricks.forEach((t, i) => {
    lines.push(`stick ${i + 1}: ${t.leader} ${t.cards.map((pc) => cardCode(pc.card)).join(' ')} (${t.winner})`)
  })
  lines.push('```')
  return lines.join('\n')
}

/** Hela rapporten, färdig att skicka till den öppna mottagaren. */
export function byggRapport(input: FelrapportInput): Rapport {
  return { typ: rapportTyp(input.category), titel: buildIssueTitle(input), text: buildIssueBody(input) }
}
