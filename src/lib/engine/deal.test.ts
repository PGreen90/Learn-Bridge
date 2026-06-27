import { describe, expect, it } from 'vitest'
import { boardInfo, dealRandom } from './deal'
import type { Seat, Vulnerability } from '../../types/bridge'

describe('boardInfo – standard-duplikatschema', () => {
  // Vem som ger: roterar N → Ö → S → V med bricknumret.
  const dealers: Array<[number, Seat]> = [
    [1, 'N'], [2, 'E'], [3, 'S'], [4, 'W'], [5, 'N'], [16, 'W'],
  ]
  it.each(dealers)('bricka %i ger %s', (board, dealer) => {
    expect(boardInfo(board).dealer).toBe(dealer)
  })

  // Zonen följer det fasta 16-brickorsmönstret (samma som BBO).
  const vulns: Array<[number, Vulnerability]> = [
    [1, 'none'], [2, 'ns'], [3, 'ew'], [4, 'all'],
    [8, 'none'], [13, 'all'], [16, 'ew'],
  ]
  it.each(vulns)('bricka %i har zon %s', (board, v) => {
    expect(boardInfo(board).vulnerability).toBe(v)
  })

  it('upprepar sig var 16:e bricka', () => {
    expect(boardInfo(17)).toEqual(boardInfo(1))
    expect(boardInfo(29)).toEqual(boardInfo(13))
  })
})

describe('dealRandom', () => {
  it('ger ett giltigt bricknummer 1–16 med matchande giv + zon', () => {
    const deal = dealRandom()
    expect(deal.board).toBeGreaterThanOrEqual(1)
    expect(deal.board).toBeLessThanOrEqual(16)
    expect(deal.dealer).toBe(boardInfo(deal.board).dealer)
    expect(deal.vulnerability).toBe(boardInfo(deal.board).vulnerability)
  })
})
