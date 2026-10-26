// FACIT FÖRE FIX — felrapporterna #105 och #106 (GitHub-issues, 2026-10-18 och
// 2026-10-24): regeln "fortsätt motspelets utspelsfärg" (§8) tittade inte på
// träkarlens SYNLIGA kort. Två vakter (§8.11):
//
// #105 — 3♣ av Väst, bricka 7 (giv Syd, alla i zon). Nord spelade ut ♥Q (QJ2);
// träkarlen (Öst) la ♥8 ur ♥A8, Väst tog ♥K. När Nord kom in på ♦A i stick 4
// fortsatte han hjärter — med ♥J rakt in i träkarlens ENSAMMA ♥A. Ägaren: "Nord
// spelar kn mot ensamt ess på bordet. Det kostar oss ett stick på slutet. Spela
// låg hjärter istället så växer knekt till att bli stor." Träkarlen spelar näst
// och hans lägsta kort i färgen slår allt Nord har → sticket är bordets vad Nord
// än lägger: lägg LÄGSTA kortet och spara honnören (♥J blir stor över Västs ♥T43
// när esset är borta). Double-dummy skiljer inte korten här (2 stick för NS
// oavsett), facit är principen ur ägarens ord.
//
// #106 — 3NT av Öst, bricka 10 (giv Öst, alla i zon). Syd spelade ut ♠5 (dummy
// Väst ♠AKJ94 bjöd 1♠), träkarlen tog ♠K. Syd bytte till ♥6 i stick 4, Nord tog
// ♥A över bordets ♥J — och fortsatte "utspelsfärgen" med ♠Q ur ♠Q7 upp mot
// träkarlens ♠AJ94 som spelar sist. Ägaren: "Nord lägger sin spader dam och gör
// bordets kort stora, det är inte ett bra spel." DD per kort efter stick 4
// (bridge-dds, kommandot i testet): ♠Q/♠7 = 0 stick för NS, varje hjärter eller
// klöver = 1. Vakten: led aldrig upp mot träkarlens styrka i utspelsfärgen
// (bordet spelar sist, håller färgens mästare, minst två kort och minst lika
// många som jag) — fortsätt då partnerns senaste bytesfärg (hjärter) i stället.
//
// Hp räknade med kod (hcp/parseHand): #105 N 11 · E 11 · S 5 · W 13 = 40;
// #106 N 6 · E 7 · S 6 · W 21 = 40. Kort 13/13/13/13 i båda.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { hcp } from './hand'
import { mulberry32 } from './deal'
import { botCardSmartReasoned } from './play-bot'
import { playCard, startPlay, type Contract, type PlayState } from './play'
import { getDds, solveAllCards } from './revisor-dds'

const SU: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const c = (code: string): Card => ({ suit: SU[code[0]], rank: (code[1] === 'T' ? '10' : code[1]) as Rank })
const ORDER: Seat[] = ['N', 'E', 'S', 'W']
const H = (dealer: Seat, s: string): ResolvedCall[] => {
  let seat = dealer
  return s.split(' ').map((b) => { const r = { seat, bid: b } as ResolvedCall; seat = ORDER[(ORDER.indexOf(seat) + 1) % 4]; return r })
}
const spela = (st: PlayState, kort: string): PlayState => {
  for (const k of kort.split(' ')) st = playCard(st, c(k))
  return st
}
const summa = (d: Deal) => ORDER.reduce((a, s) => a + hcp(d.hands[s]), 0)

// ---------------------------------------------------------------- #105
const D105: Deal = { id: 'felrapport-105', board: 7, dealer: 'S', vulnerability: 'all', hands: {
  N: parseHand('S:Q872 H:QJ2 D:A82 C:QT3'), E: parseHand('S:T64 H:A8 D:K975 C:KJ86'),
  S: parseHand('S:AJ95 H:9765 D:T643 C:4'), W: parseHand('S:K3 H:KT43 D:QJ C:A9752') } }
