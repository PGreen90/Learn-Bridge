import { describe, expect, it } from 'vitest'
import type { Major, ResponseResult } from './responses'
import { parseHand } from '../bidding'
import type { Suit } from '../../types/bridge'
import { responderAnswerBergenGameTry, responderRebidAfterInvertedMinor, responderRebidAfterSemiForcing1NT, responderRebidColorAuction, responderRebidIn1NTAuction, responderRebidIn2over1Auction, responderRebidIn2NTAuction, responderRevealSplinterShortness } from './responder-rebids'
import { buildAuction } from './auction'
import type { Deal } from '../../types/bridge'

function r10(notation: string, M: Major, call: string, rule: string): string {
  const rebid: ResponseResult = { call, rule, explanation: '' }
  return responderRebidAfterSemiForcing1NT(parseHand(notation), M, rebid)?.call ?? 'null'
}

function r11(notation: string, respRule: string, respCall: string, rebidCall: string, rebidRule = ''): string {
  const response: ResponseResult = { call: respCall, rule: respRule, explanation: '' }
  const rebid: ResponseResult = { call: rebidCall, rule: rebidRule, explanation: '' }
  return responderRebidIn1NTAuction(response, rebid, parseHand(notation))?.call ?? 'null'
}

function r12(notation: string, opened: Suit, responderSuit: Suit, rebidCall: string, rebidRule: string): string {
  const rebid: ResponseResult = { call: rebidCall, rule: rebidRule, explanation: '' }
  return responderRebidColorAuction(parseHand(notation), opened, responderSuit, rebid)?.call ?? 'null'
}

// ---- TP-steg E: svararens fortsättning efter öppnarens hoppskift (GF) --------
// Hoppskiftet är utgångskrav → svararen får ALDRIG passa: placera kontraktet
// (fast arrival – öppnaren har redan visat styrkan).
describe('TP-steg E – svararen efter öppnarens hoppskift (1x–1y–3z, GF)', () => {
  it('3-korts stöd i öppnarens högfärg → utgång 4M', () => {
    expect(r12('S:KQ762 H:K85 D:432 C:42', 'hearts', 'spades', '3D', 'hoppskift')).toBe('4H')
  })

  it('stopp i fjärde färgen → 3NT', () => {
    expect(r12('S:KQ762 H:K854 D:32 C:42', 'diamonds', 'spades', '3C', 'hoppskift')).toBe('3NT')
  })

  it('fit i hoppskiftsfärgen, inget stopp → 5 i minorn', () => {
    expect(r12('S:KQ76 H:854 D:32 C:J432', 'diamonds', 'spades', '3C', 'hoppskift')).toBe('5C')
  })
})

describe('FAS 3 punkt 14 – svararen visar kortfärgen efter splinter-relä (upp-the-line)', () => {
  const reveal = (n: string, M: Major) => responderRevealSplinterShortness(parseHand(n), M)

  // Hjärterfit: icke-trumf = ♣ ♦ ♠ → stegen 4♣ / 4♦ / 4♥.
  it('1♥: singel klöver → 4♣ (lägsta steget)', () => {
    expect(reveal('S:K43 H:KQ74 D:AJ852 C:3', 'hearts')?.call).toBe('4C')
  })
  it('1♥: singel ruter → 4♦', () => {
    expect(reveal('S:K43 H:KQ74 D:3 C:AJ852', 'hearts')?.call).toBe('4D')
  })
  it('1♥: singel spader → 4♥ (högsta steget)', () => {
    expect(reveal('S:3 H:KQ74 D:AJ85 C:K432', 'hearts')?.call).toBe('4H')
  })
  it('1♥: renons spader → 4♥ och märks som renons', () => {
    const r = reveal('S:- H:KQ742 D:AJ85 C:K43', 'hearts')
    expect(r?.call).toBe('4H')
    expect(r?.explanation).toContain('renons')
  })

  // Spaderfit: icke-trumf = ♣ ♦ ♥ → stegen 4♣ / 4♦ / 4♥.
  it('1♠: singel klöver → 4♣', () => {
    expect(reveal('S:KQ74 H:AJ85 D:K43 C:3', 'spades')?.call).toBe('4C')
  })
  it('1♠: singel hjärter → 4♥ (högsta steget, under utgång 4♠)', () => {
    expect(reveal('S:KQ74 H:3 D:AJ85 C:K43', 'spades')?.call).toBe('4H')
  })

  it('regel + märkning: budet bär regeln "splinter: kortfärg"', () => {
    expect(reveal('S:K43 H:KQ74 D:AJ852 C:3', 'hearts')?.rule).toBe('splinter: kortfärg')
  })

  it('utan kortfärg (ingen singel/renons) → null', () => {
    expect(reveal('S:K43 H:KQ74 D:A85 C:Q83', 'hearts')).toBe(null)
  })
})

