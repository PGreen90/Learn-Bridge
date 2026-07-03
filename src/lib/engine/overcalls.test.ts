import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { overcall, advanceOvercall, advanceTwoSuiter, hasStopper } from './overcalls'

const o = (n: string, their: string) => overcall(parseHand(n), their).call

describe('overcall – inkliv över deras 1-läges öppning (§7.1–7.2)', () => {
  it('enkelt inkliv 1♠ över (1♦)', () => {
    expect(o('S:KQ542 H:K32 D:32 C:432', '1D')).toBe('1S') // 8 hp, 5 spader
  })
  it('enkelt inkliv på 2-läget: 2♥ över (1♠)', () => {
    expect(o('S:32 H:KQ542 D:K32 C:432', '1S')).toBe('2H') // 8 hp, 5 hjärter
  })
  it('1NT-inkliv med 15–18 balanserad och stopp', () => {
    expect(o('S:KQ4 H:KJ5 D:KQ32 C:Q42', '1H')).toBe('1NT') // 16 hp
  })
  it('Michaels (2♣) över (1♣): båda högfärgerna', () => {
    expect(o('S:KQ542 H:KJ543 D:3 C:32', '1C')).toBe('2C') // 5-5 hf
  })
  it('Michaels (2♠) över (1♠): andra högfärgen + minor', () => {
    expect(o('S:3 H:KQ542 D:KJ543 C:32', '1S')).toBe('2S') // 5 hjärter + 5 ruter
  })
  it('ovanlig 2NT över (1♠): två lägsta objudna (klöver+ruter)', () => {
    expect(o('S:3 H:32 D:KQ543 C:KJ542', '1S')).toBe('2NT') // 5-5 minorer
  })
  it('upplysningsdubbling över (1♥): kort i färgen, stöd i övriga, 12+', () => {
    expect(o('S:KQ43 H:3 D:KQ52 C:Q432', '1H')).toBe('X') // 12 hp, singel hjärter
  })
  it('pass med svag hand', () => {
    expect(o('S:432 H:432 D:5432 C:432', '1D')).toBe('P') // 0 hp
  })
  it('inget inkliv mot deras 1NT (hanteras av DONT)', () => {
    expect(o('S:KQ542 H:K32 D:32 C:432', '1NT')).toBe('P')
  })

  // Ägarbeslut 2026-07-03 (uppföljning felrapport #5, exempelhänder H1–H4):
  // AGGRESSIV STANDARD för upplysningsdubblingen – golvet sänkt till 10 hp,
  // men BARA när formen är rätt (max 2 kort i deras färg + stöd i alla
  // objudna). Jämna händer utan korthet dubblar aldrig under 12.
  describe('aggressiv upplysningsdubbling (10–11 hp med rätt form)', () => {
    it('H2: 10 hp, singel i deras ruter, 4-4 hf → X', () => {
      expect(o('S:KQ64 H:AJ53 D:2 C:T874', '1D')).toBe('X')
    })
    it('H4: 11 hp, dubbelton i deras ruter, stöd i övriga → X', () => {
      expect(o('S:A63 H:KJ64 D:43 C:QJ83', '1D')).toBe('X')
    })
    it('H1 (bricka 8-Nord): jämn 10:a med 3 kort i deras färg → pass', () => {
      expect(o('S:A63 H:J643 D:J43 C:A83', '1D')).toBe('P')
    })
    it('H3: perfekt form men bara 8 hp → pass', () => {
      expect(o('S:KJ85 H:QT94 D:4 C:J973', '1D')).toBe('P')
    })
    it('10–11 med egen 5-korts färg → enkelt inkliv, inte X', () => {
      expect(o('S:KJT98 H:76 D:Q97 C:A76', '1H')).toBe('1S') // 10 hp, 5 spader
    })
  })
})

