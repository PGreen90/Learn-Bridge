import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import { exclusionInvestigation, mssMinorFitContinuation, slamInvestigation } from './slam-auction'

// =============================================================================
// ÄRLIGA SLAMPORTAR (ägarbeslut 2026-07-07): kaptenen beslutar på SIN hand +
// partnerns VISADE minimum (SlamContext.partnerMin) — aldrig partnerns kort.
// Testerna här låser den ärliga mekaniken: driv (33+), inbjudan (31–32),
// härledning ur 1430-svaret, mänsklig inferens (visad 15+ → anta högt),
// partner-rättelsen (visad <15 → anta lågt, partnern med högt lyfter själv).
// =============================================================================

describe('FAS 4 punkt 18 – kaptenen nedvärderar egna honnörer mot partnerns VISADE kortfärg', () => {
  // Öppnaren visade singel hjärter (Jacoby-kortfärg, visat minimum 16 i testet);
  // svararens KQ i hjärter är dött. Rått ligger kaptenen i slamzon (18+16=34),
  // efter nedvärderingen faller det under → ingen RKC.
  const opener = parseHand('S:AKQ54 H:5 D:AQ54 C:KJ4')
  const responder = parseHand('S:QJ86 H:KQ2 D:KQ2 C:AJ2') // 18 hp jämnt

  it('utan kortfärgs-info: egen hand + visat minimum i slamzon → slam utreds', () => {
    expect(slamInvestigation(opener, responder, 'spades', '3H', { partnerMin: 16 })).not.toBeNull()
  })
  it('med öppnarens visade korta hjärter: nedvärderas under zonen → ingen slam (null)', () => {
    expect(slamInvestigation(opener, responder, 'spades', '3H', { partnerMin: 16 }, 'hearts')).toBeNull()
  })
})

describe('slamInvestigation – ärlig RKC (driv-zonen: egen hand + visat minimum ≥ 33)', () => {
  it('visad 16+: tvetydigt svar (0 eller 3) antas HÖGT (mänsklig inferens) → 6 i trumf', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:KJ7 C:82') // 3 nyckelkort → svarar 5♦ (0/3)
    const responder = parseHand('S:J762 H:AQ5 D:AQ64 C:K3') // 17 hp, 2 egna nyckelkort
    const turns = slamInvestigation(opener, responder, 'spades', undefined, { partnerMin: 16 })!
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5D', '6S'])
    expect(turns[0].rule).toBe('1430 RKC')
    expect(turns[2].rule).toBe('slamavslut')
  })

  it('visad <15: tvetydigt svar antas LÅGT → kaptenen stannar 5-trumf; partnern med det HÖGA antalet RÄTTAR till 6', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:KJ7 C:82') // 3 nyckelkort (det HÖGA av 0/3)
    const responder = parseHand('S:A762 H:AKQ D:KQJ C:K32') // 22 hp, 2 egna nyckelkort
    const turns = slamInvestigation(opener, responder, 'spades', undefined, { partnerMin: 12 })!
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5D', '5S', '6S'])
    expect(turns[2].rule).toBe('RKC: stopp')
    expect(turns[3].rule).toBe('RKC: rättelse') // öppnaren vet: jag visade 0 ELLER 3, jag har 3
  })

  it('entydigt svar (5♠ = 2 med dam; egen hand utesluter 5) → direkt 6 i trumf', () => {
    const opener = parseHand('S:AKQ85 H:K43 D:QJ7 C:Q2') // 2 nyckelkort + trumfdam → 5♠
    const responder = parseHand('S:J762 H:AQ5 D:AK4 C:K53') // 17 hp, 2 egna nyckelkort
    const turns = slamInvestigation(opener, responder, 'spades', undefined, { partnerMin: 16 })!
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5S', '6S'])
  })

  it('storslam kräver VISSHET: entydigt alla fem + dam + storslamszon mot visat minimum → 5NT-kungfråga → 7', () => {
    const opener = parseHand('S:KJ985 H:K43 D:52 C:K62') // 1 nyckelkort (♠K), två sidokungar
    const responder = parseHand('S:AQ76 H:A5 D:AKQ3 C:A53') // 23 hp, 4 egna nyckelkort + ♠Q
    const turns = slamInvestigation(opener, responder, 'spades', undefined, { partnerMin: 16 })!
    // eget 4 + svar 5♣ (1 eller 4; 4 omöjligt) = entydigt 5 → kungfråga; 2 sidokungar → 7♠ direkt av öppnaren
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5C', '5NT', '7S'])
    expect(turns[2].rule).toBe('Sjöberg 5NT')
  })

  it('under kanske-zonen → null (ingen slamutredning, vanlig auktion fortsätter)', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:A52 C:A2')
    const responder = parseHand('S:J7642 H:Q86 D:Q3 C:Q42') // svag
    expect(slamInvestigation(opener, responder, 'spades', undefined, { partnerMin: 16 })).toBeNull()
  })
})

