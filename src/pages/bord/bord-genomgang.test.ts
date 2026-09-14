// FACIT för rondgenomgången vid vänner-bordet (bordens SENARE-lista etapp 1,
// 2026-09-14): ur bordets händelselogg (giv-start · bud · kort · giv-klar) ska
// genomgången få hela given, kontraktet, alla stick med rätt vinnare och
// systemiskt förklarade bud. Sticken byggs ur korthändelserna — facit är
// motorns egen genomspelning av samma kort. FACIT FÖRE FIX.

import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { BordHandelse } from '../../lib/backend/bord'
import { dealFromSeed } from '../../lib/engine/revisor'
import { isComplete, legalCards, playCard, startPlay, type Contract } from '../../lib/engine/play'
import { projiceraBord } from './bord-projektion'
import { byggBordGenomgang } from './bord-genomgang'

const DEAL = { ...dealFromSeed(7), dealer: 'N' as const }
const CONTRACT: Contract = { declarer: 'N', strain: 'NT', level: 3 }
const AUKTION: Array<[Seat, string]> = [['N', '1NT'], ['E', 'P'], ['S', '3NT'], ['W', 'P'], ['N', 'P'], ['E', 'P']]

/** Bordets logg för en hel giv: motorn spelar korten (första lagliga kortet
 *  varje gång) så händelserna är giltiga; facit = motorns completedTricks. */
function heltGivLogg() {
  let seq = 0
  const h = (typ: string, seat: Seat | null, data: unknown, giv = 1): BordHandelse => ({
    seq: ++seq, giv, typ, seat, data: data as Record<string, unknown>,
  })
  const events: BordHandelse[] = [h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'ns' })]
  for (const [seat, bid] of AUKTION) events.push(h('bud', seat, { bid }))
  let st = startPlay(DEAL, CONTRACT)
  while (!isComplete(st)) {
    const card = legalCards(st, st.toAct)[0]
    events.push(h('kort', st.toAct, { card }))
    st = playCard(st, card)
  }
  const declarerTricks = st.tricksNS
  const givKlar = h('giv-klar', null, {
    hands: DEAL.hands, contract: CONTRACT, passadUt: false, declarerTricks,
    nsScore: 0, stallning: { ns: 0, ew: 0 },
  })
  return { events, givKlar, facitStick: st.completedTricks, declarerTricks }
}

describe('byggBordGenomgang — genomgångens indata ur loggen', () => {
  it('klar giv: hela given, kontraktet, 13 stick med motorns vinnare, förklarade bud', () => {
    const { events, givKlar, facitStick, declarerTricks } = heltGivLogg()
    const lage = projiceraBord([...events, givKlar], { ns: 0, ew: 0 })!
    const g = byggBordGenomgang(lage, 'ABCD')!
    expect(g).not.toBeNull()
    expect(g.deal.hands).toEqual(DEAL.hands)
    expect(g.deal.dealer).toBe('N')
    expect(g.deal.vulnerability).toBe('ns')
    expect(g.deal.id).toBe('bord-ABCD-giv-1')
    expect(g.contract).toEqual(CONTRACT)
    expect(g.declarerTricks).toBe(declarerTricks)
    expect(g.tricks).toHaveLength(13)
    expect(g.tricks.map((t) => t.winner)).toEqual(facitStick.map((t) => t.winner))
    expect(g.tricks.map((t) => t.leader)).toEqual(facitStick.map((t) => t.leader))
    expect(g.tricks[0].cards.map((c) => c.card)).toEqual(facitStick[0].cards.map((c) => c.card))
    // Buden i verkliga stolar, alla med systemisk förklaring (ur auktionen, ej handen).
    expect(g.calls.map((c) => `${c.seat}${c.bid}`)).toEqual(AUKTION.map(([s, b]) => `${s}${b}`))
    expect(g.calls.every((c) => typeof c.explanation === 'string' && c.explanation.length > 0)).toBe(true)
  })

  it('pågående giv (ingen giv-klar än) → null', () => {
    const { events } = heltGivLogg()
    const lage = projiceraBord(events, { ns: 0, ew: 0 })!
    expect(byggBordGenomgang(lage, 'ABCD')).toBeNull()
  })

  it('utpassad giv → null (inget spel att gå igenom)', () => {
    let seq = 0
    const h = (typ: string, seat: Seat | null, data: unknown): BordHandelse => ({
      seq: ++seq, giv: 1, typ, seat, data: data as Record<string, unknown>,
    })
    const events = [
      h('giv-start', null, { board: 1, dealer: 'N', vulnerability: 'none' }),
      h('bud', 'N', { bid: 'P' }), h('bud', 'E', { bid: 'P' }), h('bud', 'S', { bid: 'P' }), h('bud', 'W', { bid: 'P' }),
      h('giv-klar', null, { hands: DEAL.hands, contract: null, passadUt: true, declarerTricks: 0, nsScore: 0, stallning: { ns: 0, ew: 0 } }),
    ]
    const lage = projiceraBord(events, { ns: 0, ew: 0 })!
    expect(byggBordGenomgang(lage, 'ABCD')).toBeNull()
  })
})
