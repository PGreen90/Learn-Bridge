import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { overcall, advanceOvercall, advanceTwoSuiter, hasStopper } from './overcalls'

const o = (n: string, their: string) => overcall(parseHand(n), their).call
const oe = (n: string, their: string) => overcall(parseHand(n), their).explanation

// ---- Budförklaring: löftet, inte handen (ägardirektiv 2026-08-24) ------------
describe('inklivens förklaring visar löftet, inte handen', () => {
  it('enkelt inkliv: intervall (8–16 hp) + 5+ korts, inte "11 hp"', () => {
    const e = oe('S:KQJ42 H:K32 D:Q73 C:32', '1D') // 11 hp, 5 spader
    expect(e).toContain('8–16 hp')
    expect(e).toContain('5+ ♠')
    expect(e).not.toMatch(/\b11 hp\b/)
  })

  it('1NT-inkliv: intervall (15–18 hp), inte "16 hp"', () => {
    const e = oe('S:KQ4 H:KJ5 D:KQ32 C:Q42', '1H') // 16 hp
    expect(e).toContain('(15–18 hp)')
    expect(e).not.toMatch(/\b16 hp\b/)
  })

  it('upplysnings-X: öppet golv (10+ hp), inte "12 hp"', () => {
    const e = oe('S:KQ43 H:3 D:KQ52 C:Q432', '1H') // 12 hp, singel hjärter
    expect(e).toContain('10+ hp')
    expect(e).not.toMatch(/\b12 hp\b/)
  })

  it('stark 17+ X: golv 17+ och färgen HEMLIG (ej "spader")', () => {
    const e = oe('S:AKQ7653 H:Q4 D:Q54 C:A', '1C') // 17 hp, 7 spader
    expect(e).toContain('17+ hp')
    expect(e).toContain('egen färg') // avslöjar inte VILKEN färg
    expect(e).not.toContain('♠')
  })
})