describe('FAS 3 punkt 15 – svararens svar på Bergen game try (1M–2M–2NT, visa korthet)', () => {
  const ans = (n: string, M: Major) => responderAnswerBergenGameTry(parseHand(n), M)

  it('platt minimum (ingen korthet, svag) → 3M signoff', () => {
    expect(ans('S:K54 H:J83 D:9742 C:Q83', 'hearts').call).toBe('3H')
  })
  it('platt maximum (ingen korthet, 8–9 stödp.) → 4M accepterar', () => {
    const r = ans('S:Q54 H:Q83 D:KJ42 C:J83', 'hearts')
    expect(r.call).toBe('4H')
    expect(r.rule).toBe('game try: accepterar')
  })

  // Korthet visas upp-the-line (♣ före ♦ före ♠ vid hjärterfit).
  it('singel klöver → 3♣', () => {
    expect(ans('S:K54 H:Q83 D:87432 C:9', 'hearts').call).toBe('3C')
  })
  it('singel ruter → 3♦', () => {
    expect(ans('S:K54 H:Q83 D:9 C:Q87432', 'hearts').call).toBe('3D')
  })
  it('singel spader → 3♠', () => {
    const r = ans('S:9 H:Q83 D:K7432 C:Q84', 'hearts')
    expect(r.call).toBe('3S')
    expect(r.rule).toBe('game try: kortfärg')
  })
  it('spaderfit: singel hjärter → 3♥ (under utgång 4♠)', () => {
    expect(ans('S:K843 H:9 D:Q742 C:K83', 'spades').call).toBe('3H')
  })
})

describe('punkt 10 – svararens andra bud efter semi-forcing 1NT', () => {
  it('pass på öppnarens utgång', () => {
    expect(r10('S:KJ742 H:3 D:Q842 C:J52', 'hearts', '4H', 'rebid: utgång')).toBe('P')
  })

  it('öppnaren rebjuder 2♥, svag → pass (preferens)', () => {
    expect(r10('S:KJ742 H:3 D:Q842 C:J52', 'hearts', '2H', 'rebid: egen färg')).toBe('P') // 5 hp
  })

  it('öppnaren rebjuder 2♥, 3-korts limithöjning → 3♥', () => {
    expect(r10('S:KJ4 H:Q72 D:KQ52 C:J52', 'hearts', '2H', 'rebid: egen färg')).toBe('3H') // 12 hp, 3 stöd
  })

  it('öppnaren bjuder 2NT (18–19) → 3NT med värden', () => {
    expect(r10('S:KJ4 H:72 D:Q852 C:J852', 'hearts', '2NT', 'rebid: 2NT (18–19)')).toBe('3NT') // 7 hp
  })

  it('öppnaren bjuder ny minor 2♣ – stöd, svag → pass', () => {
    expect(r10('S:KJ4 H:7 D:Q852 C:J8642', 'hearts', '2C', 'rebid: ny färg')).toBe('P') // 5 hp, 5 klöver
  })

  it('öppnaren bjuder ny minor 2♦ – preferens till högfärgen', () => {
    expect(r10('S:Q842 H:K7 D:73 C:J8642', 'hearts', '2D', 'rebid: ny färg')).toBe('2H') // 6 hp, 2 hjärter
  })

  it('hoppskift (GF) utan fit → 3NT', () => {
    expect(r10('S:KJ4 H:7 D:Q852 C:J8642', 'hearts', '3C', 'rebid: hoppskift')).toBe('3NT')
  })
})

