import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import {
  respondTo2NT,
  openerRebidAfter2NTResponse,
} from './responses-2nt'
import { buildAuction } from './auction'
import type { Deal } from '../../types/bridge'

// Sedan 2026-09-15 är 3♣ över 2NT Puppet Stayman (ägardirektiv; hela
// strukturen låses i `puppet-stayman.test.ts`). Här ligger grundsvaren.
const r2 = (notation: string) => respondTo2NT(parseHand(notation))

describe('respondTo2NT – svararens svar på 2NT (20–21)', () => {
  it('pass med riktigt svag balanserad hand (ingen utgång)', () => {
    expect(r2('S:432 H:543 D:6432 C:765').call).toBe('P') // 0 hp
  })

  it('3♣ Puppet Stayman med 3-korts högfärg och utgångsvärden (letar partnerns 5-korts)', () => {
    expect(r2('S:K43 H:Q42 D:K543 C:432')).toMatchObject({ call: '3C', rule: 'Puppet Stayman' }) // 8 hp, 3-3
  })

  it('3NT till spel utan 3-korts högfärg', () => {
    expect(r2('S:K4 H:Q4 D:K5432 C:5432').call).toBe('3NT') // 8 hp, 2-2 i högfärgerna
  })

  it('3♣ Puppet Stayman med 4-korts högfärg', () => {
    expect(r2('S:KJ43 H:Q4 D:K543 C:432')).toMatchObject({ call: '3C', rule: 'Puppet Stayman' }) // 9 hp, 4 spader
  })

  it('3♦ transfer med 5-korts hjärter', () => {
    expect(r2('S:K3 H:KJ432 D:Q43 C:432').call).toBe('3D') // 9 hp, 5 hjärter
  })

  it('3♥ transfer med 5-korts spader', () => {
    expect(r2('S:KJ432 H:K3 D:Q43 C:432').call).toBe('3H') // 9 hp, 5 spader
  })

  it('transfer även med svag hand (signoff i delkontrakt)', () => {
    const res = r2('S:2 H:J87632 D:5432 C:43') // 1 hp, 6 hjärter
    expect(res.call).toBe('3D')
    expect(res.explanation).toContain('signoff')
  })

  it('Texas (4♦) med 6-korts hjärter och ren utgång', () => {
    expect(r2('S:K3 H:KQ8432 D:43 C:432').call).toBe('4D') // 8 hp, 6 hjärter → ♥
  })

  it('Texas (4♥) med 6-korts spader och ren utgång', () => {
    expect(r2('S:KQ8432 H:K3 D:43 C:432').call).toBe('4H') // 8 hp, 6 spader → ♠
  })

  it('6-korts högfärg men slamvärden → transfer (ej Texas)', () => {
    expect(r2('S:AQ8432 H:K3 D:A3 C:K32').call).toBe('3H') // 16 hp, 6 spader, slam → transfer
  })

  it('5♠4♥ → 3♣ Puppet; 5♥4♠ → 3♦ transfer (hybriden, beslut 2)', () => {
    expect(r2('S:KJ432 H:Q543 D:K4 C:43').call).toBe('3C')
    expect(r2('S:Q543 H:KJ432 D:K4 C:43').call).toBe('3D')
  })

  it('3♠ minorfråga med 5-4 minorer och slamvärden', () => {
    expect(r2('S:43 H:K3 D:AQ43 C:KQ432').call).toBe('3S') // 14 hp, 5-4 minorer
  })

  it('4NT kvantitativ med 11 balanserad utan 3-korts högfärg', () => {
    expect(r2('S:K4 H:KQ D:K65432 C:543').call).toBe('4NT') // 11 hp
  })

  it('6NT med 13+ balanserad utan 3-korts högfärg', () => {
    expect(r2('S:KQ H:KQ D:K65432 C:Q43').call).toBe('6NT') // 15 hp
  })
})