describe('overcall – inkliv över deras 1-läges öppning (§7.1–7.2)', () => {
  it('enkelt inkliv 1♠ över (1♦)', () => {
    expect(o('S:KQ542 H:K32 D:32 C:432', '1D')).toBe('1S') // 8 hp, 5 spader
  })
  it('enkelt inkliv på 2-läget: 2♥ över (1♠)', () => {
    expect(o('S:32 H:KQ542 D:K32 C:432', '1S')).toBe('2H') // 8 hp, 5 hjärter
  })
  it('1NT-inkliv med 15–18 balanserad och stopp', () => {
    expect(o('S:KQ4 H:KJ5 D:KQ32 C:Q42', '1H')).toBe('1NT') // 16 hp
  })
  it('Michaels (2♣) över (1♣): båda högfärgerna', () => {
    expect(o('S:KQ542 H:KJ543 D:3 C:32', '1C')).toBe('2C') // 5-5 hf
  })
  it('Michaels (2♠) över (1♠): andra högfärgen + minor', () => {
    expect(o('S:3 H:KQ542 D:KJ543 C:32', '1S')).toBe('2S') // 5 hjärter + 5 ruter
  })
  it('ovanlig 2NT över (1♠): två lägsta objudna (klöver+ruter)', () => {
    expect(o('S:3 H:32 D:KQ543 C:KJ542', '1S')).toBe('2NT') // 5-5 minorer
  })
  // Felrapport #63 (bricka 3, 2026-09-09): 1♦–2NT med ♠Q6 ♥KQT32 ♦A ♣KT543
  // (5-5 hjärter+klöver). Ägaren "det skall stå ovanlig 2NT". Rapporten skrevs
  // före motorbytets familj-arbete; nu ger inklivet regel + förklaring som säger
  // ovanlig 2NT (två lägsta objudna = ♣+♥ över 1♦), inte en naturlig 2NT.
  it('felrapport #63: ovanlig 2NT över (1♦) med 5-5 ♥+♣ — regel + förklaring säger "ovanlig"', () => {
    const r = overcall(parseHand('S:Q6 H:KQT32 D:A C:KT543'), '1D')
    expect(r.call).toBe('2NT')
    expect(r.rule).toBe('ovanlig 2NT')
    expect(r.explanation).toMatch(/ovanlig/)
  })
  // Felrapport #76 (bricka 12, 2026-09-17): 1♦–2NT med ♠64 ♥T8432 ♦J ♣T9543 —
  // 5-5 hjärter+klöver men bara 1 HP. Ägaren: "ovanlig 2NT med 1 hcp … lite väl
  // aggressivt … föreslår minst 8hcp". Facit: formen räcker inte — under 8 HP
  // passar handen (den saknar både försvar och stickstyrka att tvinga partnern
  // upp på 3-läget). Golvet 8 HP; 5-5 med 8+ bjuder fortfarande ovanlig 2NT.
  it('felrapport #76: 5-5 i två lägsta men 1 HP passar (golvet 8 HP)', () => {
    const r = overcall(parseHand('S:64 H:T8432 D:J C:T9543'), '1D')
    expect(r.call).toBe('P') // aldrig 2NT på 1 HP
  })
  it('felrapport #76-vakt: 5-5 med precis 8 HP bjuder fortfarande ovanlig 2NT', () => {
    // ♥KQ432 (5) + ♣KJ432 (5) = 8 HP → formbudet lever kvar över golvet.
    expect(o('S:3 H:KQ432 D:32 C:KJ432', '1D')).toBe('2NT')
  })
  it('upplysningsdubbling över (1♥): kort i färgen, stöd i övriga, 12+', () => {
    expect(o('S:KQ43 H:3 D:KQ52 C:Q432', '1H')).toBe('X') // 12 hp, singel hjärter
  })
  it('pass med svag hand', () => {
    expect(o('S:432 H:432 D:5432 C:432', '1D')).toBe('P') // 0 hp
  })

  // Felrapport #23 (bricka 5): 17+ hp med en lång egen färg är för stark för ett
  // enkelt inkliv (kapat 8–16) och saknar stöd i alla objudna → föll förr till
  // pass. Ägarregel: starta med X (upplysning), visa egen färg på nästa varv.
  it('17+ stark enfärgshand (7 solida spader) → X (för stark för inkliv, ej pass)', () => {
    const res = overcall(parseHand('S:AKQ7653 H:Q4 D:Q54 C:A'), '1C') // 17 hp, 7 spader
    expect(res.call).toBe('X')
    expect(res.rule).toBe('upplysningsdubbling (stark)')
  })
  // Felrapport #40 (bricka 1): 20 hp där den enda långfärgen är ÖPPNARENS färg
  // (KQJ964 hjärter över 1♥). Regel 3.5 kräver en EGEN 5+ färg, upplysnings-X:et
  // kräver korthet i deras färg → handen föll rakt igenom till pass och 1♥ såldes.
  // Ägarbeslut: sälj ALDRIG given med 17+ — samma utlopp som §7.6-försvaret
  // redan har mot svaga tvåor och spärrar (defendWeakTwo/defendPreempt).
  it('17+ utan fönster (långfärgen är deras egen) → X, inte pass', () => {
    const res = overcall(parseHand('S:A H:KQJ964 D:Q4 C:AKJ3'), '1H') // 20 hp, 6 hjärter
    expect(res.call).toBe('X')
    expect(res.rule).toBe('upplysningsdubbling (stark)')
  })
  it('16 hp utan fönster passar fortfarande (taket rörs inte)', () => {
    expect(o('S:A4 H:KQJ964 D:Q4 C:KJ3', '1H')).toBe('P') // 16 hp → under 17+-utloppet
  })

  it('inget inkliv mot deras 1NT (hanteras av DONT)', () => {
    expect(o('S:KQ542 H:K32 D:32 C:432', '1NT')).toBe('P')
  })

  // Ägarbeslut 2026-07-03 (uppföljning felrapport #5, exempelhänder H1–H4):
  // AGGRESSIV STANDARD för upplysningsdubblingen – golvet sänkt till 10 hp,
  // men BARA när formen är rätt (max 2 kort i deras färg + stöd i alla
  // objudna). Jämna händer utan korthet dubblar aldrig under 12.
  describe('aggressiv upplysningsdubbling (10–11 hp med rätt form)', () => {
    it('H2: 10 hp, singel i deras ruter, 4-4 hf → X', () => {
      expect(o('S:KQ64 H:AJ53 D:2 C:T874', '1D')).toBe('X')
    })
    it('H4: 11 hp, dubbelton i deras ruter, stöd i övriga → X', () => {
      expect(o('S:A63 H:KJ64 D:43 C:QJ83', '1D')).toBe('X')
    })
    it('H1 (bricka 8-Nord): jämn 10:a med 3 kort i deras färg → pass', () => {
      expect(o('S:A63 H:J643 D:J43 C:A83', '1D')).toBe('P')
    })
    it('H3: perfekt form men bara 8 hp → pass', () => {
      expect(o('S:KJ85 H:QT94 D:4 C:J973', '1D')).toBe('P')
    })
    it('10–11 med egen 5-korts färg → enkelt inkliv, inte X', () => {
      expect(o('S:KJT98 H:76 D:Q97 C:A76', '1H')).toBe('1S') // 10 hp, 5 spader
    })
  })

  // Felrapport #84 (bricka 7, 2026-09-26): Nord ♠AKQ9 ♥QT4 ♦K82 ♣642 (14 hp,
  // 4-3-3-3) PASSADE över 1♣. Ägaren: "Shape och poäng stämmer för take out."
  // Regeln krävde max 2 kort i deras färg — men en jämn ÖPPNINGSHAND (12+) med
  // tre kort i deras färg och stöd i alla objudna dubblar (offshape-X); den har
  // ingen annan väg in (för svag för 1NT-inkliv, ingen 5-korts färg).
  describe('jämn öppningshand med tre kort i deras färg dubblar från 12 (felrapport #84)', () => {
    it('14 hp, 4-3-3-3 med tre klöver över 1♣ → X', () => {
      const res = overcall(parseHand('S:AKQ9 H:QT4 D:K82 C:642'), '1C')
      expect(res.call).toBe('X')
      expect(res.rule).toBe('upplysningsdubbling')
    })
    it('12 hp jämn med tre i deras färg → X; 11 hp → pass (golvet 12, H1 står kvar)', () => {
      expect(o('S:KQ92 H:KJ4 D:K82 C:642', '1C')).toBe('X') // 12 hp
      expect(o('S:KQ92 H:K74 D:K82 C:642', '1C')).toBe('P') // 11 hp
    })
    it('16 hp 4-3-3-3 utan stopp i deras färg → X (inte pass: 1NT-inklivet kräver stopp)', () => {
      expect(o('S:AKQ9 H:KJ4 D:K82 C:642', '1C')).toBe('X') // 16 hp
    })
    it('dubbelton i en OBJUDEN färg ger ingen X (4-4-3-2 med tre i deras) → pass under 1NT-fönstret', () => {
      expect(o('S:AKQ9 H:QT42 D:K8 C:642', '1C')).toBe('P') // 13 hp, två ruter
    })
  })
})

