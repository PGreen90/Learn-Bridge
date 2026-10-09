// FACIT FÖRE FIX — felrapport #101 (2026-10-07): "Nord tappar ett stick. Måste
// spela klöver dam. Sista chansen."
//
// 4♠ av Öst, bricka 2 (giv Öst, NS i zon). Efter sex stick har försvaret tre
// (♦8, ♦9, ♣A) och behöver ETT till för bet. Nord är på utspel med ♥Q97 ♦Q ♣Q62
// och ♣Q är ett SÄKERT stick: ♣A/♣K har gått, träkarlen (Väst) har klöver kvar
// och spelföraren ledde just klöver. En människa tar det sticket NU — sista
// chansen innan spelföraren kan saka bort sin klöverförlorare. Boten (Monte-Carlo
// med 22–24 sampel) röstade oftast på ♥7 (double-dummy lika bra, men bygger på
// att spelföraren inte kan undkomma klöverförloraren) och ibland på ♣2 (−1).
//
// Double-dummy (doubleDummyDeclarerRemaining, 7 kort kvar): ♣Q → spelföraren 9
// (bet), ♥Q/♥9/♥7/♦Q → 9, ♣6/♣2 → 10 (hemma). Hp räknade med kod:
// N 13 · E 13 · S 6 · W 8 = 40.
//
// Regeln (§8.7): försvarare på utspel som behöver exakt ett stick till för bet
// och har ett säkert stick (mästaren i en sidofärg, träkarlen kan inte stjäla,
// spelföraren inte visat renons) tar det — före Monte-Carlo.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { mulberry32 } from './deal'
import { botCardSmartReasoned } from './play-bot'
import { doubleDummyDeclarerRemaining } from './dds'
import { playCard, startPlay, type Contract, type PlayState } from './play'

const SU: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const c = (code: string): Card => ({ suit: SU[code[0]], rank: (code[1] === 'T' ? '10' : code[1]) as Rank })

const deal: Deal = {
  id: 'felrapport-101',
  board: 2,
  dealer: 'E',
  vulnerability: 'ns',
  hands: {
    N: parseHand('S:T4 H:Q97 D:KQ94 C:AQ62'),
    E: parseHand('S:AKQ873 H:K D:63 C:JT85'),
    S: parseHand('S:J6 H:J642 D:AT87 C:974'),
    W: parseHand('S:952 H:AT853 D:J52 C:K3'),
  },
}

const calls: ResolvedCall[] = [
  { seat: 'E', bid: '1S' },
  { seat: 'S', bid: 'P' },
  { seat: 'W', bid: '2S' },
  { seat: 'N', bid: 'P' },
  { seat: 'E', bid: '4S' },
  { seat: 'S', bid: 'P' },
  { seat: 'W', bid: 'P' },
  { seat: 'N', bid: 'P' },
]

const contract: Contract = { declarer: 'E', strain: 'spades', level: 4 }

/** Läget efter de sex rapporterade sticken — Nord på utspel, NS 3 / ÖV 3. */
function efterSexStick(): PlayState {
  let st = startPlay(deal, contract)
  const spelat = 'D8 D2 D4 D3 D7 D5 D9 D6 DK S3 DT DJ SA S6 S2 S4 SK SJ S5 ST C5 C9 CK CA'.split(' ')
  for (const k of spelat) st = playCard(st, c(k))
  return st
}

describe('Felrapport #101 — ta det säkra stick som sätter kontraktet (§8.7)', () => {
  it('läget är återskapat: Nord på utspel med tre stick tagna', () => {
    const st = efterSexStick()
    expect(st.toAct).toBe('N')
    expect(st.tricksNS).toBe(3)
    expect(st.tricksEW).toBe(3)
  })

  it('Nord tar ♣Q nu — oavsett Monte-Carlo-slumpen', () => {
    const st = efterSexStick()
    for (const seed of [1, 2, 5, 6]) {
      const val = botCardSmartReasoned(st, 'N', calls, { rng: mulberry32(seed * 7919) })
      expect(val.card, `frö ${seed}`).toEqual(c('CQ'))
      expect(val.reason).toContain('sätter kontraktet')
    }
  })

  // Ägarens hårddragning (2026-10-07): Nord SER träkarlen och att den bara har
  // ETT kort kvar i klövern. Då är det förbjudet att spela lågt i färgen från
  // handen — byt färg eller (nio gånger av tio) ta mästaren. Samma läge men
  // försvaret har bara två stick (inte betsticket): ♣Q ändå.
  it('inte betsticket, men träkarlen har ett kort kvar i färgen → Nord tar ändå ♣Q, aldrig lågt', () => {
    const st: PlayState = { ...efterSexStick(), tricksNS: 2, tricksEW: 4 }
    for (const seed of [1, 2, 5, 6]) {
      const val = botCardSmartReasoned(st, 'N', calls, { rng: mulberry32(seed * 7919) })
      expect(val.card, `frö ${seed}`).toEqual(c('CQ'))
      expect(val.reason).toContain('ett kort kvar')
    }
  })

  it('DD-lås: ♣Q håller spelföraren på 9 (bet), en låg klöver släpper 10', () => {
    const st = efterSexStick()
    const efter = (card: Card) => {
      const hands = { ...st.hands, N: st.hands.N.filter((x) => !(x.suit === card.suit && x.rank === card.rank)) } as Record<Seat, Card[]>
      const n = doubleDummyDeclarerRemaining(hands, 'spades', 'E', [{ seat: 'N', card }], 'E', 50_000_000)
      return n === null ? null : n + st.tricksEW
    }
    expect(efter(c('CQ'))).toBe(9)
    expect(efter(c('C2'))).toBe(10)
  })
})