describe('punkt 11 – svararens andra bud i 1NT-auktioner', () => {
  it('Smolen: 5 spader + 4 hjärter, GF → 3♥', () => {
    expect(r11('S:KQ842 H:AJ85 D:3 C:Q42', 'Stayman', '2C', '2D')).toBe('3H') // 12 hp
  })

  it('Smolen: 5 hjärter + 4 spader, GF → 3♠', () => {
    expect(r11('S:AJ85 H:KQ842 D:3 C:Q42', 'Stayman', '2C', '2D')).toBe('3S') // 12 hp
  })

  it('Stayman, öppnaren förnekar högfärg, inbjudan → 2NT', () => {
    expect(r11('S:KQ85 H:972 D:K42 C:J52', 'Stayman', '2C', '2D')).toBe('2NT') // 9 hp
  })

  it('Stayman, fit i öppnarens hjärter, GF → 4♥', () => {
    expect(r11('S:K2 H:KQ85 D:A852 C:952', 'Stayman', '2C', '2H')).toBe('4H') // 12 hp, 4 stöd
  })

  it('Stayman, ingen fit (4 spader, öppnaren bjöd hjärter), GF → 3NT', () => {
    expect(r11('S:KQ85 H:72 D:KJ42 C:Q52', 'Stayman', '2C', '2H')).toBe('3NT') // 11 hp
  })

  it('Stayman, 5-4 i högfärgerna, inbjudan (8–9) efter 2♦ → naturlig 2♠', () => {
    expect(r11('S:KQ842 H:KT85 D:73 C:52', 'Stayman', '2C', '2D')).toBe('2S') // 8 hp, 5-4
  })

  it('Stayman, 5-4 i högfärgerna, inbjudan (8–9) efter 2♦ → naturlig 2♥', () => {
    expect(r11('S:KT85 H:KQ842 D:73 C:52', 'Stayman', '2C', '2D')).toBe('2H') // 8 hp, 4-5
  })

  it('5-5 i högfärgerna, inbjudan: transfer ♥ (2♦→2♥) → 2♠ visar 5-5', () => {
    expect(r11('S:KQ876 H:KJ765 D:3 C:42', 'Jacoby-transfer', '2D', '2H')).toBe('2S') // 9 hp
  })

  it('5-5 i högfärgerna, GF: transfer ♠ (2♥→2♠) → 3♥ visar 5-5', () => {
    expect(r11('S:AQ876 H:KJ765 D:3 C:42', 'Jacoby-transfer', '2H', '2S')).toBe('3H') // 10 hp
  })

  it('5-5 i högfärgerna, svag: Stayman, öppnaren bjöd 2♦ → 2 i bästa hf', () => {
    expect(r11('S:Q8765 H:K8765 D:32 C:4', 'Stayman', '2C', '2D')).toBe('2H') // hjärter starkare
  })

  it('5-5 i högfärgerna, svag: Stayman, öppnaren bjöd 2♥ (hf) → pass', () => {
    expect(r11('S:Q8765 H:K8765 D:32 C:4', 'Stayman', '2C', '2H')).toBe('P')
  })

  it('garbage Stayman: svag 4-4-4-1, öppnaren bjöd 2♦ → pass', () => {
    expect(r11('S:Q652 H:K843 D:J642 C:5', 'Stayman', '2C', '2D')).toBe('P') // 6 hp
  })

  it('garbage Stayman: svag 4-4-4-1, öppnaren bjöd 2♥ → pass', () => {
    expect(r11('S:Q652 H:K843 D:J642 C:5', 'Stayman', '2C', '2H')).toBe('P') // 6 hp
  })

  it('garbage Stayman: svag 4-4-4-1, öppnaren bjöd 2♠ → pass', () => {
    expect(r11('S:Q652 H:K843 D:J642 C:5', 'Stayman', '2C', '2S')).toBe('P') // 6 hp
  })

  it('Jacoby fullföljd, svag → pass', () => {
    expect(r11('S:73 H:KQ862 D:9742 C:52', 'Jacoby-transfer', '2D', '2H')).toBe('P') // 5 hp
  })

  it('Jacoby fullföljd, 6-korts inbjudan → 3♥', () => {
    expect(r11('S:7 H:KQ8642 D:K42 C:952', 'Jacoby-transfer', '2D', '2H')).toBe('3H') // 8 hp
  })

  it('Jacoby fullföljd, 6-korts utgång → 4♥', () => {
    expect(r11('S:7 H:KQ8642 D:KQ2 C:952', 'Jacoby-transfer', '2D', '2H')).toBe('4H') // 10 hp
  })

  it('Jacoby superaccept → 4♥', () => {
    expect(r11('S:73 H:KQ862 D:9742 C:52', 'Jacoby-transfer', '2D', '3H', 'superaccept')).toBe('4H')
  })

  it('Texas – öppnaren fullföljde → pass', () => {
    expect(r11('S:7 H:KQ8642 D:KQ2 C:952', 'Texas', '4D', '4H')).toBe('P')
  })
})

