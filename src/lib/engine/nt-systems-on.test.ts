// SYSTEMS ON EFTER VÅRT 1NT I KONKURRENS — facit för ägarens spec 2026-09-18
// (felrapport #77, docs/1nt-systems-on-plan.md, systemboken §7.5). Varje test är
// ett av ägarens svar på en direkt fråga — inget här är Claudes gissning.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { systemsOnResponse } from './nt-systems-on'

const svar = (hand: string, their: string) => systemsOnResponse(parseHand(hand), their)
const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid } as ResolvedCall)

/** Nord öppnar 1NT (16 hp, 4 spader), Öst stör, Syd = handen under prov. */
function giv(S: string, N = 'S:KJ62 H:A6 D:KJ93 C:A84'): Deal {
  // Öst/Väst fylls med resten — bara N/S-händerna läses av besluten som provas.
  return {
    id: 't', board: 1, dealer: 'N', vulnerability: 'none',
    hands: { N: parseHand(N), E: parseHand('S:- H:- D:- C:-'), S: parseHand(S), W: parseHand('S:- H:- D:- C:-') },
  } as Deal
}

describe('felrapport #77 – Texas står kvar över deras inkliv', () => {
  const SYD = 'S:Q87 H:KQT985 D:Q2 C:JT' // 10 hp, sex hjärter
  it('1NT–(2♣)–4♦ = Texas (ägaren: "hade velat bjuda texas transfer dvs 4 ruter")', () => {
    expect(svar(SYD, '2C')).toMatchObject({ call: '4D', rule: 'Texas' })
  })
  it('öppnaren fullföljer 4♥ trots störningen (förr: 5♦)', () => {
    const d = giv(SYD)
    const r = decideCall(d, [call('N', '1NT'), call('E', '2C'), call('S', '4D'), call('W', 'P')], 'N')
    expect(r.bid).toBe('4H')
  })
  it('live: Syd bjuder 4♦ i rapportens auktion', () => {
    const d = giv(SYD)
    expect(decideCall(d, [call('N', '1NT'), call('E', '2C')], 'S').bid).toBe('4D')
  })
})

describe('stulet bud – X = budet de tog (2♣ och 2♦)', () => {
  it('deras 2♣: X = Stayman', () => {
    expect(svar('S:KJ82 H:AQ72 D:T3 C:J42', '2C')).toMatchObject({ call: 'X', rule: 'stulet bud: Stayman' })
  })
  it('deras 2♦: X = överföring till hjärter (även svag hand)', () => {
    expect(svar('S:872 H:KT985 D:Q2 C:T42', '2D')).toMatchObject({ call: 'X', rule: 'stulet bud: överföring' })
  })
  it('deras 2♣: överföringarna står kvar (2♦ = hjärter, 2♥ = spader)', () => {
    expect(svar('S:872 H:KT985 D:Q2 C:T42', '2C').call).toBe('2D')
    expect(svar('S:KT985 H:872 D:Q2 C:T42', '2C').call).toBe('2H')
  })
  it('öppnaren svarar Stayman-X som ostört (2♠ med fyra spader)', () => {
    const d = giv('S:KJ82 H:AQ72 D:T3 C:J42', 'S:AQ62 H:K6 D:KJ93 C:A84')
    const r = decideCall(d, [call('N', '1NT'), call('E', '2C'), call('S', 'X'), call('W', 'P')], 'N')
    expect(r.bid).toBe('2S')
  })
  it('öppnaren fullföljer överförings-X med 2♥', () => {
    const d = giv('S:872 H:KT985 D:Q2 C:T42')
    const r = decideCall(d, [call('N', '1NT'), call('E', '2D'), call('S', 'X'), call('W', 'P')], 'N')
    expect(r.bid).toBe('2H')
  })
  it('tappad Stayman under deras 2♦: jämna vägen (3NT med stopp, annars pass)', () => {
    expect(svar('S:KJ82 H:AQ72 D:QT3 C:J42', '2D').call).toBe('3NT') // stopp ♦QT3
    expect(svar('S:KJ82 H:AQ72 D:T3 C:Q42', '2D').call).toBe('P') // inget ruterstopp
  })
})

