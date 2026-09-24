// KONTROLLBUD — den allmänna regeln (ägarbeslut 2026-09-24): "när färgen är satt
// (oavsett hög- eller lågfärg) är en ny bjuden färg alltid ett kontrollbud" —
// tillsvidare bara på 4-läget. Förr fanns kontrollbuden inkopplade budföljd för
// budföljd (Jacoby, NMF, inverterad minor, 2♣, 2/1-höjningen …) i `slamSituation`;
// varje budföljd utanför listan blev ett hål där partnern PASSADE kontrollbudet
// (senast 1♣–1♥–3♥–4♣). Den här modulen läser läget ur AUKTIONEN (ärlig inferens:
// bara buden, aldrig någon hand) och är reserven när ingen specifik slamgren träffar.
//
// Undantag: 3♠ när hjärter är satt är ett kontrollbud (enda på 3-läget).
//
// Satt färg = en färg som BÅDA i paret bjudit naturligt (betydelselagret:
// inte konstgjort/alertat — Stayman, överföringar, splinter, fjärde färg och
// kontrollbud räknas inte som att bjuda färgen). I lågfärg ligger 4-läget alltid
// över 3NT, så stoppvisningen under 3NT (§4.2) står orörd.

import type { Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { meaningOf } from './auction-meaning'
import { parseContractBid, PARTNER, SUIT_OF_LETTER } from './auction-facts'

export interface Kontrollbudslage {
  /** Den satta trumfen. */
  trump: Suit
  /** Index i `history` för det första kontrollbudet (4-läget, ny färg). */
  cueIndex: number
}

const STRAINS = ['C', 'D', 'H', 'S', 'NT']
const rank = (bid: string): number => {
  const c = parseContractBid(bid)
  return c ? (c.level - 1) * 5 + STRAINS.indexOf(c.strain) : -1
}
const gameRank = (t: Suit): number => rank(t === 'hearts' || t === 'spades' ? `4${t === 'hearts' ? 'H' : 'S'}` : `5${t === 'clubs' ? 'C' : 'D'}`)

/** Alertade bud som ändå bjuder färgen (höjningen/svaret visar den) och oalertade
 *  bud som är konstgjorda (kortfärgsvisning). */
const NATURLIG_MED_ALERT = /inverterad minor|Stayman-svar/i
const KONSTLAD_UTAN_ALERT = /kortfärg|splinter|relä/i
export const naturligt = (m: { alert: boolean; rule?: string }): boolean =>
  (!m.alert || NATURLIG_MED_ALERT.test(m.rule ?? '')) && !KONSTLAD_UTAN_ALERT.test(m.rule ?? '')

/** Är bud nr `i` i auktionen ett naturligt färgbud (bjuder färgen på riktigt)? */
export const naturligtBud = (history: ResolvedCall[], i: number): boolean => naturligt(meaningOf(history, i))

/** Den färg paret satt (båda bjudit den naturligt) före index `fore`, och var den sattes. */
export function sattFarg(history: ResolvedCall[], seat: Seat, fore = history.length): { trump: Suit; index: number } | null {
  const vi = new Set<Seat>([seat, PARTNER[seat]])
  const bjudenAv = new Map<Suit, Set<Seat>>()
  for (let i = 0; i < fore; i++) {
    const c = history[i]
    if (!vi.has(c.seat)) continue
    const cb = parseContractBid(c.bid)
    if (!cb || cb.strain === 'NT') continue
    if (!naturligt(meaningOf(history, i))) continue
    const s = SUIT_OF_LETTER[cb.strain]
    const av = bjudenAv.get(s) ?? new Set<Seat>()
    av.add(c.seat)
    bjudenAv.set(s, av)
    if (av.size === 2) return { trump: s, index: i }
  }
  return null
}

/**
 * Kontrollbudsläget i auktionen för `seat`s sida: färgen är satt och därefter
 * har någon av oss bjudit en NY färg på 4-läget — under utgång, eller (i
 * högfärgstrumf) ett steg över den (4♠ i hjärter). Det första sådana budet
 * öppnar kontrollbudsronden. null = inget kontrollbud i auktionen.
 */
export function kontrollbudslage(history: ResolvedCall[], seat: Seat): Kontrollbudslage | null {
  const satt = sattFarg(history, seat)
  if (!satt) return null
  const vi = new Set<Seat>([seat, PARTNER[seat]])
  const letter = satt.trump === 'clubs' ? 'C' : satt.trump === 'diamonds' ? 'D' : satt.trump === 'hearts' ? 'H' : 'S'
  const femM = rank(`5${letter}`)
  // Högfärger vår sida bjudit naturligt — utgång i en sådan (4♥/4♠) är till spel.
  const egnaHogfarger = new Set<string>()
  for (let i = 0; i <= satt.index; i++) {
    const cb = parseContractBid(history[i].bid)
    if (vi.has(history[i].seat) && cb && (cb.strain === 'H' || cb.strain === 'S') && naturligt(meaningOf(history, i))) egnaHogfarger.add(cb.strain)
  }
  for (let i = satt.index + 1; i < history.length; i++) {
    const c = history[i]
    if (!vi.has(c.seat)) continue
    const cb = parseContractBid(c.bid)
    if (!cb) continue
    if (cb.level === 4 && egnaHogfarger.has(cb.strain)) return null // höjning till utgång i vår högfärg (1♦–1♠–2♣–2♦–2♥–4♥)
    if ((cb.strain === 'H' || cb.strain === 'S') && naturligt(meaningOf(history, i))) egnaHogfarger.add(cb.strain)
    if (cb.strain === 'NT' || cb.strain === letter) {
      if (cb.level >= 4) return null // 4NT/utgång före något kontrollbud → ingen kontrollbudsrond att läsa här
      continue
    }
    // Ny färg under 4-läget är inte kontrollbud (tillsvidare) — utom 3♠ när hjärter
    // är satt (ägarbeslut 2026-09-24: 1♣–1♥–3♥–3♠; enda kontrollbudet på 3-läget).
    if (cb.level === 3 && satt.trump === 'hearts' && cb.strain === 'S') return { trump: satt.trump, cueIndex: i }
    // Färgbud under 4-läget (stoppvisning under 3NT, hjälpfärgsinvit) är inte
    // kontrollbud — läsningen fortsätter förbi dem.
    if (cb.level < 4) continue
    if (cb.level > 4) return null
    const r = rank(c.bid)
    const major = satt.trump === 'hearts' || satt.trump === 'spades'
    if (r < gameRank(satt.trump) || (major && r < femM)) return { trump: satt.trump, cueIndex: i }
    return null
  }
  return null
}
