import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { classifyOpening, isVulnerable } from './openings'

function call(notation: string): string {
  return classifyOpening(parseHand(notation)).call
}

/** Öppningsbud med explicit sårbarhet (för TP-nudgens Steg D-vulnerabilitet). */
function callVul(notation: string, vulnerable: boolean): string {
  return classifyOpening(parseHand(notation), vulnerable).call
}

describe('classifyOpening', () => {
  it('1NT med balanserad 15–17', () => {
    expect(call('S:AQ5 H:KJ7 D:Q842 C:K93')).toBe('1NT') // 15 hp, 3-3-4-3
  })

  it('2NT med balanserad 20–21', () => {
    expect(call('S:AQ5 H:KQ7 D:AQ82 C:KJ3')).toBe('2NT') // 21 hp, 3-3-4-3
  })

  it('1-högfärg med 5-korts färg och 12+', () => {
    expect(call('S:AKT62 H:K83 D:Q6 C:J52')).toBe('1S') // 13 hp, 5 spader
    expect(call('S:K83 H:AKT62 D:Q6 C:J52')).toBe('1H') // 13 hp, 5 hjärter
  })

  it('minor-regeln utan 5-korts högfärg', () => {
    expect(call('S:KQ72 H:A85 D:K84 C:QT3')).toBe('1C') // 14 hp, 4-3-3-3, klöver 3-3
    expect(call('S:KQ5 H:A8 D:KT62 C:QT43')).toBe('1D') // 14 hp, minorer 4-4
  })

  // ---- FAS 4 steg D (b): TP-nudge för sangöppning (sårbarhets-oberoende) ----
  describe('TP-nudge: bra 14 → 1NT (utan 5-korts färg)', () => {
    it('bra 14 (två kvalitetsfärger + tior, startp. ≥15) → 1NT', () => {
      // ♠AJ102 ♥KJ102 ♦Q2 ♣K32: 14 hp, 4-4-3-2, startpoäng 15 → uppvärderad 1NT.
      expect(call('S:AJT2 H:KJT2 D:Q2 C:K32')).toBe('1NT')
    })

    it('5-korts MINOR med samma styrka → öppnar minorn (ej 1NT)', () => {
      // ♠K42 ♥Q42 ♦AQ1092 ♣K2: 14 hp, startp. 15, MEN 5 ruter → 1♦ (bevarar
      // partnerns 4-korts-major-svar på 1-läget). Ägarbeslut punkt 3.
      expect(call('S:K42 H:Q42 D:AQT92 C:K2')).toBe('1D')
    })

    it('5-korts MAJOR med samma styrka → öppnar 1M (ej 1NT)', () => {
      // ♠AKJ92 ♥Q102 ♦KJ2 ♣32: 14 hp, startp. 15, MEN 5 spader → 1♠ (visa majoren).
      expect(call('S:AKJ92 H:QT2 D:KJ2 C:32')).toBe('1S')
    })

    it('platt quack-14 (startp. <15) nudgas INTE → minor-regeln', () => {
      // ♠KQ2 ♥QJ2 ♦KJ92 ♣Q2: 14 hp men quack-tung + Q2 → startpoäng 11 → 1♦.
      expect(call('S:KQ2 H:QJ2 D:KJ92 C:Q2')).toBe('1D')
    })
  })

  // ---- FAS 4 steg D-vulnerabilitet: ej sårbar aggressiv (≥15), sårbar passiv (≥16) ----
  describe('TP-nudge modulerad av sårbarhet', () => {
    it('startpoäng 15: nudgas EJ sårbar (→1NT), men INTE sårbar (→minor)', () => {
      const h = 'S:AJT2 H:KJT2 D:Q2 C:K32' // 14 hp, startp. 15
      expect(callVul(h, false)).toBe('1NT') // ej sårbar = aggressiv
      expect(callVul(h, true)).toBe('1C') // sårbar = passiv, faller till minor-regeln
    })

    it('startpoäng 16: nudgas OAVSETT sårbarhet (→1NT)', () => {
      const h = 'S:KJT9 H:QJT9 D:AK C:432' // 14 hp, startp. 16
      expect(callVul(h, false)).toBe('1NT')
      expect(callVul(h, true)).toBe('1NT')
    })
  })

  describe('isVulnerable', () => {
    it('none/all', () => {
      expect(isVulnerable('N', 'none')).toBe(false)
      expect(isVulnerable('E', 'all')).toBe(true)
    })
    it('ns/ew träffar rätt par', () => {
      expect(isVulnerable('N', 'ns')).toBe(true)
      expect(isVulnerable('S', 'ns')).toBe(true)
      expect(isVulnerable('E', 'ns')).toBe(false)
      expect(isVulnerable('W', 'ew')).toBe(true)
      expect(isVulnerable('N', 'ew')).toBe(false)
    })
  })

  it('svag tvåa med 6-korts ♦/♥/♠ och 6–11', () => {
    expect(call('S:KQT743 H:84 D:Q72 C:95')).toBe('2S') // 7 hp, 6 spader
  })

  it('spärr på 3-läget med 7-korts färg och svag', () => {
    expect(call('S:KQT7432 H:8 D:Q72 C:95')).toBe('3S') // 7 hp, 7 spader
  })

  it('stark 2♣ med obalanserad 22+', () => {
    expect(call('S:AKQJT98 H:AK D:AKQ C:4')).toBe('2C') // 26 hp, 7-2-3-1
  })

  it('distributionellt 2♣ på spelstick (HP < 22, ~8½ spelstick)', () => {
    // 20 hp men ~8½ spelstick (löpande 6-korts hjärter + EK + garderad kung) →
    // nära utgång på egen hand → 2♣, inte 1♥. Ägarens beslut 2026-07-01.
    expect(call('S:AK H:AKQJ98 D:K2 C:432')).toBe('2C')
  })

  it('lång stark hand UNDER 8½ spelstick öppnar 1 i färg', () => {
    // Samma form men ♦32 (ingen garderad kung) → 8 spelstick < 8½ → 1♥.
    expect(call('S:AK H:AKQJ98 D:32 C:432')).toBe('1H') // 17 hp, 8 spelstick
  })

  it('pass med för svag hand', () => {
    expect(call('S:K85 H:Q84 D:J762 C:Q93')).toBe('P') // 8 hp, balanserad
  })
})

describe('TP styr öppningen (Bergens grundregel: 12+ startpoäng)', () => {
  it('bra 11-hp-hand med 12 TP öppnar 1-minor (PDF Hand 4)', () => {
    expect(call('S:AT4 H:T543 D:KJ67 C:KT')).toBe('1D') // 11 hp / 12 TP (Adjust-3 +1)
  })
  it('lång 10-hp-hand med 12 TP öppnar 1-högfärg (PDF Hand 1)', () => {
    expect(call('S:AKQT5 H:T982 D:6 C:J67')).toBe('1S') // 10 hp / 12 TP (längd + kvalitet)
  })
  it('platt 12-hp-hand öppnar ÄNDÅ (ägarens regel: 12 hp nedgraderas aldrig)', () => {
    // 12 hp, 4-3-3-3 → bara 10 TP, men en människa öppnar i princip alltid 12 hp.
    // HP-golvet (≥12) går före TP-nedgraderingen. Ingen 5-högfärg → minor-regeln.
    expect(call('S:KQ52 H:KJ7 D:Q42 C:J32')).toBe('1C')
  })
  it('platt 11-hp-hand (TP < 12) avstår fortfarande', () => {
    expect(call('S:KQ52 H:KJ7 D:Q42 C:T32')).toBe('P') // 11 hp, 4-3-3-3 → under golvet
  })
})