describe('openerRebidAfter2NTResponse – öppnaren fullföljer', () => {
  const puppet = respondTo2NT(parseHand('S:KJ43 H:Q4 D:K543 C:432'))
  const transferH = respondTo2NT(parseHand('S:K3 H:KJ432 D:Q43 C:432'))
  const quant = respondTo2NT(parseHand('S:K4 H:KQ D:K65432 C:543')) // 11 hp → 4NT

  it('Puppet-svar 3♦ med 4 hjärter (ingen 5-korts)', () => {
    expect(openerRebidAfter2NTResponse(puppet, parseHand('S:A43 H:AQ43 D:KQ4 C:AQ2'))!.call).toBe('3D') // 21
  })

  it('Puppet-svar 3♥ med 5 hjärter', () => {
    expect(openerRebidAfter2NTResponse(puppet, parseHand('S:A4 H:AQ432 D:KQ4 C:AQ2'))!.call).toBe('3H') // 21
  })

  it('Puppet-svar 3NT utan högfärg', () => {
    expect(openerRebidAfter2NTResponse(puppet, parseHand('S:KQ4 H:KQ4 D:KQ43 C:AQ2'))!.call).toBe('3NT') // 21
  })

  it('fullföljer transfer 3♦ → 3♥', () => {
    expect(openerRebidAfter2NTResponse(transferH, parseHand('S:KQ4 H:K43 D:AQ43 C:AK2'))!.call).toBe('3H') // 21
  })

  it('accepterar 4NT kvantitativ med max (21)', () => {
    expect(openerRebidAfter2NTResponse(quant, parseHand('S:AKQ H:A43 D:K43 C:KQ32'))!.call).toBe('6NT') // 21 hp
  })

  it('passar 4NT kvantitativ med minimum (20)', () => {
    expect(openerRebidAfter2NTResponse(quant, parseHand('S:AKQ H:A43 D:K43 C:KJ32'))!.call).toBe('P') // 20 hp
  })
})

describe('buildAuction – 2NT/3NT end-to-end (inkoppling)', () => {
  it('bygger 2NT – 3♦ – 3♥ (transfer fullföljd)', () => {
    const deal: Deal = {
      id: 'test',
      board: 1,
      dealer: 'N',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:AQ4 H:K43 D:KQ43 C:AK2'), // 21 hp balanserad → 2NT
        S: parseHand('S:K3 H:QJ432 D:765 C:765'), //  6 hp, 5 hjärter → 3♦
        E: parseHand('S:J8765 H:8 D:J98 C:Q98'),
        W: parseHand('S:T92 H:AT976 D:AT C:JT9'),
      },
    }
    const a = buildAuction(deal)
    // Turn 4 (punkt 24): 5-korts hf GF utan 6:e kort → 3NT (öppnaren väljer);
    // öppnaren har 3-korts stöd (♥K43) → 4♥ (familj 5, 2026-09-05: valet ligger i manuset).
    expect(a?.turns.slice(0, 5).map((t) => t.call)).toEqual(['2NT', '3D', '3H', '3NT', '4H'])
  })

  it('storhanden 25 balanserad öppnar 2♣ (3NT-öppningen är Gambling sedan 2026-09-14)', () => {
    const deal: Deal = {
      id: 'test',
      board: 2,
      dealer: 'N',
      vulnerability: 'none',
      hands: {
        N: parseHand('S:AKQ4 H:AQ4 D:AK4 C:K32'), // 25 hp balanserad → 2♣ (→ 3NT-återbud)
        S: parseHand('S:32 H:9853 D:Q762 C:765'), //  2 hp → pass
        E: parseHand('S:J865 H:JT6 D:JT9 C:JT9'),
        W: parseHand('S:T97 H:K72 D:853 C:AQ84'),
      },
    }
    const a = buildAuction(deal)
    expect(a?.turns.slice(0, 1).map((t) => t.call)).toEqual(['2C'])
  })
})