// FACIT FÖRE FIX — felrapport #102 (2026-10-08, bricka 5): "DD bör kunna säga att
// klöver skall spelas i exakt detta skede. Då betar vi kontraktet."
//
// 4♥ av Väst (giv Nord, NS i zon). Efter åtta stick har försvaret tre och behöver
// ETT till. Nord på utspel med ♦KT65 ♣T. ♦K är "mästare" (♦A/♦Q… nej: ♦Q sitter
// synlig i träkarlen Öst, ♦A är spelad) — men ALLA återstående ruter utanför Nords
// hand ligger i träkarlen: 13 − 7 spelade − 4 egna − 2 i bordet = 0 osedda.
// Spelföraren är alltså RENONS genom räkning (Syd sakade redan i stick 5) och
// har trumf kvar → ♦K stjäls. §8.7-regeln tittade bara på VISAD renons (sakning
// i färgen) och tog ♦K; Väst stal med ♥9 och kontraktet gick hem.
// Rätt: ♣T (partnern ledde ♣Q i stick 7 = ♣J bakom; Väst måste följa med ♣8).
// Double-dummy (doubleDummyDeclarerRemaining, 5 kort kvar): ♣T → 9 (bet),
// varje ruter → 10 (hemma). Hp räknade med kod: N 9 · E 6 · S 10 · W 15 = 40.

const DEAL_102: Deal = {
  id: 'felrapport-102',
  board: 5,
  dealer: 'N',
  vulnerability: 'ns',
  hands: {
    N: parseHand('S:QT H:8 D:KT8765 C:AT42'),
    E: parseHand('S:92 H:K6532 D:QJ43 C:65'),
    S: parseHand('S:A8763 H:QJ D:2 C:QJ973'),
    W: parseHand('S:KJ54 H:AT974 D:A9 C:K8'),
  },
}
const CALLS_102: ResolvedCall[] = [
  { seat: 'N', bid: '2D' }, { seat: 'E', bid: 'P' }, { seat: 'S', bid: 'P' }, { seat: 'W', bid: '2H' },
  { seat: 'N', bid: 'P' }, { seat: 'E', bid: '3H' }, { seat: 'S', bid: 'P' }, { seat: 'W', bid: '4H' },
  { seat: 'N', bid: 'P' }, { seat: 'E', bid: 'P' }, { seat: 'S', bid: 'P' },
]
const CONTRACT_102: Contract = { declarer: 'W', strain: 'hearts', level: 4 }

/** Läget efter de åtta rapporterade sticken — Nord på utspel, NS 3 / ÖV 5. */
function efterAttaStick(): PlayState {
  let st = startPlay(DEAL_102, CONTRACT_102)
  const spelat = 'D8 DJ D2 D9 H2 HJ HA H8 H7 C2 HK HQ H3 S3 H4 C4 DA D7 D3 C3 SK ST S2 SA CQ CK CA C5 SQ S9 S6 S4'.split(' ')
  for (const k of spelat) st = playCard(st, c(k))
  return st
}

describe('Felrapport #102 — mästaren är inget säkert stick när spelföraren är renons genom räkning (§8.7)', () => {
  it('läget är återskapat: Nord på utspel med ♦KT65 ♣T, försvaret behöver ett stick', () => {
    const st = efterAttaStick()
    expect(st.toAct).toBe('N')
    expect(st.tricksNS).toBe(3)
    expect(st.tricksEW).toBe(5)
    expect(st.hands.N.map((x) => `${x.suit[0]}${x.rank}`)).toEqual(['dK', 'd10', 'd6', 'd5', 'c10'])
  })

  it('Nord spelar ♣T — aldrig ♦K in i den räknade renonsen', () => {
    const st = efterAttaStick()
    for (const seed of [1, 2, 5, 6]) {
      const val = botCardSmartReasoned(st, 'N', CALLS_102, { rng: mulberry32(seed * 7919) })
      expect(val.card, `frö ${seed}: ${val.reason}`).toEqual(c('CT'))
      expect(val.reason).not.toContain('säkert stick')
    }
  })

  it('DD-lås: ♣T håller spelföraren på 9 (bet), varje ruter släpper 10', () => {
    const st = efterAttaStick()
    const efter = (card: Card) => {
      const hands = { ...st.hands, N: st.hands.N.filter((x) => !(x.suit === card.suit && x.rank === card.rank)) } as Record<Seat, Card[]>
      const n = doubleDummyDeclarerRemaining(hands, 'hearts', 'W', [{ seat: 'N', card }], 'E', 50_000_000)
      return n === null ? null : n + st.tricksEW
    }
    expect(efter(c('CT'))).toBe(9)
    expect(efter(c('DK'))).toBe(10)
    expect(efter(c('D5'))).toBe(10)
  })
})