describe('advanceOvercall – svar på partnerns inkliv (§7.1)', () => {
  it('cue i deras färg = limithöjning+ (bra stöd, 11+)', () => {
    expect(advanceOvercall(parseHand('S:K43 H:KQ2 D:432 C:K432'), 'spades', 'diamonds').call).toBe('2D')
  })
  it('konkurrenshöjning med stöd och under 11', () => {
    expect(advanceOvercall(parseHand('S:K43 H:Q42 D:432 C:Q432'), 'spades', 'diamonds').call).toBe('2S')
  })
  it('ny färg naturlig (egen 5-färg, ej stöd) — på billigaste nivån (etapp 4 familj 1: 1♠ över 1♥, inte hoppet 2♠)', () => {
    expect(advanceOvercall(parseHand('S:KQ543 H:2 D:432 C:K432'), 'hearts', 'diamonds').call).toBe('1S')
    // Över ett 2-lägesinkliv: 2-läget; aldrig deras färg; 2NT kräver 11+ med stopp.
    expect(advanceOvercall(parseHand('S:KQ543 H:2 D:43 C:K5432'), 'diamonds', 'hearts', 2).call).toBe('2S')
    expect(advanceOvercall(parseHand('S:KQ543 H:2 D:43 C:K5432'), 'diamonds', 'spades', 2).call).toBe('P')
    expect(advanceOvercall(parseHand('S:KQ5 H:A2 D:J43 C:KJ432'), 'hearts', 'spades', 2).call).toBe('2NT') // utan 3-korts stöd (då vinner cuet)
  })
  it('höjning över ett 2-lägesinkliv kräver 6 stödpoäng (3-läget); över 1-läget som förut', () => {
    expect(advanceOvercall(parseHand('S:JT52 H:JT96 D:87 C:T84'), 'clubs', 'diamonds', 2).call).toBe('P')
    expect(advanceOvercall(parseHand('S:JT52 H:K96 D:87 C:Q84'), 'clubs', 'diamonds', 2).call).toBe('3C')
  })
  it('fit-jump: 4 stöd + egen 5-färg, inbjudande+ → hopp i sidofärgen', () => {
    // partnern klev in 1♥, advancern har 4 hjärter + 5 spader, 10 hp → 2♠ (fit-jump).
    const r = advanceOvercall(parseHand('S:KQJ54 H:A432 D:32 C:32'), 'hearts', 'diamonds')
    expect(r.call).toBe('2S')
    expect(r.rule).toBe('fit-jump')
  })
})

