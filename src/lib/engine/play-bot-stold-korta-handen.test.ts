// FACIT FÖRE FIX — fynd T (NU 2026-10-26, speldiagnosens S9): STÖLD I DEN KORTA
// TRUMFHANDEN FÖRE TRUMFDRAGNING OCH CASH. Spelförarsidan på lead i tumregel-
// fönstret (9–13 kort) i ett trumfkontrakt: är partnern (den synliga handen på
// vår sida) RENONS i en sidofärg, har trumf kvar och inte fler trumf än jag, och
// har jag en riktig förlorare i färgen (högst en nia, ingen säker vinnare), leds
// förloraren till stöld — före "drar trumf", "cashar säker vinnare" och reserv-
// ledningen "längsta färg". Dagens bot drog trumf eller cashade först och lät
// stölden gå förlorad.
//
// Byggd på DD-mätning per alternativ (fynd B-riggens dataset på dagens motor,
// `fyndb.probe.test.ts` FYNDB=1 → `fyndt-utvardera.probe.test.ts` FYNDT=1):
// kandidaten T1d ändrade 23 av 377 trumflägen, 6 bättre och 0 sämre (82 → 75
// stick); på datasetet från 2026-10-01 likaså 6/0 (89 → 82). Villkoret
// trumfmajoritet (T1g: inte fler trumf ute än vi har ihop) kostade inget av det
// och stoppar överstölden med svag trumf (låset "svag trumf (853 mot 97) drar
// inte" i play-bot.test.ts). De tre lägena här är tagna ur datasetet (DD-poängen
// per kort från bridge-dds står i kommentaren).
//
// Hp räknade med kod (hcp/parseHand) i första testet: alla tre givar = 40.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { hcp } from './hand'
import { mulberry32 } from './deal'
import { botCardSmartReasoned } from './play-bot'
import { playCard, startPlay, type Contract, type PlayState } from './play'

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
const val = (st: PlayState, seat: Seat, calls: ResolvedCall[]) => botCardSmartReasoned(st, seat, calls, { rng: mulberry32(1) })

// 20260756 — 2♣ av Väst, stick 5, Öst (träkarlen) på lead med ♠K5 ♥J7 ♦873 ♣64;
// Väst ♠AQT4 ♥– ♦Q54 ♣87 (renons i hjärter, två trumf mot Östs två). Boten ledde
// ♦3 ("längsta färg"); DD per kort: ♠5/♠K/♥7/♥J = 8, ♣ = 7, ♦ = 6. Hjärterförloraren
// ♥7 till stöld i Väst.
const D756: Deal = { id: 'fyndt-20260756', board: 1, dealer: 'S', vulnerability: 'none', hands: {
  N: parseHand('S:863 H:AQ84 D:KT62 C:Q9'), E: parseHand('S:K5 H:J75 D:873 C:AKJ64'),
  S: parseHand('S:J972 H:T9632 D:AJ9 C:T'), W: parseHand('S:AQT4 H:K D:Q54 C:87532') } }
const C756 = H('S', 'P 1C X XX 1H P P 2C P P P')
const K756: Contract = { declarer: 'W', strain: 'clubs', level: 2 }
const st756 = () => spela(startPlay(D756, K756), 'H8 H5 H2 HK C2 C9 CK CT CA H3 C3 CQ CJ H6 C5 S3')

// 20260908 — 4♥ av Nord, stick 3, Nord på lead med ♠A876 ♥QT64 ♦A ♣32; Syd
// ♠J53 ♥K52 ♦QJ9832 ♣– (renons i klöver, tre trumf mot Nords fyra). Boten drog
// trumf (♥6); DD per kort: ♦A = 9, ♣3/♣2/♠ = 8, ♥ = 7. Klöverförloraren ♣2 till
// stöld i Syd (DD:s allra bästa, ♦A, är en annan plan — stölden slår trumfdragningen).
const D908: Deal = { id: 'fyndt-20260908', board: 2, dealer: 'N', vulnerability: 'none', hands: {
  N: parseHand('S:A876 H:AQT64 D:A C:A32'), E: parseHand('S:92 H:9873 D:K754 C:964'),
  S: parseHand('S:J53 H:K52 D:QJ9832 C:T'), W: parseHand('S:KQT4 H:J D:T6 C:KQJ875') } }
const C908 = H('N', '1H P 1NT P 2S P 3H P 4H P P P')
const K908: Contract = { declarer: 'N', strain: 'hearts', level: 4 }
const st908 = () => spela(startPlay(D908, K908), 'C4 CT CJ CA HA H3 H2 HJ')

// 20260764 — 4♠ av Nord, stick 3, Syd (träkarlen) på lead med ♠QJ94 ♥AT95 ♦K75;
// Nord ♠T86 ♥– ♦964 ♣K9732 (renons i hjärter, tre trumf mot Syds fyra). Boten
// drog trumf (♠Q); DD per kort: ♥ = 8, ♠/♦ = 7. Hjärterförloraren ♥5 till stöld i Nord.
const D764: Deal = { id: 'fyndt-20260764', board: 3, dealer: 'E', vulnerability: 'none', hands: {
  N: parseHand('S:T862 H:4 D:964 C:K9732'), E: parseHand('S:K5 H:QJ3 D:QJ2 C:A8654'),
  S: parseHand('S:AQJ94 H:AKT95 D:K75 C:-'), W: parseHand('S:73 H:8762 D:AT83 C:QJT') } }