describe('advanceOvercall – svar på partnerns inkliv (§7.1)', () => {
  it('cue i deras färg = limithöjning+ (bra stöd, 11+)', () => {
    expect(advanceOvercall(parseHand('S:K43 H:KQ2 D:432 C:K432'), 'spades', 'diamonds').call).toBe('2D')
  })
  it('konkurrenshöjning med stöd och under 11', () => {
    expect(advanceOvercall(parseHand('S:K43 H:Q42 D:432 C:Q432'), 'spades', 'diamonds').call).toBe('2S')
  })
  it('ny färg naturlig (egen 5-färg, ej stöd)', () => {
    expect(advanceOvercall(parseHand('S:KQ543 H:2 D:432 C:K432'), 'hearts', 'diamonds').call).toBe('2S')
  })
  it('fit-jump: 4 stöd + egen 5-färg, inbjudande+ → hopp i sidofärgen', () => {
    // partnern klev in 1♥, advancern har 4 hjärter + 5 spader, 10 hp → 2♠ (fit-jump).
    const r = advanceOvercall(parseHand('S:KQJ54 H:A432 D:32 C:32'), 'hearts', 'diamonds')
    expect(r.call).toBe('2S')
    expect(r.rule).toBe('fit-jump')
  })
})

describe('advanceTwoSuiter – svar på Michaels / ovanlig 2NT (§7.2, ägarbeslut)', () => {
  const a = (n: string, partnerCall: string, their: 'clubs' | 'diamonds' | 'hearts' | 'spades', contested = false) =>
    advanceTwoSuiter(parseHand(n), partnerCall, their, contested)

  // Michaels över deras minor (2♣) = båda högfärgerna. Bjud den längsta.
  it('Michaels 2♣: längst i spader → 2♠', () => {
    expect(a('S:KJ432 H:32 D:Q432 C:432', '2C', 'clubs').call).toBe('2S')
  })
  it('Michaels 2♣: längst i hjärter → 2♥', () => {
    expect(a('S:32 H:KJ432 D:Q432 C:432', '2C', 'clubs').call).toBe('2H')
  })
  it('Michaels 2♣: lika långa högfärger → högfärgen (spader) 2♠', () => {
    expect(a('S:K32 H:Q32 D:J432 C:432', '2C', 'clubs').call).toBe('2S')
  })

  // Ovanlig 2NT över (1♠) = de två lägsta objudna (klöver+ruter).
  it('ovanlig 2NT: längst i ruter → 3♦', () => {
    expect(a('S:432 H:432 D:KJ32 C:Q32', '2NT', 'spades').call).toBe('3D')
  })
  it('ovanlig 2NT: längst i klöver → 3♣', () => {
    expect(a('S:432 H:432 D:Q32 C:KJ32', '2NT', 'spades').call).toBe('3C')
  })

  // Michaels över deras högfärg (2♠) = andra högfärgen (hjärter) + OKÄND minor.
  it('Michaels 2♠: hjärterfit → 3♥ (preferens)', () => {
    expect(a('S:32 H:K432 D:432 C:5432', '2S', 'spades').call).toBe('3H')
  })
  it('Michaels 2♠: ingen högfärgsfit, ostört → 3♣ (pass-eller-rätta minor)', () => {
    expect(a('S:432 H:32 D:K432 C:5432', '2S', 'spades').call).toBe('3C')
  })
  it('Michaels 2♠: ingen fit + contested + svag → pass (partnern rättar sin minor)', () => {
    expect(a('S:432 H:32 D:K432 C:5432', '2S', 'spades', true).call).toBe('P')
  })

  // Ägarregel: aldrig passa i en ostörd budgivning – även en usel hand tar ut.
  it('svag hand får ALDRIG passa ostört → bjuder ändå (2♠)', () => {
    expect(a('S:J432 H:32 D:432 C:5432', '2C', 'clubs').call).toBe('2S')
  })
})

describe('hasStopper', () => {
  it('Kx är stopp', () => {
    expect(hasStopper(parseHand('S:K3 H:5432 D:5432 C:543'), 'spades')).toBe(true)
  })
  it('Qxx är stopp', () => {
    expect(hasStopper(parseHand('S:Q43 H:5432 D:543 C:543'), 'spades')).toBe(true)
  })
})
