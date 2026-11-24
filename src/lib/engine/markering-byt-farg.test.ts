// FACIT FÖRE FIX — markeringsinventeringen 2026-11-24: UTSPELAREN LYDER
// PARTNERNS AVSKRÄCKNING (§8.5, ägarbeslut 2026-11-24).
//
// Förr fortsatte motspelaren alltid utspelsfärgen, vad partnern än lade. Nu:
//
//   • TRUMFKONTRAKT: partnern avskräcker → byt färg direkt. Men läs bordet:
//     sitter damen ensam kvar på träkarlen tas kungen; med kn-x-x där sparas den.
//   • SANG, honnörsutspel (kungen från K-D-10-x): partnern avskräcker → byt färg
//     (spelföraren har ess-knekt) och vänta på att partnern spelar igenom.
//   • SANG, hacka från lång färg: fortsätt färgen ändå — längden ger sticken.
//   • Bytesfärgen: ett säkert spel (sekvens) eller bordets svaghet / igenom
//     bordets brutna honnörer.
//
// Avskräckning = partnerns bevisligen lägsta kort (alla lägre syns för mig).

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand } from '../bidding'
import { botCardReasoned } from './play-bot'
import { playCard, startPlay, type Contract, type PlayState } from './play'

const SUIT: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const card = (t: string): Card => ({ suit: SUIT[t[0]], rank: (t.slice(1) === 'T' ? '10' : t.slice(1)) as Rank })
const deal = (N: string, E: string, S: string, W: string): Deal => {
  const hands = { N: parseHand(N), E: parseHand(E), S: parseHand(S), W: parseHand(W) }
  for (const s of ['N', 'E', 'S', 'W'] as Seat[]) if (hands[s].length !== 13) throw new Error(`${s} har ${hands[s].length} kort`)
  const alla = new Set((['N', 'E', 'S', 'W'] as Seat[]).flatMap((s) => hands[s].map((c) => c.suit + c.rank)))
  if (alla.size !== 52) throw new Error('given har dubbletter')
  return { id: 't', board: 1, dealer: 'S', vulnerability: 'none', hands } as Deal
}
const spela = (d: Deal, strain: Contract['strain'], sekvens: string): PlayState =>
  sekvens.split(' ').reduce((s, k) => playCard(s, card(k)), startPlay(d, { level: 4, strain, declarer: 'S' }))

describe('trumfkontrakt: esset från ess-kung, partnern avskräcker', () => {
  // Väst ♥A-K-7-5, bordet ♥kn-6-4, Öst ♥9-3-2, Syd ♥D-10-8. Väst har ♦kn-10-9-4.
  const KNEKT_TREDJE = deal(
    'S:KQ54 H:J64 D:A72 C:KQ3',
    'S:76 H:932 D:K853 C:J974',
    'S:AJT98 H:QT8 D:Q6 C:AT5',
    'S:32 H:AK75 D:JT94 C:862',
  )

  it('bordet har kn-x kvar → kungen SPARAS och Väst byter till sin säkra sekvens (♦kn)', () => {
    const val = botCardReasoned(spela(KNEKT_TREDJE, 'spades', 'HA H4 H2 H8'), 'W')
    expect(val.card).toEqual(card('DJ'))
    expect(val.reason).toMatch(/avskräck/i)
  })

  it('partnern UPPMUNTRAR (♥9) → Väst fortsätter färgen', () => {
    const val = botCardReasoned(spela(KNEKT_TREDJE, 'spades', 'HA H4 H9 H8'), 'W')
    expect(val.card.suit).toBe('hearts')
  })

  it('trean med tvåan osedd är inte bevisligen lägst → ingen avskräckning läst, färgen fortsätts', () => {
    const val = botCardReasoned(spela(KNEKT_TREDJE, 'spades', 'HA H4 H3 H8'), 'W')
    expect(val.card.suit).toBe('hearts')
  })

  // Väst ♥A-K-7-5, bordet ♥D-4, Öst ♥9-6-3-2, Syd ♥kn-10-8.
  const DAM_ANDRA = deal(
    'S:KQ54 H:Q4 D:A72 C:KQ73',
    'S:76 H:9632 D:K853 C:J94',
    'S:AJT98 H:JT8 D:Q6 C:AT5',
    'S:32 H:AK75 D:JT94 C:862',
  )

  it('damen sitter ENSAM kvar på bordet → Väst tar kungen', () => {
    const val = botCardReasoned(spela(DAM_ANDRA, 'spades', 'HA H4 H2 H8'), 'W')
    expect(val.card).toEqual(card('HK'))
  })
})

