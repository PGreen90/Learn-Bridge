import { describe, expect, it } from 'vitest'
import type { Deal } from '../../types/bridge'
import { parseHand } from '../bidding'
import { buildAuction } from './auction'
import { exclusionInvestigation, mssMinorFitContinuation, slamInvestigation } from './slam-auction'

describe('FAS 4 punkt 18 – slamvärdering nedvärderar honnörer mot partnerns kortfärg', () => {
  // Öppnaren visade singel hjärter (Jacoby-kortfärg); svararens KQ i hjärter är
  // dött. Rått ligger paret i slamzon (36), men efter nedvärderingen (−4) faller
  // det till 32 → RKC ska INTE startas (annars strandar man över utgång).
  const opener = parseHand('S:AKQ54 H:5 D:AQ54 C:KJ4')  // 5 spader, singel ♥
  const responder = parseHand('S:JT86 H:KQ2 D:K32 C:A32') // 4 spader, KQ ♥ (dött mot singeln)

  it('utan kortfärgs-info: rått i slamzon → slam utreds', () => {
    expect(slamInvestigation(opener, responder, 'spades', '3H')).not.toBeNull()
  })
  it('med öppnarens korta hjärter: nedvärderas under zonen → ingen slam (null)', () => {
    expect(slamInvestigation(opener, responder, 'spades', '3H', 'hearts')).toBeNull()
  })
})

describe('slamInvestigation – RKC efter högfärgsfit', () => {
  it('lillslam: cue-rond före RKC, 4 nyckelkort → 6 i trumf', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:KJ7 C:82') // 3 nyckelkort, hjärteress
    const responder = parseHand('S:J762 H:KQ5 D:AQ64 C:K3') // 1 nyckelkort, ruteress
    const turns = slamInvestigation(opener, responder, 'spades')!
    // svararen cue:ar 4♦ (ruteress), öppnaren cue:ar 4♥ (hjärteress), sedan 4NT RKC
    expect(turns.map((t) => t.call)).toEqual(['4D', '4H', '4NT', '5D', '6S'])
    expect(turns[0].rule).toBe('cue-bid')
    expect(turns[1].rule).toBe('cue-bid')
    expect(turns[2].rule).toBe('1430 RKC')
  })

  it('ingen kontroll att visa → ingen cue-rond, rakt på 4NT', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:A52 C:A2') // 5 nyckelkort
    const responder = parseHand('S:J7642 H:KQ5 D:KQ C:KQ4') // inget ess/renons → ingen cue
    const turns = slamInvestigation(opener, responder, 'spades')!
    expect(turns[0].call).toBe('4NT')
  })

  it('storslamszon, alla 5 nyckelkort + trumfdam → 5NT kungfråga; ingen sidokung → stannar i 6', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:A52 C:A2') // 5 nyckelkort, inga sidokungar
    const responder = parseHand('S:J7642 H:KQ5 D:KQ C:KQ4')
    const turns = slamInvestigation(opener, responder, 'spades')!
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5S', '5NT', '6S'])
    expect(turns[2].rule).toBe('Sjöberg 5NT') // kaptenen frågar kungar
  })

  it('storslamszon, kungfråga visar en sidokung → kaptenen lyfter till storslam (7)', () => {
    const opener = parseHand('S:AKQ85 H:AK3 D:A52 C:A2') // 5 nyckelkort + hjärterkung
    const responder = parseHand('S:J7642 H:Q5 D:KQ C:KQ43')
    const turns = slamInvestigation(opener, responder, 'spades')!
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5S', '5NT', '6H', '7S'])
    expect(turns[4].rule).toBe('slamavslut')
  })

  it('under slamzon → null (ingen slamutredning, vanlig auktion fortsätter)', () => {
    const opener = parseHand('S:AKQ85 H:A43 D:A52 C:A2')
    const responder = parseHand('S:J7642 H:Q86 D:Q3 C:Q42') // svag
    expect(slamInvestigation(opener, responder, 'spades')).toBeNull()
  })
})