const C764 = H('E', '1C 2C X 2S 3C 4S P P P')
const K764: Contract = { declarer: 'N', strain: 'spades', level: 4 }
const st764 = () => spela(startPlay(D764, K764), 'HQ HK H6 H4 SA S3 S2 S5')

describe('fynd T — stöld i den korta trumfhanden före trumfdragning och cash (§8.12)', () => {
  it('givarna är rätt återskapade: 40 hp och rätt hand på lead', () => {
    expect(summa(D756)).toBe(40)
    expect(summa(D908)).toBe(40)
    expect(summa(D764)).toBe(40)
    expect(st756().toAct).toBe('E')
    expect(st908().toAct).toBe('N')
    expect(st764().toAct).toBe('S')
    expect(st756().hands.W.filter((k) => k.suit === 'hearts')).toHaveLength(0)
    expect(st908().hands.S.filter((k) => k.suit === 'clubs')).toHaveLength(0)
    expect(st764().hands.N.filter((k) => k.suit === 'hearts')).toHaveLength(0)
  })
  it('20260756: Öst leder ♥7 till stöld i Väst (lika många trumf), inte ♦3', () => {
    const v = val(st756(), 'E', C756)
    expect(v.card).toEqual(c('H7'))
    expect(v.reason).toMatch(/stöld|stjäl/)
  })
  it('20260908: Nord leder ♣2 till stöld i Syd i stället för att dra trumf', () => {
    expect(val(st908(), 'N', C908).card).toEqual(c('C2'))
  })
  it('20260764: Syd leder ♥5 till stöld i Nord i stället för att dra trumf', () => {
    expect(val(st764(), 'S', C764).card).toEqual(c('H5'))
  })
  // STJÄLHANDEN FULLFÖLJER (helmätningen S9 visade att ledningen var värdelös utan
  // detta: nettot blev −1 fast offline-mätningen var +7). Två följlägen:
  it('20260764 stick 2: Syd ledde ♥5, Väst lågt — Nord (renons) STJÄL i stället för att saka (DD 10 mot 8)', () => {
    // DD per kort (bridge-dds): ♠2/♠6/♠8/♠T = 10, ♦ = 9, ♣ = 8. Boten sakade ♣2 ("vaktar hotkorten").
    const st = spela(startPlay(D764, K764), 'HQ HK H6 H4 H5 H2')
    expect(st.toAct).toBe('N')
    const v = val(st, 'N', C764)
    expect(v.card.suit).toBe('spades')
    expect(v.reason).toMatch(/stjäl/)
  })
  it('20260778 stick 5: Nord ledde ♥5, Öst ♥6 — Syd (renons) stjäl LÅGT med ♠5, inte ♠J (DD 7 mot 5)', () => {
    // 3♠ av Nord. DD per kort: ♠5/♠6 = 7, ♣ = 6, ♠J = 5. Boten gick "upp med toppen" (§8.8) — fel i en stöld.
    const D778: Deal = { id: 'fyndt-20260778', board: 4, dealer: 'S', vulnerability: 'ew', hands: {
      N: parseHand('S:A8732 H:Q52 D:8752 C:4'), E: parseHand('S:T94 H:K8764 D:94 C:AT2'),
      S: parseHand('S:QJ65 H:J D:AQJ C:KQ653'), W: parseHand('S:K H:AT93 D:KT63 C:J987') } }
    expect(summa(D778)).toBe(40)
    const st = spela(startPlay(D778, { declarer: 'N', strain: 'spades', level: 3 }), 'D9 DJ DK D2 HA H2 H4 HJ D3 D5 D4 DQ SQ SK SA S4 H5 H6')
    expect(st.toAct).toBe('S')
    expect(val(st, 'S', H('S', '1C P 1S P 3S P P P')).card).toEqual(c('S5'))
  })
  it('ingen stöld när partnern har FLER trumf än jag (lång hand stjäl inte)', () => {
    // Samma giv som 20260764 men sett från Nord: Nord har tre trumf, Syd fyra —
    // Syd är renons i klöver, men en stöld i den LÅNGA trumfhanden ger inget extra
    // stick. Kontrollerat läge med Nord på lead efter samma två stick.
    const stN: PlayState = {
      contract: K764, trump: 'spades',
      hands: {
        N: parseHand('S:T86 H:- D:964 C:K9732'),
        S: parseHand('S:QJ94 H:AT95 D:K75 C:-'),
        E: parseHand('S:K H:J3 D:QJ2 C:A8654'),
        W: parseHand('S:7 H:872 D:AT83 C:QJT'),
      },
      leader: 'N', toAct: 'N', currentTrick: [],
      completedTricks: [
        { leader: 'E', cards: [{ seat: 'E', card: c('HQ') }, { seat: 'S', card: c('HK') }, { seat: 'W', card: c('H6') }, { seat: 'N', card: c('H4') }], winner: 'S' },
        { leader: 'S', cards: [{ seat: 'S', card: c('SA') }, { seat: 'W', card: c('S3') }, { seat: 'N', card: c('S2') }, { seat: 'E', card: c('S5') }], winner: 'S' },
      ],
      tricksNS: 2, tricksEW: 0,
    }
    const v = val(stN, 'N', C764)
    expect(v.reason).not.toMatch(/stöld i den korta/)
  })
})