describe('slamInvestigation – kanske-zonen (31–32): inbjudan, partnern dömer på SIN hand', () => {
  const responder = parseHand('S:J762 H:KQ5 D:AQ6 C:K84') // 16 hp jämnt → 16+16 = 32

  it('partnern över blott minimum → accepterar 6', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:K72 C:92') // 17 – mer än visat minimum 16
    const turns = slamInvestigation(opener, responder, 'spades', undefined, { partnerMin: 16, inviteCall: '5S' })!
    expect(turns.map((t) => t.call)).toEqual(['5S', '6S'])
    expect(turns[0].rule).toBe('slaminbjudan')
    expect(turns[1].rule).toBe('slaminbjudan: accept')
  })

  it('ingen inbjudningsväg i läget (inviteCall saknas) → null', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:K72 C:92')
    expect(slamInvestigation(opener, responder, 'spades', undefined, { partnerMin: 16 })).toBeNull()
  })
})

describe('buildAuction – slam växer fram via Jacoby 2NT (ärligt: 3♠ visade 16+)', () => {
  it('1S–2NT–3S–4NT–5D–6S i en hel auktion (ingen cue-rond längre)', () => {
    const deal: Deal = {
      id: 'slam-jacoby',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:AKQ85 H:A432 D:K2 C:32'), // 16 hp → 1S, Jacoby-svar → 3S (slamintresse, 16+)
        E: parseHand('S:T943 H:876 D:T43 C:765'), // svag → inget inkliv
        S: parseHand('S:J762 H:KQ5 D:AQ6 C:KQ4'), // 17 hp + visade 16 = 33 → driv
        W: parseHand('S:- H:JT9 D:J9875 C:AJT98'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['1S', '2NT', '3S', '4NT', '5D', '6S'])
    expect(a.open).toBe(false)
  })
})

describe('exclusionInvestigation – ärlig voidwood efter splinter (visat minimum 15)', () => {
  it('renons under trumf, entydigt inga saknade nyckelkort → storslam', () => {
    const opener = parseHand('S:AQ752 H:KQ4 D:KJ3 C:K6')
    const responder = parseHand('S:KJ43 H:A752 D:AQ876 C:-') // klöverrenons; egen hand + visade 15 = slamzon
    const turns = exclusionInvestigation(opener, responder, 'spades', 15)!
    expect(turns.map((t) => t.call)).toEqual(['5C', '5D', '7S'])
    expect(turns[0].rule).toBe('Exclusion')
  })

  it('renons som rankar ÖVER trumf (spader över hjärter) → 5♠, entydigt komplett → storslam', () => {
    const opener = parseHand('S:- H:AQ752 D:KQ43 C:A542') // ♥A+♣A → steg 4 (2 m. dam) = 6♥
    const responder = parseHand('S:- H:KJT98 D:A765 C:KQJ3') // ♦A+♥K = 2 egna → 4 av 4
    const turns = exclusionInvestigation(opener, responder, 'hearts', 15)!
    expect(turns.map((t) => t.call)).toEqual(['5S', '6H', '7H'])
    expect(turns[0].rule).toBe('Exclusion')
  })

  it('svaret satte redan nivån (steg 4 = 6 i trumf, ett nyckelkort saknas) → kaptenen passar', () => {
    const opener = parseHand('S:32 H:AQJ42 D:QJ9 C:A65') // 2 nyckelkort + trumfdam → steg 4 = 6♥
    const responder = parseHand('S:- H:T9843 D:AK76 C:KQJ2') // 1 eget → totalt 3, ett saknas → mål 6♥ = redan bjudet
    const turns = exclusionInvestigation(opener, responder, 'hearts', 15)!
    expect(turns.map((t) => t.call)).toEqual(['5S', '6H', 'P'])
    expect(turns[2].rule).toBe('slamavslut')
  })

  it('två+ nyckelkort saknas (entydigt ur svaret) → stannar ärligt i 5-trumf efter frågan', () => {
    const opener = parseHand('S:QJ43 H:KJ6 D:K84 C:KQ87') // 0 nyckelkort → steg 2 (0/3)
    const responder = parseHand('S:AT762 H:AQ2 D:QJ43 C:-') // 2 egna; 0/3 + egna 2 → 3 omöjligt (pool 4) → entydigt 0
    const turns = exclusionInvestigation(opener, responder, 'spades', 15)!
    expect(turns.map((t) => t.call)).toEqual(['5C', '5H', '5S'])
    expect(turns[2].rule).toBe('Exclusion: stopp')
  })

  it('ingen sidorenons → null', () => {
    const opener = parseHand('S:AQ752 H:KQ4 D:KJ3 C:K6')
    const responder = parseHand('S:KJ43 H:A75 D:AQ87 C:62')
    expect(exclusionInvestigation(opener, responder, 'spades', 15)).toBeNull()
  })

  it('egen hand + visat minimum under slamzon → null (frågar aldrig)', () => {
    const opener = parseHand('S:AQ752 H:KQ4 D:KJ3 C:K6')
    const responder = parseHand('S:KJ43 H:9752 D:98762 C:-') // renons men bara ~5 hp
    expect(exclusionInvestigation(opener, responder, 'spades', 15)).toBeNull()
  })
})

describe('mssMinorFitContinuation – MSS-slam (ärligt: egen hand mot visade 15–17)', () => {
  it('NT-säker slamzon → 4NT RKC, svar antas högt (visad 15+) → 6NT', () => {
    const opener = parseHand('S:AJ3 H:AQ3 D:K32 C:K654') // 17, 3 nyckelkort → 5♦ (0/3)
    const responder = parseHand('S:K2 H:K2 D:AQJ54 C:AQ32') // 19 hp + visade 15 = 34
    const turns = mssMinorFitContinuation(opener, responder, 'clubs', '3C')
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5D', '6NT'])
    expect(turns[2].rule).toBe('slamavslut')
  })

  it('storslam kräver visshet: entydigt alla fem + dam + storslamszon → 5NT-kungfråga → 7NT', () => {
    const opener = parseHand('S:QJ4 H:AQ2 D:KJ3 C:K965') // 16, 2 nyckelkort utan trumfdam → 5♥ (entydigt)
    const responder = parseHand('S:AK8 H:KJ D:AQ42 C:AQJ8') // 24 hp, 3 egna nyckelkort + ♣Q
    const turns = mssMinorFitContinuation(opener, responder, 'clubs', '3C')
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5H', '5NT', '6D', '7NT'])
    expect(turns[2].rule).toBe('Sjöberg 5NT')
  })

  it('NT-säkert men egen hand + visade 15 under slamzon → 3NT (ingen fråga)', () => {
    const opener = parseHand('S:Q32 H:AKQ D:K32 C:J542')
    const responder = parseHand('S:AK2 H:Q2 D:AQ842 C:Q83') // 17 + 15 = 32 → ej slamzon
    const turns = mssMinorFitContinuation(opener, responder, 'clubs', '3C')
    expect(turns.map((t) => t.call)).toEqual(['3NT'])
  })

  it('högfärgslucka på EGEN hand (xx i hjärter) → minor-spåret (klövermål, aldrig NT)', () => {
    const opener = parseHand('S:AKQ H:432 D:K3 C:AJ642')
    const responder = parseHand('S:J2 H:65 D:AKQ54 C:KQ83') // ♥65 utan topphonnör → NT osäkert
    const turns = mssMinorFitContinuation(opener, responder, 'clubs', '3C')
    const last = turns[turns.length - 1].call
    expect(last.endsWith('C')).toBe(true) // klövermål (6♣/5♣/4♣-inbjudan), aldrig NT
    expect(turns.some((t) => t.call.includes('NT') && t.call !== '4NT')).toBe(false)
  })

  it('högfärgslucka + för svagt → minorutgång 5♣ (inte 3NT)', () => {
    const opener = parseHand('S:AKQ H:432 D:K32 C:J542')
    const responder = parseHand('S:J2 H:65 D:KQ654 C:KQ83')
    const turns = mssMinorFitContinuation(opener, responder, 'clubs', '3C')
    expect(turns.map((t) => t.call)).toEqual(['5C'])
    expect(turns[0].rule).toBe('MSS: minorutgång')
  })
})

describe('buildAuction – MSS-slam växer fram (FAS 8)', () => {
  it('1NT–2♠–3♣–4NT–5D–6NT i en hel auktion (NT-säker minorfit-slam)', () => {
    const deal: Deal = {
      id: 'slam-mss',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:AJ3 H:AQ3 D:K32 C:K654'), // 17 balanserad → 1NT
        E: parseHand('S:QT98 H:JT98 D:T9 C:JT9'), // svag → passar
        S: parseHand('S:K2 H:K2 D:AQJ54 C:AQ32'), // 19, 5-4 minorer, ingen 4-korts hf → 2♠ MSS
        W: parseHand('S:7654 H:7654 D:876 C:87'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['1NT', '2S', '3C', '4NT', '5D', '6NT'])
    expect(a.open).toBe(false)
  })
})

describe('buildAuction – Exclusion växer fram efter splinter (Steg 5)', () => {
  it('1S–3H(splinter)–3S(relä)–5C(Exclusion)–5D–7S', () => {
    const deal: Deal = {
      id: 'slam-exclusion',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:AQ752 H:KQ4 D:KJ3 C:K6'), // 18 hp, 5 spader → 1S, slamintresse → relä
        E: parseHand('S:T9 H:T98 D:T95 C:98743'), // svag → inget inkliv
        S: parseHand('S:KJ43 H:A752 D:AQ876 C:-'), // 4 spader + klöverrenons → splinter
        W: parseHand('S:86 H:J63 D:42 C:AQJT52'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['1S', '3H', '3S', '5C', '5D', '7S'])
    expect(a.open).toBe(false)
  })

  it('renons över trumf: 1H–3S(splinter)–3NT(relä)–5S(Exclusion)–6H–7H', () => {
    const deal: Deal = {
      id: 'slam-exclusion-hearts',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:AQ3 H:AKQ85 D:42 C:K76'), // 18 hp, 5 hjärter → 1H, slamintresse → relä
        E: parseHand('S:642 H:73 D:JT93 C:T985'), // svag, ingen 5-färg → inget inkliv
        S: parseHand('S:- H:JT964 D:AKQ5 C:A432'), // 4+ hjärter + spaderrenons → splinter, sedan Exclusion
        W: parseHand('S:KJT985 H:2 D:876 C:QJ'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['1H', '3S', '3NT', '5S', '6H', '7H'])
    expect(a.open).toBe(false)
  })
})
