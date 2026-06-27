// Hålfinnaren: kör många slumphänder genom öppningsmotorn och sammanställer
// hur ofta varje regel slår till + exempel där motorn är osäker. Avslöjar
// luckor och skevheter mellan systemboken och verkligheten.

import type { Seat } from '../../types/bridge'
import { firstMajorOpeningAuction } from './auction'
import { dealRandom } from './deal'
import { handToNotation } from './hand'
import { classifyOpening, type OpeningResult } from './openings'
import type { ResponseResult } from './responses'

const SEATS: Seat[] = ['N', 'E', 'S', 'W']
const RULE_ORDER = ['1NT', '2NT', '3NT', 'stark 2♣', '5-korts högfärg', 'minor-regeln', 'svag tvåa', 'spärr', 'pass']

export interface OpeningSurvey {
  hands: number
  byRule: { rule: string; count: number; pct: number }[]
  uncertain: { notation: string; result: OpeningResult }[]
}

export function surveyOpenings(boards = 2000, maxExamples = 12): OpeningSurvey {
  const byRule = new Map<string, number>()
  const uncertain: { notation: string; result: OpeningResult }[] = []
  let hands = 0

  for (let b = 0; b < boards; b++) {
    const deal = dealRandom()
    for (const seat of SEATS) {
      const hand = deal.hands[seat]
      const result = classifyOpening(hand)
      hands++
      byRule.set(result.rule, (byRule.get(result.rule) ?? 0) + 1)
      if (result.uncertain && uncertain.length < maxExamples) {
        uncertain.push({ notation: handToNotation(hand), result })
      }
    }
  }

  const byRuleArr = [...byRule.entries()]
    .map(([rule, count]) => ({ rule, count, pct: Math.round((count / hands) * 1000) / 10 }))
    .sort((a, b) => RULE_ORDER.indexOf(a.rule) - RULE_ORDER.indexOf(b.rule))

  return { hands, byRule: byRuleArr, uncertain }
}

// ---- Hålfinnare för svar på 1♥/1♠ ----------------------------------------

export interface ResponseSurvey {
  auctions: number
  byRule: { rule: string; count: number; pct: number }[]
  uncertain: { notation: string; result: ResponseResult }[]
}

export function surveyResponses(boards = 5000, maxExamples = 12): ResponseSurvey {
  const byRule = new Map<string, number>()
  const uncertain: { notation: string; result: ResponseResult }[] = []
  let auctions = 0

  for (let b = 0; b < boards; b++) {
    const deal = dealRandom()
    const a = firstMajorOpeningAuction(deal)
    if (!a) continue
    auctions++
    byRule.set(a.response.rule, (byRule.get(a.response.rule) ?? 0) + 1)
    if (a.response.uncertain && uncertain.length < maxExamples) {
      uncertain.push({ notation: handToNotation(deal.hands[a.responderSeat]), result: a.response })
    }
  }

  const byRuleArr = [...byRule.entries()]
    .map(([rule, count]) => ({ rule, count, pct: Math.round((count / auctions) * 1000) / 10 }))
    .sort((a, b) => b.count - a.count)

  return { auctions, byRule: byRuleArr, uncertain }
}
