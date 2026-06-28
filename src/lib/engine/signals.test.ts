import { describe, expect, it } from 'vitest'
import type { Card, Rank, Suit } from '../../types/bridge'
import { attitudeCard, countCard, honorLead, lavinthalDiscard, leadFromSuit, spotLead } from './signals'

const C = (rank: Rank, suit: Suit = 'spades'): Card => ({ suit, rank })
const cards = (...ranks: Rank[]): Card[] => ranks.map((r) => C(r))

describe('§8.3 honnörsutspel – topp av sekvens', () => {
  it('A-K-x → A', () => expect(honorLead(cards('A', 'K', '5'))).toEqual(C('A')))
  it('K-Q-x → K', () => expect(honorLead(cards('K', 'Q', '4'))).toEqual(C('K')))
  it('Q-J-x → Q', () => expect(honorLead(cards('Q', 'J', '7'))).toEqual(C('Q')))
  it('J-10-x → J', () => expect(honorLead(cards('J', '10', '3'))).toEqual(C('J')))
  it('A-K dubbelton → A', () => expect(honorLead(cards('A', 'K'))).toEqual(C('A')))
  it('K-Q-J → K (längre sekvens, fortfarande toppen)', () =>
    expect(honorLead(cards('K', 'Q', 'J', '2'))).toEqual(C('K')))
  it('ingen topp-sekvens (A-Q-J, glapp) → null', () =>
    expect(honorLead(cards('A', 'Q', 'J'))).toBeNull())
  it('spotkort i rad (8-7-6, ingen honnör) → null', () =>
    expect(honorLead(cards('8', '7', '6'))).toBeNull())
  it('singelton → null', () => expect(honorLead(cards('K'))).toBeNull())
})

describe('§8.3 spotkortsutspel – 3:e/5:e bästa', () => {
  it('jämn 4-korts → 3:e bästa', () =>
    expect(spotLead(cards('K', '9', '6', '3'))).toEqual(C('6')))
  it('jämn 6-korts → 3:e bästa', () =>
    expect(spotLead(cards('Q', '10', '8', '5', '4', '2'))).toEqual(C('8')))
  it('udda 5-korts → lägsta (5:e bästa)', () =>
    expect(spotLead(cards('A', '9', '7', '5', '3'))).toEqual(C('3')))
  it('udda 3-korts → lägsta', () =>
    expect(spotLead(cards('K', '8', '4'))).toEqual(C('4')))
  it('dubbelton → högsta (topp av dubbelton)', () =>
    expect(spotLead(cards('8', '3'))).toEqual(C('8')))
})

describe('§8.3 leadFromSuit – honnör före spot', () => {
  it('sekvens finns → honnörsutspel', () =>
    expect(leadFromSuit(cards('Q', 'J', '10', '4'))).toEqual(C('Q')))
  it('ingen sekvens, jämn längd → 3:e bästa', () =>
    expect(leadFromSuit(cards('K', '9', '6', '3'))).toEqual(C('6')))
  it('ingen sekvens, udda längd → lägsta', () =>
    expect(leadFromSuit(cards('A', '9', '7', '5', '3'))).toEqual(C('3')))
})

describe('§8.1 UDCA omvänd attityd', () => {
  it('uppmuntrar → lägsta kortet', () =>
    expect(attitudeCard(cards('9', '4', '2'), true)).toEqual(C('2')))
  it('avskräcker → högsta kortet', () =>
    expect(attitudeCard(cards('9', '4', '2'), false)).toEqual(C('9')))
})

describe('§8.1 UDCA omvänd räkning', () => {
  it('jämnt antal → lågt (lågt-högt)', () =>
    expect(countCard(cards('8', '5', '3'), true)).toEqual(C('3')))
  it('udda antal → högt (högt-lågt)', () =>
    expect(countCard(cards('8', '5', '3'), false)).toEqual(C('8')))
})

describe('§8.2 Lavinthal-sak', () => {
  it('vill ha högre övriga färgen → högt sakkort', () =>
    expect(lavinthalDiscard(cards('9', '6', '2'), true)).toEqual(C('9')))
  it('vill ha lägre övriga färgen → lågt sakkort', () =>
    expect(lavinthalDiscard(cards('9', '6', '2'), false)).toEqual(C('2')))
})
