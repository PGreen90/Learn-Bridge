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

/** Öppningsbud med explicit position runt bordet (för Steg F: 3:e/4:e hand). */
function callSeat(notation: string, seatOrder: 1 | 2 | 3 | 4, vulnerable = false): string {
  return classifyOpening(parseHand(notation), vulnerable, seatOrder).call
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

  // ---- FAS 7 punkt 26: minor-regeln 3-3 / 4-4 / 5-5 / olika längd (§3) -------
  describe('minor-regeln (facit: 3-3♣ / 4-4♦ / 5-5♦ / längsta minorn)', () => {
    it('3-3 minorer → 1♣ (billigast)', () => {
      expect(call('S:KQ72 H:A85 D:K84 C:QT3')).toBe('1C') // 14 hp, 4-3-3-3, minorer 3-3
    })
    it('4-4 minorer → 1♦ (plats att bjuda klöver nästa vända)', () => {
      expect(call('S:KQ5 H:A8 D:KT62 C:QT43')).toBe('1D') // 4-4 i minorerna
    })
    it('5-5 minorer → 1♦ (öppnar ruter, klöver naturligt nästa vända)', () => {
      expect(call('S:Q2 H:J3 D:KQ983 C:KJ842')).toBe('1D') // 12 hp, 5-5, obalanserad
    })
    it('olika längd → längsta minorn (5♣-3♦ → 1♣)', () => {
      expect(call('S:Q42 H:J3 D:KQ9 C:KJ842')).toBe('1C') // klöver längre
    })
    it('olika längd → längsta minorn (5♦-3♣ → 1♦)', () => {
      expect(call('S:Q42 H:J3 D:KJ842 C:KQ9')).toBe('1D') // ruter längre
    })
    it('olika längd → längsta minorn (4♣-3♦ → 1♣)', () => {
      expect(call('S:K84 H:A85 D:Q84 C:KQ72')).toBe('1C') // klöver 4, ruter 3
    })
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

  // ---- Uppgradering "bra 19" → 2NT (ägarbeslut 2026-07-06, felrapport #30) ----
  describe('uppgradering: bra 19 → 2NT (utan 5-korts färg)', () => {
    it('felrapport #30: ♠AJ84 ♥AQJ9 ♦986 ♣AK (19 hp, 3 ess + AK, startp. 20) → 2NT', () => {
      expect(call('S:AJ84 H:AQJ9 D:986 C:AK')).toBe('2NT')
    })

    it('platt 19 utan extra kvalitet (startp. <20) öppnar 1 i färg – ej uppgraderad', () => {
      // ♠KQ2 ♥KQ2 ♦KQJ3 ♣KJ: 19 hp men bara kungar/damer, inga ess → startp. 19 → minor.
      expect(call('S:KQ2 H:KQ2 D:KQJ3 C:KJ')).not.toBe('2NT')
    })

    it('18 balanserat uppgraderas ALDRIG (under golvet) → 1 i färg', () => {
      // ♠AK4 ♥AQ9 ♦9862 ♣AK: 18 hp, jämn → öppnar 1♦ (ingen 2NT-uppgradering).
      expect(call('S:AK4 H:AQ9 D:9862 C:AK')).not.toBe('2NT')
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

// ---- TP-steg F: lättöppning i 3:e/4:e hand (ägarbeslut 2026-07-03) ----------
// 3:e hand: 10–11 hp öppnar 1M med bra 5+ högfärg (≥2 topphonnörer A/K/Q),
// sårbar krävs 11 – ALDRIG lätt i minor, aldrig lätt 1NT. Drury skyddar svaret.
// 4:e hand: regeln om 15 (Pearson) – hp + antal spader ≥ 15 → öppna (hp 9–11),
// annars passas given ut (ingen spärr/svag tvåa när alla redan passat).
describe('TP-steg F – lättöppning i 3:e och 4:e hand', () => {
  it('3:e hand ej sårbar: 10 hp + bra 5-korts spader → 1♠ (i 1:a hand: pass)', () => {
    const h = 'S:KQJ98 H:A54 D:872 C:43' // 10 hp, ♠KQ = 2 topphonnörer
    expect(callSeat(h, 3)).toBe('1S')
    expect(callSeat(h, 1)).toBe('P')
  })

  it('3:e hand sårbar: 10 hp räcker INTE (kräver 11)', () => {
    expect(callSeat('S:KQJ98 H:A54 D:872 C:43', 3, true)).toBe('P')
  })

  it('3:e hand sårbar: 11 hp + bra färg → 1♠', () => {
    expect(callSeat('S:KQ982 H:QJ4 D:K72 C:43', 3, true)).toBe('1S') // 11 hp / 10 TP
  })

  it('kvalitetsgrinden: 10 hp med skräpfärg (0 topphonnörer) → pass', () => {
    expect(callSeat('S:J8765 H:AK4 D:Q72 C:43', 3)).toBe('P')
  })

  it('aldrig lätt öppning i MINOR: 10 hp + bra ruter → pass', () => {
    expect(callSeat('S:43 H:A54 D:KQJ98 C:872', 3)).toBe('P')
  })

  it('3:e hand: bra 6-korts major med 11 hp → 1♠ (före svag tvåa; 1:a hand: 2♠)', () => {
    const h = 'S:KQ9872 H:A54 D:Q2 C:43' // 11 hp / 11 TP (under Steg A-golvet)
    expect(callSeat(h, 3)).toBe('1S')
    expect(callSeat(h, 1)).toBe('2S')
  })

  it('4:e hand: regeln om 15 uppfylld (10 hp + 5 spader = 15) → 1♠', () => {
    const h = 'S:KJ987 H:A43 D:Q87 C:92' // 10 hp / 10 TP
    expect(callSeat(h, 4)).toBe('1S')
    expect(callSeat(h, 1)).toBe('P')
  })

  it('4:e hand: under 15 (10 hp + 4 spader = 14) → passa ut', () => {
    expect(callSeat('S:KJ87 H:A43 D:Q876 C:92', 4)).toBe('P')
  })

  it('4:e hand: hp i fel färger (11 hp + 1 spader = 12) → passa ut', () => {
    expect(callSeat('S:2 H:AQ43 D:K876 C:Q92', 4)).toBe('P')
  })

  it('4:e hand: svag tvåa-hand under golvet → passa ut (ingen spärr i 4:e)', () => {
    const h = 'S:2 H:KQJ982 D:Q76 C:932' // 8 hp – i 1:a hand svag tvåa
    expect(callSeat(h, 4)).toBe('P')
    expect(callSeat(h, 1)).toBe('2H')
  })

  it('4:e hand: riktig öppningshand öppnar som vanligt (oavsett spader)', () => {
    expect(callSeat('S:2 H:AQ43 D:KQ76 C:Q92', 4)).toBe('1D') // 13 hp
  })
})

// ---- FAS 7 punkt 32: Regel 2-3-4 – kvalitetsgrind på spärröppningen ---------
// Ägarbeslut 2026-07-01: topphonnörer (A/K/Q) i den långa färgen, modulerat av
// sårbarhet. 3-läget: ej sårbar ≥1, sårbar ≥2. 4-läget: ej sårbar valfri, sårbar ≥1.
describe('Regel 2-3-4 – sårbarhet + färgkvalitet styr spärröppningen', () => {
  it('sund färg (2 topphonnörer) spärrar på 3-läget i BÅDA zonerna', () => {
    const h = 'S:KQJ7432 H:8 D:Q72 C:95' // ♠KQ = 2 topphonnörer
    expect(callVul(h, false)).toBe('3S')
    expect(callVul(h, true)).toBe('3S')
  })

  it('en topphonnör: 3♠ ej sårbar, men PASS sårbar', () => {
    const h = 'S:KJ97432 H:8 D:Q72 C:95' // ♠K = 1 topphonnör
    expect(callVul(h, false)).toBe('3S')
    expect(callVul(h, true)).toBe('P')
  })

  it('skräpfärg (0 topphonnörer) spärrar ALDRIG på 3-läget', () => {
    const h = 'S:JT97432 H:8 D:Q72 C:95' // ♠ ingen A/K/Q (T = tian)
    expect(callVul(h, false)).toBe('P')
    expect(callVul(h, true)).toBe('P')
  })

  it('8-korts färg med en topphonnör → 4♠ i båda zonerna', () => {
    const h = 'S:KJT97432 H:8 D:Q7 C:96' // 8 spader, ♠K = 1 topp
    expect(callVul(h, false)).toBe('4S')
    expect(callVul(h, true)).toBe('4S')
  })

  it('8-korts skräpfärg (0 topp): 4♠ ej sårbar, PASS sårbar', () => {
    const h = 'S:JT987432 H:8 D:Q7 C:96' // 8 spader, ingen A/K/Q
    expect(callVul(h, false)).toBe('4S')
    expect(callVul(h, true)).toBe('P')
  })
})