const CALLS105 = H('S', 'P 1C P 2C P 2H P 3C P P P')
const K105: Contract = { declarer: 'W', strain: 'clubs', level: 3 }
/** Efter fyra stick: ♥Q-♥8-♥5-♥K · ♣A-♣3-♣6-♣4 · ♣5-♣T-♣K-♥6 · ♦7-♦3-♦J-♦A — Nord på lead. */
const efterFyra105 = () => spela(startPlay(D105, K105), 'HQ H8 H5 HK CA C3 C6 C4 C5 CT CK H6 D7 D3 DJ DA')

// ---------------------------------------------------------------- #106
const D106: Deal = { id: 'felrapport-106', board: 10, dealer: 'E', vulnerability: 'all', hands: {
  N: parseHand('S:Q72 H:A432 D:52 C:9652'), E: parseHand('S:63 H:KT5 D:JT876 C:K87'),
  S: parseHand('S:T85 H:Q9876 D:K9 C:JT3'), W: parseHand('S:AKJ94 H:J D:AQ43 C:AQ4') } }
const CALLS106 = H('E', 'P P 1S P 1NT P 3D P 3NT P P P')
const K106: Contract = { declarer: 'E', strain: 'NT', level: 3 }
/** Efter fyra stick: ♠5-♠K-♠2-♠3 · ♦A-♦2-♦6-♦9 · ♦3-♦5-♦7-♦K · ♥6-♥J-♥A-♥5 — Nord på lead. */
const efterFyra106 = () => spela(startPlay(D106, K106), 'S5 SK S2 S3 DA D2 D6 D9 D3 D5 D7 DK H6 HJ HA H5')

describe('Felrapport #105 — ♥J in i träkarlens ensamma ♥A (§8.11 a)', () => {
  it('given är rätt återskapad: 40 hp, Nord på lead i stick 5 med ♥J2 kvar', () => {
    expect(summa(D105)).toBe(40)
    const st = efterFyra105()
    expect(st.toAct).toBe('N')
    expect(st.hands.N.filter((k) => k.suit === 'hearts').map((k) => k.rank)).toEqual(['J', '2'])
    expect(st.hands.E.filter((k) => k.suit === 'hearts').map((k) => k.rank)).toEqual(['A'])
  })
  it('Nord spelar ♥2, inte ♥J — bordets ess tar sticket vad jag än lägger (ägarens facit)', () => {
    const st = efterFyra105()
    for (const seed of [1, 2, 3]) {
      const val = botCardSmartReasoned(st, 'N', CALLS105, { rng: mulberry32(seed) })
      expect(val.card).toEqual(c('H2'))
    }
  })
})

describe('Felrapport #106 — ♠Q upp mot träkarlens ♠AJ94 (§8.11 b)', () => {
  it('given är rätt återskapad: 40 hp, Nord på lead i stick 5 med ♠Q7', () => {
    expect(summa(D106)).toBe(40)
    const st = efterFyra106()
    expect(st.toAct).toBe('N')
    expect(st.hands.N.filter((k) => k.suit === 'spades').map((k) => k.rank)).toEqual(['Q', '7'])
    expect(st.hands.W.filter((k) => k.suit === 'spades').map((k) => k.rank)).toEqual(['A', 'J', '9', '4'])
  })
  it('DD-lås (bridge-dds): spader ger 0 stick för NS, hjärter/klöver 1', async () => {
    // Kör: npx vitest run src/lib/engine/play-bot-fortsatt-utspelsfarg.test.ts
    const dd = solveAllCards(await getDds(), efterFyra106())
    const poang = (k: string) => dd.find((p) => p.card.suit === c(k).suit && p.card.rank === c(k).rank)?.score
    expect(poang('SQ')).toBe(0)
    expect(poang('S7')).toBe(0)
    expect(poang('H2')).toBe(1)
    expect(poang('C2')).toBe(1)
  })
  it('Nord leder INTE spader (ägarens facit) — utan partnerns bytesfärg hjärter', () => {
    const st = efterFyra106()
    for (const seed of [1, 2, 3]) {
      const val = botCardSmartReasoned(st, 'N', CALLS106, { rng: mulberry32(seed) })
      expect(val.card.suit).not.toBe('spades')
      expect(val.card.suit).toBe('hearts')
    }
  })
})
