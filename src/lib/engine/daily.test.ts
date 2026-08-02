import { describe, expect, it } from 'vitest'
import { dailyDeal, dailyNumber, dailySeed, shareText } from './daily'

// Dagens giv (faceliften/konkurrensspåret 2026-08-02): samma datum ska ALLTID ge
// samma giv — det är hela poängen (alla spelar samma giv och kan jämföra sig).

describe('dagens giv', () => {
  it('samma datum ger exakt samma giv', () => {
    const a = dailyDeal(new Date(2026, 7, 2, 9, 0))
    const b = dailyDeal(new Date(2026, 7, 2, 23, 59)) // senare på samma dag
    expect(a.hands).toEqual(b.hands)
    expect(a.board).toBe(b.board)
    expect(a.dealer).toBe(b.dealer)
    expect(a.vulnerability).toBe(b.vulnerability)
    expect(a.id).toBe(b.id)
  })

  it('olika dagar ger olika givar', () => {
    const a = dailyDeal(new Date(2026, 7, 2))
    const b = dailyDeal(new Date(2026, 7, 3))
    expect(a.hands).not.toEqual(b.hands)
  })

  it('fröet är datumet som åttasiffrigt tal (lokal tid)', () => {
    expect(dailySeed(new Date(2026, 7, 2))).toBe(20260802)
    expect(dailySeed(new Date(2026, 0, 15))).toBe(20260115)
  })

  it('givnumret räknas från premiärdagen 2026-08-02 = #1', () => {
    expect(dailyNumber(new Date(2026, 7, 2))).toBe(1)
    expect(dailyNumber(new Date(2026, 7, 3, 8, 30))).toBe(2)
    expect(dailyNumber(new Date(2026, 8, 1))).toBe(31)
  })

  it('en giv har 13 kort per hand', () => {
    const deal = dailyDeal(new Date(2026, 7, 2))
    for (const seat of ['N', 'E', 'S', 'W'] as const) {
      expect(deal.hands[seat]).toHaveLength(13)
    }
  })

  it('deltexten: hemgång med övertrick', () => {
    const text = shareText({
      number: 1,
      contract: { declarer: 'S', strain: 'spades', level: 4 },
      declarerTricks: 11,
      scoreLabel: 'N/S +450',
    })
    expect(text).toBe(
      'rebidz · Dagens giv #1\n4♠ av Syd — hemma +1\nN/S +450\nhttps://rebidz.com/#/spela-kort/dagens',
    )
  })

  it('deltexten: straff, dubblat kontrakt och jämn hemgång', () => {
    expect(
      shareText({
        number: 7,
        contract: { declarer: 'E', strain: 'NT', level: 3, doubled: 'X' },
        declarerTricks: 7,
        scoreLabel: 'N/S +500',
      }),
    ).toContain('3NTX av Öst — 2 bet')
    expect(
      shareText({
        number: 7,
        contract: { declarer: 'N', strain: 'hearts', level: 4 },
        declarerTricks: 10,
        scoreLabel: 'N/S +420',
      }),
    ).toContain('4♥ av Nord — hemma')
  })
})