describe('FAS 5 punkt 23 – svararens andra bud efter Minor Suit Stayman (2♠)', () => {
  // Svararen har 5-4+ i minorerna, GF (13+). NO-FIT-fallen placeras här: ingen
  // 4-korts minor (öppnaren 2NT/3NT) → 3NT / pass. MINORFITEN (öppnaren 3♣/3♦)
  // – inkl. slam-/NT-placeringen – ägs av auction.ts (mssMinorFitContinuation)
  // och testas i slam-auction.test.ts (FAS 8). Här returneras null för 3♣/3♦.
  const mss = (n: string, rebidCall: string) => r11(n, 'Minor Suit Stayman', '2S', rebidCall)

  it('ingen minorfit (öppnaren 2NT) → 3NT', () => {
    expect(mss('S:A3 H:72 D:AQ842 C:KJ85', '2NT')).toBe('3NT')
  })
  it('öppnaren visade max utan minorfit (3NT) → pass', () => {
    expect(mss('S:A3 H:72 D:AQ842 C:KJ85', '3NT')).toBe('P')
  })
  it('minorfit (3♣/3♦) hanteras i auction.ts → null här (r11 ger "null")', () => {
    expect(mss('S:A3 H:K2 D:AQ842 C:KJ85', '3C')).toBe('null')
    expect(mss('S:A3 H:K2 D:AQ842 C:KJ85', '3D')).toBe('null')
  })
})

describe('punkt 24 – svararens andra bud efter 2NT-öppning (GF, placera kontrakt)', () => {
  const r2nt = (n: string, rule: string, respCall: string, rebidCall: string): string => {
    const response: ResponseResult = { call: respCall, rule, explanation: '' }
    const rebid: ResponseResult = { call: rebidCall, rule: '', explanation: '' }
    return responderRebidIn2NTAuction(response, rebid, parseHand(n))?.call ?? 'null'
  }

  it('Stayman (2NT), fit i öppnarens spader → 4♠', () => {
    expect(r2nt('S:KJ43 H:Q42 D:K43 C:432', 'Stayman (2NT)', '3C', '3S')).toBe('4S') // 8 hp, 4 spader
  })

  it('Stayman (2NT), ingen fit (öppnaren 3♦) → 3NT', () => {
    expect(r2nt('S:KJ43 H:Q42 D:K43 C:432', 'Stayman (2NT)', '3C', '3D')).toBe('3NT')
  })

  it('Stayman (2NT), 5-4 hf efter 3♦ → Smolen 3♥ (5 spader)', () => {
    expect(r2nt('S:KJ432 H:Q543 D:K4 C:43', 'Stayman (2NT)', '3C', '3D')).toBe('3H')
  })

  it('Stayman (2NT), 5-4 hf efter 3♦ → Smolen 3♠ (5 hjärter)', () => {
    expect(r2nt('S:Q543 H:KJ432 D:K4 C:43', 'Stayman (2NT)', '3C', '3D')).toBe('3S')
  })

  it('transfer (2NT) svag signoff (p<5) → pass', () => {
    expect(r2nt('S:2 H:J87632 D:5432 C:43', 'transfer (2NT)', '3D', '3H')).toBe('P') // 1 hp
  })

  it('transfer (2NT), 5-korts hf GF → 3NT (öppnaren väljer)', () => {
    expect(r2nt('S:K3 H:KJ432 D:Q43 C:432', 'transfer (2NT)', '3D', '3H')).toBe('3NT') // 9 hp, 5 hjärter
  })

  it('transfer (2NT), 6-korts hf GF → 4♥', () => {
    expect(r2nt('S:K3 H:KQ8432 D:43 C:K2', 'transfer (2NT)', '3D', '3H')).toBe('4H') // 11 hp, 6 hjärter
  })
})

