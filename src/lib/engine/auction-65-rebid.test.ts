// F5/A3 (6-5-öppningen, felrapport #32): FACIT FÖRE FIX.
//
// Öppningsregeln (2026-07-07): 6-korts minor + 5-korts högfärg öppnar MINORN
// med 16+ — poängen är att kunna reverse:a in högfärgen och visa 6-5 med extra
// styrka. F5 verifierar att ÅTERBUDET faktiskt gör det i alla tre svarsvägar:
//   1. svararen bjuder ny färg på 1-läget → reverse 2M (fanns, låses här)
//   2. svararen svarar 2/1 GF → högfärgen visas naturligt (fanns, låses här)
//   3. svararen svarar 1NT (6–10) → HÅLET: motorn rebjöd 3m och gömde
//      högfärgen — 5-3-fiten i högfärgen gick förlorad. Nu: 2M (reverse).
// Probe-fakta 2026-08-08: mönstret är sällsynt i spel (10 händer / 16 000;
// nästan alla öppnar 2♣ på 8½+ spelstick) — därför enhetsfacit, inte volymkrav.
import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { openerRebidAfter1LevelResponse, openerRebidAfter2over1, openerRebidAfterLimitedResponse } from './rebids'
import { classifyOpening } from './openings'

// 16 hp, 1-5-6-1 med spridda honnörer (8 spelstick — under 2♣-gränsen 8½,
// kommandot: playingTricks i evaluation.ts): öppnar 1♦, ska sedan visa hjärtern.
const sixFive = parseHand('S:A H:AQJ93 D:K98432 C:Q')

describe('F5/A3 — 6-5-återbudet efter 16+ 1♦-öppning', () => {
  it('öppningen: 16+ med 6♦+5♥ öppnar 1♦ (förutsättningen)', () => {
    expect(classifyOpening(sixFive, false).call).toBe('1D')
  })

  it('efter 1♦–1♠: reverse 2♥ (fanns — låses)', () => {
    const r = openerRebidAfter1LevelResponse(sixFive, 'diamonds', 'spades')
    expect(r.call).toBe('2H')
    expect(r.rule).toBe('reverse')
  })

  it('efter 1♦–2♣ (2/1 GF): hjärtern visas naturligt (fanns — låses)', () => {
    expect(openerRebidAfter2over1(sixFive, 'diamonds', 'clubs').call).toBe('2H')
  })

  it('HÅLET: efter 1♦–1NT ska 16+ 6-5 reversa 2♥, inte gömma högfärgen i 3♦', () => {
    const r = openerRebidAfterLimitedResponse(sixFive, { call: '1NT', rule: '1NT', explanation: '' }, 'diamonds')
    expect(r.call).toBe('2H')
  })

  it('vakt: 16+ 6♦ UTAN 5-korts högfärg rebjuder 3♦ som förr efter 1NT', () => {
    const noMajor = parseHand('S:43 H:AK9 D:AKJT42 C:Q3') // 17 hp, 6♦, ingen 5-korts högfärg
    const r = openerRebidAfterLimitedResponse(noMajor, { call: '1NT', rule: '1NT', explanation: '' }, 'diamonds')
    expect(r.call).toBe('3D')
  })

  it('vakt: minimum 6♦+5♥ (12–15) öppnade högfärgen — ingen reverse att verifiera', () => {
    const min = parseHand('S:J H:KQ953 D:KQJT42 C:3') // 12 hp, 8 spelstick
    expect(classifyOpening(min, false).call).toBe('1H')
  })
})
