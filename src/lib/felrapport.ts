// Felrapportering från "Spela kort": gör om HELA given (händer, budgivning,
// kontrakt, spelade stick) till en förifylld GitHub-issue som ägaren öppnar
// och skickar med ett klick. Webbläsaren kan inte pusha till git — Issues är
// kanalen hem: kommandot /felrapporter läser rapporten, återskapar given som
// test (FACIT FÖRE FIX) och lagar felet.

import type { Card, Deal, Hand, Rank, Seat, Suit, Vulnerability } from '../types/bridge'
import { SEAT_LABEL, type ResolvedCall } from './bidding'
import { side, type Contract, type Trick } from './engine/play'

/** Kategorierna ägaren kan välja i rapportdialogen från Spela kort (hela given). */
export const REPORT_CATEGORIES = [
  'Felaktig budgivning',
  'Fel budförklaring',
  'Datorn spelade korten fel',
  'Fel i resultat/poäng',
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
  'Annat',
] as const

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

export function buildIssueTitle(input: FelrapportInput): string {
  const what = input.contract
    ? `${input.contract.level}${STRAIN_CODE[input.contract.strain]} av ${input.contract.declarer}`
    : 'utpassad'
  return `Felrapport: ${input.category} (bricka ${input.deal.board}, ${what})`
}

export function buildIssueBody(input: FelrapportInput): string {
  const { deal, calls, contract, tricks, category, description } = input

  const lines: string[] = []
  lines.push(`**Kategori:** ${category}`)
  lines.push('')
  lines.push(description.trim() || '_(ingen beskrivning)_')
  lines.push('')
  lines.push(`**Bricka ${deal.board}** · Giv: ${SEAT_LABEL[deal.dealer]} · ${VUL_TEXT[deal.vulnerability]}`)
  if (contract) {
    lines.push(`**Kontrakt:** ${contractPretty(contract)} · **Resultat:** ${resultPretty(contract, tricks)}`)
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
      : 'kontrakt: utpassad',
  )
  tricks.forEach((t, i) => {
    lines.push(`stick ${i + 1}: ${t.leader} ${t.cards.map((pc) => cardCode(pc.card)).join(' ')} (${t.winner})`)
  })
  lines.push('```')
  return lines.join('\n')
}

const ISSUES_NEW_URL = 'https://github.com/PGreen90/Learn-Bridge/issues/new'
const ISSUES_API_URL = 'https://api.github.com/repos/PGreen90/Learn-Bridge/issues'

/** Adressen till en förifylld GitHub-issue med hela rapporten. */
export function felrapportUrl(input: FelrapportInput): string {
  const params = new URLSearchParams({
    title: buildIssueTitle(input),
    body: buildIssueBody(input),
    labels: 'felrapport',
  })
  return `${ISSUES_NEW_URL}?${params.toString()}`
}

/** Resultatet av ett direktskick: adressen till den skapade issuen. */
export interface SubmitResult {
  issueUrl: string
}

/**
 * Skickar rapporten DIREKT till GitHub via API:t (ingen GitHub-sida öppnas).
 * Kräver en nyckel (fine-grained PAT med Issues: read/write på Learn-Bridge)
 * som ägaren skapat en gång; se Inställningar. Kastar ett Error med ett
 * begripligt svenskt meddelande om något går fel, så dialogen kan visa det
 * och falla tillbaka på att öppna GitHub-sidan.
 */
export async function submitFelrapport(
  input: FelrapportInput,
  token: string,
): Promise<SubmitResult> {
  let res: Response
  try {
    res = await fetch(ISSUES_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: buildIssueTitle(input),
        body: buildIssueBody(input),
        labels: ['felrapport'],
      }),
    })
  } catch {
    // Nätverksfel (offline, blockerad begäran) – fetch kastade innan svar.
    throw new Error('Kunde inte nå GitHub – kontrollera din internetanslutning.')
  }

  if (res.status === 201) {
    const data = (await res.json()) as { html_url?: string }
    return { issueUrl: data.html_url ?? ISSUES_API_URL }
  }

  if (res.status === 401) {
    throw new Error('Nyckeln godtogs inte (kan ha gått ut). Skapa en ny i Inställningar.')
  }
  if (res.status === 403 || res.status === 404) {
    throw new Error(
      'Nyckeln saknar behörighet till Learn-Bridge. Kontrollera att den gäller repot och har Issues: läs och skriv.',
    )
  }
  throw new Error(`GitHub svarade oväntat (felkod ${res.status}).`)
}