describe('advanceTwoSuiter – svar på Michaels / ovanlig 2NT (§7.2, ägarbeslut)', () => {
  const a = (n: string, partnerCall: string, their: 'clubs' | 'diamonds' | 'hearts' | 'spades', contested = false) =>
    advanceTwoSuiter(parseHand(n), partnerCall, their, contested)

  // Michaels över deras minor (2♣) = båda högfärgerna. Bjud den längsta.
  it('Michaels 2♣: längst i spader → 2♠', () => {
    expect(a('S:KJ432 H:32 D:Q432 C:432', '2C', 'clubs').call).toBe('2S')
  })
  it('Michaels 2♣: längst i hjärter → 2♥', () => {
    expect(a('S:32 H:KJ432 D:Q432 C:432', '2C', 'clubs').call).toBe('2H')
  })
  it('Michaels 2♣: lika långa högfärger → högfärgen (spader) 2♠', () => {
    expect(a('S:K32 H:Q32 D:J432 C:432', '2C', 'clubs').call).toBe('2S')
  })

  // Ovanlig 2NT över (1♠) = de två lägsta objudna (klöver+ruter).
  it('ovanlig 2NT: längst i ruter → 3♦', () => {
    expect(a('S:432 H:432 D:KJ32 C:Q32', '2NT', 'spades').call).toBe('3D')
  })
  it('ovanlig 2NT: längst i klöver → 3♣', () => {
    expect(a('S:432 H:432 D:Q32 C:KJ32', '2NT', 'spades').call).toBe('3C')
  })

  // Michaels över deras högfärg (2♠) = andra högfärgen (hjärter) + OKÄND minor.
  it('Michaels 2♠: hjärterfit → 3♥ (preferens)', () => {
    expect(a('S:32 H:K432 D:432 C:5432', '2S', 'spades').call).toBe('3H')
  })
  // Ägarbeslut 2026-09-22: Michaels = de två HÖGSTA objudna (över 1♠ = hjärter + RUTER),
  // båda kända — 3♣ pass-eller-rätta finns inte längre.
  it('Michaels 2♠: ingen hjärterfit → preferens till partnerns ruter (3♦), även i konkurrens med ruterstöd', () => {
    expect(a('S:432 H:32 D:K432 C:5432', '2S', 'spades').call).toBe('3D')
    expect(a('S:432 H:32 D:K432 C:5432', '2S', 'spades', true).call).toBe('3D')
  })
  it('Michaels 2♠: ingen fit i någon av färgerna + contested + svag → pass', () => {
    expect(a('S:5432 H:32 D:32 C:K5432', '2S', 'spades', true).call).toBe('P')
  })

  // Ägarregel: aldrig passa i en ostörd budgivning – även en usel hand tar ut.
  it('svag hand får ALDRIG passa ostört → bjuder ändå (2♠)', () => {
    expect(a('S:J432 H:32 D:432 C:5432', '2C', 'clubs').call).toBe('2S')
  })
})

describe('hasStopper', () => {
  it('Kx är stopp', () => {
    expect(hasStopper(parseHand('S:K3 H:5432 D:5432 C:543'), 'spades')).toBe(true)
  })
  it('Qxx är stopp', () => {
    expect(hasStopper(parseHand('S:Q43 H:5432 D:543 C:543'), 'spades')).toBe(true)
  })
})