describe('sang: kungen från K-D-10-x, partnern avskräcker', () => {
  // Väst ♥K-D-10-5, bordet ♥7-2, Öst ♥9-4-3, Syd ♥A-kn-8-6 (Syd kryper).
  const BATH = deal(
    'S:K54 H:72 D:AKJ4 C:QJT2',
    'S:8763 H:943 D:873 C:965',
    'S:AQ2 H:AJ86 D:QT9 C:AK7',
    'S:JT9 H:KQT5 D:652 C:843',
  )

  it('kungen får behålla sticket men partnern lade sitt lägsta → Väst byter färg (♠kn), inte ♥D in i ess-knekt', () => {
    const val = botCardReasoned(spela(BATH, 'NT', 'HK H2 H3 H6'), 'W')
    expect(val.card).toEqual(card('SJ'))
    expect(val.reason).toMatch(/avskräck/i)
  })
})

describe('hacka från lång färg, partnern avskräcker', () => {
  // Väst ♥K-10-7-4-2 och ♣K som ingång. Bordet ♥A-6, Öst ♥9-8-3, Syd ♥D-kn-5.
  const LANG = deal(
    'S:K54 H:A6 D:AKJ4 C:QJT2',
    'S:7632 H:983 D:873 C:965',
    'S:AQJT H:QJ5 D:QT9 C:A87',
    'S:98 H:KT742 D:652 C:K43',
  )
  const SEKVENS = 'H4 HA H3 H5 CQ C5 C7 CK'

  it('i SANG fortsätter Väst sin långa färg ändå', () => {
    expect(botCardReasoned(spela(LANG, 'NT', SEKVENS), 'W').card.suit).toBe('hearts')
  })

  it('i TRUMFKONTRAKT byter Väst färg', () => {
    const val = botCardReasoned(spela(LANG, 'spades', SEKVENS), 'W')
    expect(val.card.suit).not.toBe('hearts')
    expect(val.card.suit).not.toBe('spades')
  })
})

// Granskningen av mätgivarna 20260752 och 20260798 (2026-11-24): i SANG byter
// Väst bara när ett kort till i färgen kan SKÄNKA ett stick — när det finns en
// lucka mellan Västs två högsta kort (K-D-10: knekten ute). Är färgen TÄT i
// toppen (D-kn kvar, eller D-9-8 med knekt och tia spelade) kostar fortsättningen
// inget, och färgen ska drivas vidare.
describe('sang: honnörsutspel från en TÄT färg, partnern avskräcker → fortsätt', () => {
  // Väst ♦K-D-kn-10-7, bordet ♦E-9-6-2 (kryper), Öst ♦8-4, Syd ♦5-3.
  const TAT = deal(
    'S:K54 H:KQ6 D:A962 C:QJT',
    'S:7632 H:985 D:84 C:9753',
    'S:AQJT H:AJT2 D:53 C:AK4',
    'S:98 H:743 D:KQJT7 C:862',
  )

  it('K-D-kn-10: kungen fick sticket, Öst lade sitt lägsta → Väst fortsätter med ruter', () => {
    expect(botCardReasoned(spela(TAT, 'NT', 'DK D2 D4 D3'), 'W').card.suit).toBe('diamonds')
  })

  // Väst ♣D-10-9-8, bordet ♣K-kn, Öst ♣7-5-2, Syd ♣E-6-4-3. Syd spelar ruter själv.
  const INRE = deal(
    'S:A8642 H:J7 D:A543 C:KJ',
    'S:KJ75 H:6432 D:T6 C:752',
    'S:Q9 H:AK9 D:KJ82 C:A643',
    'S:T3 H:QT85 D:Q97 C:QT98',
  )
  const SEKVENS = 'CT CJ C2 C3 DA D6 D2 D7 D3 DT DJ DQ'

  it('D-9-8 kvar med knekt och tia spelade → Väst fortsätter klövern', () => {
    expect(botCardReasoned(spela(INRE, 'NT', SEKVENS), 'W').card.suit).toBe('clubs')
  })

  it('i trumfkontrakt byter Väst — men aldrig till färgen spelföraren själv driver (ruter)', () => {
    const val = botCardReasoned(spela(INRE, 'spades', SEKVENS), 'W', { motstandarfarger: ['hearts'] })
    expect(val.card.suit).toBe('hearts')
  })
})