describe('punkt 12 – svararens andra bud i färgauktioner (fjärde färg krav)', () => {
  it('fjärde färg krav: 1♦–1♠–2♣, GF utan stopp i hjärter → 2♥', () => {
    expect(r12('S:AK85 H:432 D:Q52 C:K53', 'diamonds', 'spades', '2C', 'ny färg (2-läget)')).toBe('2H') // 13 hp
  })

  it('3NT i stället för fjärde färg när fjärde färgen är stoppad', () => {
    expect(r12('S:AK85 H:KJ2 D:Q52 C:K53', 'diamonds', 'spades', '2C', 'ny färg (2-läget)')).toBe('3NT') // stopp i hjärter
  })

  it('fit i öppnarens andra färg → höjning', () => {
    expect(r12('S:AK85 H:32 D:52 C:KQ842', 'diamonds', 'spades', '2C', 'ny färg (2-läget)')).toBe('3C') // 5 klöver
  })

  it('egen 6-korts färg → rebjuder den', () => {
    expect(r12('S:3 H:KQ8642 D:K52 C:Q42', 'diamonds', 'hearts', '1S', 'ny färg (1-läget)')).toBe('2H') // 6 hjärter
  })

  it('öppnaren höjde svararens högfärg (enkel) – utgångsstyrka → 4♥', () => {
    expect(r12('S:K3 H:KQ842 D:AQ2 C:952', 'clubs', 'hearts', '2H', 'enkel höjning')).toBe('4H') // 14 hp
  })

  it('öppnaren höjde svararens högfärg – inbjudningsstyrka → 3♥', () => {
    expect(r12('S:KJ3 H:KQ842 D:Q5 C:952', 'clubs', 'hearts', '2H', 'enkel höjning')).toBe('3H') // 11 hp
  })

  it('öppnaren rebjöd 1NT (12–14) – game → 3NT', () => {
    expect(r12('S:K3 H:AQ842 D:KJ2 C:Q52', 'clubs', 'hearts', '1NT', '1NT (12–14)')).toBe('3NT') // 15 hp
  })

  it('öppnaren rebjöd sin färg, svag preferens → pass', () => {
    expect(r12('S:KQ842 H:3 D:K72 C:9542', 'diamonds', 'spades', '2D', 'rebjuden färg')).toBe('P') // 8 hp, 3 ruter
  })
})

describe('FAS 6 punkt 27 – svararens fortsättning efter inverterad minor (1♦–2♦–…)', () => {
  const inv = (n: string, rebidCall: string, rebidRule: string, m: Suit = 'diamonds'): ResponseResult | null =>
    responderRebidAfterInvertedMinor(parseHand(n), m, { call: rebidCall, rule: rebidRule, explanation: '' })

  it('öppnaren 18–19 balanserad (3NT) → pass (utgång står)', () => {
    expect(inv('S:A32 H:A32 D:KJ643 C:32', '3NT', 'inverterad: 3NT')?.call).toBe('P')
  })

  it('öppnaren 12–14 balanserad (2NT) + utgångsvärden (11+) → 3NT', () => {
    expect(inv('S:K84 H:Q72 D:KJ42 C:Q32', '2NT', 'inverterad: 2NT')?.call).toBe('3NT') // 11 hp
  })

  it('öppnaren 12–14 balanserad (2NT) + minimumhöjning (10) → pass (2NT räcker)', () => {
    expect(inv('S:K84 H:J72 D:KJ42 C:Q32', '2NT', 'inverterad: 2NT')?.call).toBe('P') // 10 hp
  })

  it('öppnaren minimum utan stopp (3♦) + stark med båda hf stoppade → 3NT', () => {
    expect(inv('S:AQ4 H:KJ7 D:K842 C:Q3', '3D', 'inverterad: minimum')?.call).toBe('3NT') // 15 hp
  })

  it('öppnaren minimum utan stopp (3♦) + saknar spaderstopp → pass', () => {
    expect(inv('S:432 H:KJ7 D:KQ42 C:AQ3', '3D', 'inverterad: minimum')?.call).toBe('P') // 14 hp, ingen ♠-stopp
  })

  it('öppnaren stopp-visning (2♥) + övriga sidofärger täckta → 3NT', () => {
    expect(inv('S:AQ4 H:842 D:KQ42 C:KJ3', '2H', 'inverterad: stopp-visning')?.call).toBe('3NT')
  })

  it('öppnaren stopp-visning (2♥) + ingen spaderstopp → 5♦ (minorutgång, flaggad)', () => {
    const r = inv('S:432 H:842 D:KQ42 C:KJ3', '2H', 'inverterad: stopp-visning')
    expect(r?.call).toBe('5D')
    expect(r?.uncertain).toBe(true)
  })

  it('svag höjning (1♦–3♦) + öppnaren 3NT → pass', () => {
    expect(inv('S:32 H:432 D:KJ8643 C:32', '3NT', 'rebid: 3NT')?.call).toBe('P')
  })
})