describe('buildAuction – slam växer fram via Jacoby 2NT', () => {
  it('1S–2NT–3S–4NT–5D–6S i en hel auktion', () => {
    const deal: Deal = {
      id: 'slam-jacoby',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:AKQ85 H:A432 D:K2 C:32'), // obalanserad 5-4-2-2 → 1S
        E: parseHand('S:T943 H:876 D:T43 C:765'), // svag → inget inkliv
        S: parseHand('S:J762 H:KQ5 D:AQ6 C:K84'),
        W: parseHand('S:- H:JT9 D:J9875 C:AQJT9'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['1S', '2NT', '3S', '4D', '4H', '4NT', '5D', '6S'])
    expect(a.open).toBe(false)
  })
})

describe('slamInvestigation – cue-budet måste vara lagligt (regression)', () => {
  // Bugg funnen i appen: efter 1♥–2NT–4♦ (Jacoby-sidofärg) gav cue-ronden ett
  // olagligt 4♣ (lägre än 4♦). Cue-budet ska nu antingen ligga lagligt ovanför
  // öppnarens återbud, eller hoppas över.
  it('öppnaren rebjöd 4♦ → svararen cue:ar lagligt 4♠ (aldrig 4♣)', () => {
    const opener = parseHand('S:K4 H:AKQ85 D:AQ764 C:2') // 5 ruter → 4♦-rebud
    const responder = parseHand('S:A53 H:JT72 D:K5 C:AQ86') // ♠-kontroll + ♣-kontroll
    const turns = slamInvestigation(opener, responder, 'hearts', '4D')!
    expect(turns[0].call).toBe('4S') // lagligt cue ovanför 4♦, inte 4♣
    expect(turns.some((t) => t.call === '4C')).toBe(false)
    expect(turns.some((t) => t.call === '4NT')).toBe(true)
  })

  it('öppnaren rebjöd 4♦, ingen laglig cue → rakt på 4NT', () => {
    const opener = parseHand('S:KQ H:AKQ85 D:AQ764 C:2')
    const responder = parseHand('S:Q53 H:JT72 D:K5 C:AQ86') // bara ♣-kontroll → ryms ej lagligt
    const turns = slamInvestigation(opener, responder, 'hearts', '4D')!
    expect(turns[0].call).toBe('4NT')
    expect(turns.some((t) => t.call === '4C')).toBe(false)
  })
})

describe('slamInvestigation – RKC efter minorfit (Steg 3)', () => {
  it('klöverfit i slamzon, 4 nyckelkort → 4NT, svar, 6♣', () => {
    const opener = parseHand('S:K3 H:AQ D:A43 C:KJT742') // 3 nyckelkort, 6-korts klöver
    const responder = parseHand('S:Q97 H:KJ D:KQ65 C:AQ85') // 1 nyckelkort (klöveress)
    const turns = slamInvestigation(opener, responder, 'clubs')!
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5D', '6C'])
  })
})

describe('buildAuction – minorfit-slam via inverterad minor (Steg 3)', () => {
  it('1C–2C–3C–4NT–5D–6C i en hel auktion', () => {
    const deal: Deal = {
      id: 'slam-minor',
      dealer: 'N',
      vulnerability: 'none',
      board: 1,
      hands: {
        N: parseHand('S:K3 H:AQ D:A43 C:KJT742'), // 17 hp, 6 klöver → 1C
        E: parseHand('S:JT8 H:9876 D:987 C:963'), // svag → inget inkliv
        S: parseHand('S:Q97 H:KJ D:KQ65 C:AQ85'), // 17 hp, 4 klöver, ingen högfärg → inverterad minor
        W: parseHand('S:A6542 H:T5432 D:JT2 C:-'),
      },
    }
    const a = buildAuction(deal)!
    expect(a.turns.map((t) => t.call)).toEqual(['1C', '2C', '3C', '4NT', '5D', '6C'])
    expect(a.open).toBe(false)
  })
})

describe('exclusionInvestigation – voidwood efter splinter (Steg 5)', () => {
  it('renons under trumf, alla nyckelkort utom renons-esset → storslam', () => {
    const opener = parseHand('S:AQ752 H:KQ4 D:KJ3 C:K6') // spaderfit, 1 sidoess (♠A)
    const responder = parseHand('S:KJ43 H:A752 D:AQ876 C:-') // klöverrenons, ♥A+♦A+♠K
    const turns = exclusionInvestigation(opener, responder, 'spades')!
    // svararen frågar 5♣ (Exclusion, klöveress borträknat), öppnaren svarar, 7♠
    expect(turns.map((t) => t.call)).toEqual(['5C', '5D', '7S'])
    expect(turns[0].rule).toBe('Exclusion')
  })

  it('renons som rankar ÖVER trumf → null (håller budnivåerna lagliga)', () => {
    const opener = parseHand('S:- H:AKQ52 D:KQ4 C:AQ52') // hjärterfit, spaderrenons hos öppnaren spelar ingen roll
    const responder = parseHand('S:- H:JT983 D:A765 C:K43') // spaderrenons rankar över hjärter
    expect(exclusionInvestigation(opener, responder, 'hearts')).toBeNull()
  })

  it('ingen sidorenons → null', () => {
    const opener = parseHand('S:AQ752 H:KQ4 D:KJ3 C:K6')
    const responder = parseHand('S:KJ43 H:A75 D:AQ87 C:62') // singel ingenstans, ingen renons
    expect(exclusionInvestigation(opener, responder, 'spades')).toBeNull()
  })

  it('två+ nyckelkort saknas → null (ej slamsäkert)', () => {
    const opener = parseHand('S:QJ43 H:KQ6 D:KQ4 C:KQ8') // 0 ess, ingen trumfkung
    const responder = parseHand('S:QJ762 H:KQ52 D:KQ43 C:-') // klöverrenons, 0 ess, ingen trumfkung
    expect(exclusionInvestigation(opener, responder, 'spades')).toBeNull()
  })
})

describe('mssMinorFitContinuation – MSS-slam (FAS 8, NT om säkert annars minor)', () => {
  it('NT-säker slamzon → 4NT RKC, svar, 6NT (inte 6-minor)', () => {
    const opener = parseHand('S:AJ3 H:AQ3 D:K32 C:K654') // 17, balanserad, 4 klöver, 3 nyckelkort
    const responder = parseHand('S:K2 H:K2 D:AQJ54 C:AQ32') // 19, 5-4 minorer, 2 nyckelkort
    const turns = mssMinorFitContinuation(opener, responder, 'clubs', '3C')
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5D', '6NT'])
    expect(turns[2].rule).toBe('slamavslut')
  })

  it('NT-säker storslamszon, alla nyckelkort + dam → 5NT kungfråga, kung visad → 7NT', () => {
    const opener = parseHand('S:AJ3 H:A32 D:K32 C:K654') // 15, 3 nyckelkort, rutervkung
    const responder = parseHand('S:KQ5 H:KQ D:AQ42 C:AQJ8') // 22, 4-4 minorer, 2 nyckelkort + klöverdam
    const turns = mssMinorFitContinuation(opener, responder, 'clubs', '3C')
    expect(turns.map((t) => t.call)).toEqual(['4NT', '5D', '5NT', '6D', '7NT'])
    expect(turns[2].rule).toBe('Sjöberg 5NT')
  })

  it('NT-säkert men under slamzon → 3NT (ingen fråga)', () => {
    const opener = parseHand('S:Q32 H:AKQ D:K32 C:J542') // 15, alla hf täckta
    const responder = parseHand('S:AK2 H:J2 D:AQ842 C:Q83') // 5-4, för lite ihop för slam
    const turns = mssMinorFitContinuation(opener, responder, 'clubs', '3C')
    expect(turns.map((t) => t.call)).toEqual(['3NT'])
  })

  it('gapande högfärg (ingen A/K/Q i hjärter) → minor-spåret (klöverkontrakt, inte NT)', () => {
    const opener = parseHand('S:AKQ H:432 D:K3 C:AJ642') // hjärterhål, 5 klöver
    const responder = parseHand('S:J2 H:65 D:AKQ54 C:KQ83') // hjärterhål också, slamvärden
    const turns = mssMinorFitContinuation(opener, responder, 'clubs', '3C')
    const last = turns[turns.length - 1].call
    expect(last.endsWith('C')).toBe(true) // klövermål (6♣ eller 5♣), aldrig NT
    expect(turns.some((t) => t.call.includes('NT') && t.call !== '4NT')).toBe(false)
  })

  it('gapande högfärg + för svagt → minorutgång 5♣ (inte 3NT)', () => {
    const opener = parseHand('S:AKQ H:432 D:K32 C:J542') // hjärterhål, 4 klöver, 12
    const responder = parseHand('S:J2 H:65 D:KQ654 C:KQ83') // hjärterhål, ~11, för svagt
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
})