describe('deras 2♥/2♠ – X = 8+ med fyrkorts högfärg, överföring på 3-läget', () => {
  it('X = värden 8+ med fyrkorts andra högfärg', () => {
    expect(svar('S:KJ82 H:72 D:KT3 C:Q742', '2H')).toMatchObject({ call: 'X', rule: 'värde-X med högfärg (stört 1NT)' })
    expect(svar('S:72 H:KJ82 D:KT3 C:Q742', '2S').call).toBe('X')
  })
  it('femkorts högfärg och 8+ → överföring på 3-läget (3♦→♥, 3♥→♠)', () => {
    expect(svar('S:72 H:KJ982 D:KT3 C:Q74', '2S').call).toBe('3D')
    expect(svar('S:KJ982 H:72 D:KT3 C:Q74', '2H').call).toBe('3H')
  })
  it('svag hand (0–7) med femkortsfärg passar', () => {
    expect(svar('S:KJ982 H:72 D:T43 C:874', '2H').call).toBe('P')
  })
  it('2♠ över deras 2♥ = Minor Suit Stayman (systems on)', () => {
    expect(svar('S:A2 H:7 D:KQJ82 C:AQ742', '2H')).toMatchObject({ call: '2S', rule: 'Minor Suit Stayman' })
  })
  it('jämn hand: 2NT (8–9) / 3NT (10+) med stopp; utan stopp pass', () => {
    expect(svar('S:Q82 H:KT7 D:QT43 C:J74', '2H').call).toBe('2NT') // 8 hp, stopp ♥KT7
    expect(svar('S:Q82 H:KT7 D:KT43 C:Q74', '2H').call).toBe('3NT') // 10 hp
    expect(svar('S:Q82 H:743 D:KT43 C:KJ4', '2H').call).toBe('P') // 9 hp, inget stopp
  })
  it('öppnaren svarar värde-X: fit → lägsta nivå (2♠), aldrig straffpass', () => {
    const d = giv('S:Q982 H:72 D:AT3 C:Q742') // Nord har fyra spader
    const r = decideCall(d, [call('N', '1NT'), call('E', '2H'), call('S', 'X'), call('W', 'P')], 'N')
    expect(r.bid).toBe('2S')
  })
  it('öppnaren svarar värde-X utan fit: 2NT minimum / 3NT maximum', () => {
    const min = giv('S:Q982 H:72 D:AT3 C:Q742', 'S:K62 H:AJ6 D:KJ93 C:K84') // 15 hp, tre spader
    expect(decideCall(min, [call('N', '1NT'), call('E', '2H'), call('S', 'X'), call('W', 'P')], 'N').bid).toBe('2NT')
    const max = giv('S:Q982 H:72 D:AT3 C:Q742', 'S:K62 H:AJ6 D:KQ93 C:AJ4') // 17 hp
    expect(decideCall(max, [call('N', '1NT'), call('E', '2H'), call('S', 'X'), call('W', 'P')], 'N').bid).toBe('3NT')
  })
  it('öppnaren fullföljer 3-lägesöverföringen med BARA 3M — även med maximum och stöd', () => {
    const d = giv('S:72 H:KJ982 D:KT3 C:Q74', 'S:K62 H:AQ6 D:KQ93 C:A84') // 17 hp, tre hjärter
    expect(decideCall(d, [call('N', '1NT'), call('E', '2S'), call('S', '3D'), call('W', 'P')], 'N').bid).toBe('3H')
  })
  it('svararen efter 3M: pass med 8–9, 3NT med fem kort och 10+, 4M med sex', () => {
    const h = [call('N', '1NT'), call('E', '2S'), call('S', '3D'), call('W', 'P'), call('N', '3H'), call('E', 'P')]
    expect(decideCall(giv('S:72 H:KJ982 D:QT3 C:J74'), h, 'S').bid).toBe('P') // 8 hp
    expect(decideCall(giv('S:72 H:KJ982 D:KT3 C:K74'), h, 'S').bid).toBe('3NT') // 11 hp, fem
    expect(decideCall(giv('S:72 H:KJ9852 D:AT3 C:K7'), h, 'S').bid).toBe('4H') // sex kort (slamintresse-handen)
  })
})

describe('deras X – systems on, XX = värden', () => {
  it('Stayman, överföring och Texas som ostört', () => {
    expect(svar('S:KJ82 H:AQ72 D:T3 C:J42', 'X').call).toBe('2C')
    expect(svar('S:872 H:KT985 D:Q2 C:T42', 'X').call).toBe('2D')
    expect(svar('S:Q87 H:KQT985 D:Q2 C:JT', 'X').call).toBe('4D')
  })
  it('jämn hand 8+ utan systembud → XX (värden)', () => {
    expect(svar('S:Q82 H:KT7 D:KT43 C:Q74', 'X')).toMatchObject({ call: 'XX', rule: 'straff/värden' })
  })
})

describe('pass först, straff-X i andra ronden · öppnarens återöppning', () => {
  it('jämn 9 hp utan stopp passar 2♣, och dubblar när budet kommer tillbaka', () => {
    const d = giv('S:Q82 H:K43 D:KT43 C:742') // 8 hp, inget klöverstopp
    expect(decideCall(d, [call('N', '1NT'), call('E', '2C')], 'S').bid).toBe('P')
    const h = [call('N', '1NT'), call('E', '2C'), call('S', 'P'), call('W', '2D'), call('N', 'P'), call('E', 'P')]
    expect(decideCall(d, h, 'S')).toMatchObject({ bid: 'X', rule: 'straff-X (andra ronden)' })
  })
  // Ägarbeslut 2026-09-18 (mätning: blinda straff-X dubblade hem deras 2♠, −870/−470):
  // straff-X i andra ronden kräver 8+ hp OCH minst tre kort i färgen de spelar.
  it('straff-X kräver 3+ kort i deras färg: 9 hp men dubbelton ruter → pass, inte X', () => {
    const d = giv('S:K82 H:KJ43 D:T4 C:Q432') // 9 hp, bara två ruter
    const h = [call('N', '1NT'), call('E', '2C'), call('S', 'P'), call('W', '2D'), call('N', 'P'), call('E', 'P')]
    expect(decideCall(d, h, 'S').bid).toBe('P')
  })
  it('öppnaren passar 1NT–(2♦)–P–P utan femkorts högfärg', () => {
    const d = giv('S:Q82 H:743 D:T43 C:J742')
    expect(decideCall(d, [call('N', '1NT'), call('E', '2D'), call('S', 'P'), call('W', 'P')], 'N').bid).toBe('P')
  })
  it('öppnaren återöppnar med femkorts högfärg på 2-läget', () => {
    const d = giv('S:Q82 H:743 D:T43 C:J742', 'S:KJ962 H:A6 D:KJ9 C:A84')
    expect(decideCall(d, [call('N', '1NT'), call('E', '2D'), call('S', 'P'), call('W', 'P')], 'N').bid).toBe('2S')
  })
})