describe('buildAuction – inverterad minor end-to-end (FAS 6 inkoppling)', () => {
  it('bygger 1♦ – 2♦ – 2NT – 3NT (stark inverterad → 12–14 → utgång)', () => {
    const deal: Deal = {
      id: 'test',
      board: 1,
      dealer: 'N',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:KQ4 H:KJ7 D:A842 C:432'), // 13 hp bal, minor-regeln → 1♦, rebid 2NT
        S: parseHand('S:A2 H:A32 D:KJ643 C:432'), // 12 hp, 5 ruterstöd → 2♦ inverterad, sen 3NT
        E: parseHand('S:J876 H:Q865 D:7 C:QJ95'),
        W: parseHand('S:T953 H:T94 D:QT5 C:KT8'),
      },
    }
    const a = buildAuction(deal)
    expect(a?.turns.map((t) => t.call)).toEqual(['1D', '2D', '2NT', '3NT'])
  })
})

// Felrapport #4: svararens fortsättning i 2/1 GF-auktioner (§5.3) – utgång är
// säkrad, svararen får ALDRIG passa under utgång. Sammanhang i färgfallen:
// 1♠–2♦–3♣ (öppning spader, 2/1 i ruter, öppnarens andrafärg klöver).
describe('responderRebidIn2over1Auction (§5.3, felrapport #4)', () => {
  const after3C = (hand: string) =>
    responderRebidIn2over1Auction(parseHand(hand), 'spades', 'diamonds', { call: '3C', rule: 'rebid: ny färg (GF)', explanation: '' })!

  it('öppnaren bjöd 3NT → utgång nådd, pass', () => {
    const r = responderRebidIn2over1Auction(parseHand('S:3 H:QJ72 D:AKQJ9 C:T76'), 'spades', 'diamonds', { call: '3NT', rule: 'rebid: 3NT (GF)', explanation: '' })!
    expect(r.call).toBe('P')
  })
  it('öppnaren bjöd 2NT (balanserad) → höj till 3NT', () => {
    const r = responderRebidIn2over1Auction(parseHand('S:3 H:QJ72 D:AKQJ9 C:T76'), 'spades', 'diamonds', { call: '2NT', rule: 'rebid: 2NT (GF)', explanation: '' })!
    expect(r.call).toBe('3NT')
  })
  it('3-korts stöd i öppnarens högfärg, minimum-GF → 4♠ (fast arrival)', () => {
    expect(after3C('S:Q83 H:872 D:AKQJ9 C:76').call).toBe('4S')
  })
  it('3-korts stöd + extra styrka (15+) → 3♠ (långsam väg, slamrum)', () => {
    expect(after3C('S:Q83 H:A72 D:AKQJ9 C:A6').call).toBe('3S')
  })
  it('inget stöd men objudna färgen stoppad → 3NT (Nords hand ur felrapporten)', () => {
    const r = after3C('S:3 H:QJ72 D:AKQJ9 C:T76')
    expect(r.call).toBe('3NT')
    expect(r.rule).toBe('2/1: fortsättning')
  })
  it('varken stöd eller stopp, men 4-korts stöd i andrafärgen → höjning 4♣', () => {
    expect(after3C('S:3 H:872 D:AKQJ9 C:KJ76').call).toBe('4C')
  })
  it('egen 6+ färg → rebjud (3♦)', () => {
    expect(after3C('S:A3 H:872 D:AKQJ93 C:76').call).toBe('3D')
  })
  it('nödutväg: preferens till öppnarens färg – aldrig pass (3♠)', () => {
    expect(after3C('S:A3 H:872 D:AKQJ9 C:762').call).toBe('3S')
  })
})
