import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { advancerFreeBidAfterDouble, answerSupportDouble, doublerAnswersCue, negativeDouble, openerAnswerNegativeDouble, penaltyDouble, responsiveDouble, supportDouble, supportDoublerRebid, answerTakeoutDouble } from './doubles'

// ---- Budförklaring: löftet, inte handen (ägardirektiv 2026-08-24) ------------
describe('dubblingarnas förklaring visar löftet, inte handen', () => {
  it('negativ dubbling: golv (6+ hp), symbol, inte handens hp', () => {
    const e = negativeDouble(parseHand('S:32 H:KQ43 D:K32 C:5432'), 'diamonds', '1S')!.explanation
    expect(e).toContain('6+ hp')
    expect(e).toContain('♥')
    expect(e).not.toMatch(/\b8 hp\b/)
  })

  it('straffdubbling: ingen trumfstick-räkning, ingen hp-läcka', () => {
    const e = penaltyDouble(parseHand('S:AQJ5 H:32 D:K432 C:K43'), 'spades')!.explanation
    expect(e).toContain('trumfstick')
    expect(e).not.toMatch(/\b\d+ hp\b/)
    expect(e).not.toMatch(/^\d+ säkra/) // ingen exakt siffra i inledningen
  })
})

describe('negativeDouble (§7.3)', () => {
  it('1♦–(1♠)–X med 4+ hjärter', () => {
    expect(negativeDouble(parseHand('S:32 H:KQ43 D:K32 C:5432'), 'diamonds', '1S')?.call).toBe('X')
  })
  it('null utan objuden 4-korts högfärg', () => {
    expect(negativeDouble(parseHand('S:32 H:K3 D:KQ43 C:5432'), 'diamonds', '1S')).toBeNull()
  })
  it('gäller även inkliv på 2-läget: 1♦–(2♣)–X med 4 hjärter', () => {
    expect(negativeDouble(parseHand('S:32 H:KQ43 D:K32 C:5432'), 'diamonds', '2C')?.call).toBe('X')
  })
  // Felrapport #45 (bricka 3): 1♣–(2♦)–X med BÅDA objudna högfärgerna 4+
  // (Syd 5-4 i spader–hjärter). X:et visar båda högfärgerna – förklaringen
  // fick INTE nämna bara hjärter (loopen returnerade på första 4-färgen).
  it('1♣–(2♦)–X med båda högfärgerna → förklaringen nämner BÅDA', () => {
    const r = negativeDouble(parseHand('S:K9876 H:KT86 D:4 C:KJ5'), 'clubs', '2D')
    expect(r?.call).toBe('X')
    expect(r?.explanation).toMatch(/♠/)
    expect(r?.explanation).toMatch(/♥/)
  })
})

// Öppnarens svar på partnerns negativa dubbling – rondkrav, aldrig pass.
// Facit ur felrapport #2 (bricka 14): 1♣–(2♥)–X → öppnaren bjuder sin 4-korts
// spader billigast med minimum. §7.3: "öppnaren svarar som på en upplysningsdubbling".
describe('openerAnswerNegativeDouble (§7.3, felrapport #2)', () => {
  it('1♣–(2♥)–X, minimum med 4 spader → 2♠ (billigast)', () => {
    // Östs hand ur felrapporten (12 hp, JT97 i spader).
    const r = openerAnswerNegativeDouble(parseHand('S:JT97 H:KJ D:53 C:AK852'), 'clubs', '2H')
    expect(r.call).toBe('2S')
    expect(r.rule).toBe('svar på negativ dubbling')
  })
  it('extra styrka (16+) → hoppande 3♠', () => {
    expect(openerAnswerNegativeDouble(parseHand('S:AQ97 H:KJ D:A3 C:AK852'), 'clubs', '2H').call).toBe('3S')
  })
  it('1♦–(1♠)–X med 4 hjärter → 2♥ (högfärgen rankar under deras → nivån upp)', () => {
    expect(openerAnswerNegativeDouble(parseHand('S:32 H:KQ43 D:AQJ32 C:43'), 'diamonds', '1S').call).toBe('2H')
  })
  it('ingen fjärde högfärg men stopp i deras färg → billigaste sang', () => {
    expect(openerAnswerNegativeDouble(parseHand('S:32 H:KQ2 D:AQ432 C:K32'), 'diamonds', '2H').call).toBe('2NT')
  })
  it('varken högfärg eller stopp: 6+ egen färg → återbud (aldrig pass)', () => {
    expect(openerAnswerNegativeDouble(parseHand('S:432 H:32 D:AKQJ32 C:K2'), 'diamonds', '2H').call).toBe('3D')
  })
})

describe('responsiveDouble (§7.3)', () => {
  it('(1♥)–X–(2♥)–X med stöd i objudna färger', () => {
    expect(responsiveDouble(parseHand('S:K43 H:2 D:K432 C:Q432'), 'hearts')?.call).toBe('X')
  })
  it('null med egen lång färg', () => {
    expect(responsiveDouble(parseHand('S:KQ432 H:2 D:K43 C:432'), 'hearts')).toBeNull()
  })
})

describe('supportDouble (§7.3)', () => {
  // 1♦–(P)–1♥–(inkliv): öppnaren med exakt 3 hjärter.
  const threeHearts = parseHand('S:A32 H:K32 D:KQ432 C:32')
  it('exakt 3 stöd, inkliv 1♠ (2♥ finns kvar) → X', () => {
    expect(supportDouble(threeHearts, 'hearts', '1S')?.call).toBe('X')
  })
  it('exakt 3 stöd, inkliv 2♣ (2♥ finns kvar) → X', () => {
    expect(supportDouble(threeHearts, 'hearts', '2C')?.call).toBe('X')
  })
  it('exakt 3 spader, inkliv 2♥ (2♠ finns kvar) → X', () => {
    expect(supportDouble(parseHand('S:K32 H:A32 D:32 C:KQ432'), 'spades', '2H')?.call).toBe('X')
  })
  it('exakt 3 stöd men inkliv 2♠ tar bort 2♥ → null (stöd-X av)', () => {
    expect(supportDouble(threeHearts, 'hearts', '2S')).toBeNull()
  })
  it('inget inkliv (RHO pass) → null (stöd-X finns inte)', () => {
    expect(supportDouble(threeHearts, 'hearts', 'P')).toBeNull()
  })
  it('4 stöd → null (höj naturligt i stället)', () => {
    expect(supportDouble(parseHand('S:K432 H:A32 D:KQ3 C:432'), 'spades', '2H')).toBeNull()
  })
  it('2 stöd → null', () => {
    expect(supportDouble(parseHand('S:K2 H:A32 D:KQ432 C:432'), 'spades', '2H')).toBeNull()
  })
})

describe('answerTakeoutDouble (§7.3)', () => {
  it('svag hand → billigaste färgbud (1♠)', () => {
    expect(answerTakeoutDouble(parseHand('S:KQ43 H:5432 D:32 C:432'), 'diamonds').call).toBe('1S')
  })
  it('9–11 → hoppbud (2♠)', () => {
    expect(answerTakeoutDouble(parseHand('S:KQ43 H:KJ32 D:32 C:432'), 'diamonds').call).toBe('2S')
  })
  it('12+ → cue deras färg (krav)', () => {
    expect(answerTakeoutDouble(parseHand('S:AQ43 H:KJ32 D:32 C:K32'), 'diamonds').call).toBe('2D')
  })

  // Två färger bjudna (1♦–1♥–X): svaret får ALDRIG hamna i en av deras färger.
  // bidSuits utesluter både ruter och hjärter → svara i objuden ♠/♣.
  it('två färger bjudna: undviker öppnarens ruter trots lång ruter', () => {
    const h = parseHand('S:T6 H:52 D:KJ984 C:Q765') // längst i deras ruter (5)
    expect(answerTakeoutDouble(h, 'hearts', 1, ['diamonds', 'hearts']).call).toBe('2C')
  })
  it('två färger bjudna: väljer längsta OBJUDNA (spader) framför klöver', () => {
    const h = parseHand('S:KJ85 H:3 D:T9752 C:Q63') // 4 spader, 3 klöver, lång ruter
    expect(answerTakeoutDouble(h, 'hearts', 1, ['diamonds', 'hearts']).call).toBe('1S')
  })

  // Etapp 6 hål 4 (Mätning #18): svar när partnern dubblat deras SPÄRR (3-läget).
  it('12+ över dubblad spärr: 3NT med stopp — ALDRIG cue (frö 20260825 passades ut i 4♥)', () => {
    const h = parseHand('S:A43 H:KJ8 D:Q432 C:A32') // 13 hp, hjärterstopp
    expect(answerTakeoutDouble(h, 'hearts', 3).call).toBe('3NT')
  })
  it('12+ över dubblad spärr utan stopp: bästa färg (inte cue)', () => {
    const h = parseHand('S:AQ43 H:432 D:AQ42 C:32') // 12 hp, inget hjärterstopp
    expect(answerTakeoutDouble(h, 'hearts', 3).call).toBe('3S')
  })
  it('tvingat svar på 3-läget+: honnörsstarkare färg vinner på lika längd (frö 20261680)', () => {
    const h = parseHand('S:J9 H:J982 D:T93 C:A832') // 4-4: A832 klöver > J982 hjärter
    expect(answerTakeoutDouble(h, 'spades', 3).call).toBe('4C')
  })
})

// Straffdubblingen (ägarbeslut 2026-07-04, poängarbetet): 2+ säkra trumfstick
// i deras färg + 10+ hp. Läges-vakterna (nivå 3+, vår sida har bjudit två
// kontraktsbud) ligger i auction-live.ts och testas där.
describe('penaltyDouble (straffdubbling)', () => {
  it('EK i deras färg + 13 hp → X', () => {
    const r = penaltyDouble(parseHand('S:AK5 H:KQJ94 D:752 C:83'), 'spades')
    expect(r?.call).toBe('X')
    expect(r?.rule).toBe('straffdubbling')
  })
  it('E + D-tredje i deras färg (2 trumfstick) + 10 hp → X', () => {
    expect(penaltyDouble(parseHand('S:AQ5 H:KJ54 D:7532 C:83'), 'spades')?.call).toBe('X')
  })
  it('bara ETT trumfstick (Kx) → null', () => {
    expect(penaltyDouble(parseHand('S:K5 H:AQJ94 D:752 C:Q83'), 'spades')).toBeNull()
  })
  it('D-dubbelton räknas inte som stick: ED-andra = 1 stick → null', () => {
    expect(penaltyDouble(parseHand('S:AQ H:KJ954 D:752 C:983'), 'spades')).toBeNull()
  })
  it('singel K räknas inte som trumfstick → null (trots 13 hp)', () => {
    expect(penaltyDouble(parseHand('S:K H:AQ954 D:A532 C:983'), 'spades')).toBeNull()
  })
  it('trumfstack men bara 9 hp → null (för lite sidostyrka)', () => {
    expect(penaltyDouble(parseHand('S:AK5 H:J954 D:752 C:983'), 'spades')).toBeNull()
  })
})

// Etapp 6 hål 1 (billig offring): SVARARENS svar på öppnarens stöddubbling.
// Sekvensen är 1x–(P)–1M–(inkliv)–X–(P)–? Dubblingen visade exakt 3 stöd —
// svararen får aldrig passa bort den (utom som medvetet straffpass).
describe('answerSupportDouble (svar på stöddubblingen, etapp 6 hål 1)', () => {
  // Kontext om inget annat sägs: 1♦–(P)–1♠–(2♥)–X.
  it('straffpass: ≤12 hp med 2+ säkra trumfstick i deras färg → P (medvetet)', () => {
    // 1♣–(P)–1♠–(2♦)–X med AQT98 i deras ruter, 11 hp.
    const r = answerSupportDouble(parseHand('S:KQ54 H:65 D:AQT98 C:82'), 'spades', 'clubs', '2D')
    expect(r.call).toBe('P')
    expect(r.rule).toBe('straffpass på stöddubbling')
  })
  it('utgångsvärden + 5-korts högfärg → 4M (5-3-fiten är känd)', () => {
    expect(answerSupportDouble(parseHand('S:AQJ85 H:74 D:K52 C:AJ4'), 'spades', 'diamonds', '2H').call).toBe('4S')
  })
  it('utgångsvärden, jämnt med stopp i deras färg → 3NT (frö 20261005)', () => {
    // 1♣–(P)–1♥–(2♦)–X: 15 hp, AKJT i deras ruter.
    expect(answerSupportDouble(parseHand('S:A65 H:8632 D:AKJT C:QJ'), 'hearts', 'clubs', '2D').call).toBe('3NT')
  })
  it('utgångsvärden med SINGEL i partnerns färg → 4M på 4-3 (Moysian), inte 3NT (frö 20261274)', () => {
    expect(answerSupportDouble(parseHand('S:KJ73 H:A83 D:8 C:KQJ52'), 'spades', 'diamonds', '2H').call).toBe('4S')
  })
  it('inbjudan (10–12) med 5-korts högfärg → 3M', () => {
    // 1♦–(P)–1♥–(1♠)–X: 10 hp, 5 hjärter.
    expect(answerSupportDouble(parseHand('S:743 H:KQ852 D:96 C:A82'), 'hearts', 'diamonds', '1S').call).toBe('3H')
  })
  it('inbjudan med egen 6-korts sidofärg → färgen billigast (frö 20261658)', () => {
    expect(answerSupportDouble(parseHand('S:AQ74 H:K6 D:J C:T98752'), 'spades', 'diamonds', '2H').call).toBe('3C')
  })
  it('inbjudan med honnörsstöd (3 kort) i öppnarens färg → invithöjning 3m (frö 20260884)', () => {
    expect(answerSupportDouble(parseHand('S:A854 H:932 D:KT8 C:K72'), 'spades', 'diamonds', '2H').call).toBe('3D')
  })
  it('inbjudan, jämnt med stopp (utan trumfstack) → 2NT', () => {
    // Hjärter E32 = stopp men bara ETT trumfstick → inget straffpass.
    expect(answerSupportDouble(parseHand('S:Q854 H:A32 D:962 C:KQ3'), 'spades', 'diamonds', '2H').call).toBe('2NT')
  })
  it('inbjudan med trumfstack (KQx + 11 hp) → straffpass går före 2NT', () => {
    expect(answerSupportDouble(parseHand('S:Q854 H:KQ2 D:962 C:A73'), 'spades', 'diamonds', '2H').rule).toBe('straffpass på stöddubbling')
  })
  it('minimum med 5-korts högfärg → 2M', () => {
    expect(answerSupportDouble(parseHand('S:J8542 H:963 D:Q4 C:K72'), 'spades', 'diamonds', '2H').call).toBe('2S')
  })
  it('minimum med stöd → billig preferens 2m', () => {
    // 1♦–(P)–1♠–(2♣)–X: 5 hp, 4-korts ruter, 2♦ finns kvar.
    expect(answerSupportDouble(parseHand('S:9854 H:762 D:Q543 C:K2'), 'spades', 'diamonds', '2C').call).toBe('2D')
  })
  it('minimum utan stöd → 2M på 4-3 (påtvingat, billigast)', () => {
    expect(answerSupportDouble(parseHand('S:9854 H:762 D:53 C:KQ42'), 'spades', 'diamonds', '2H').call).toBe('2S')
  })
})

// Öppnarens FORTSÄTTNING efter egen stöddubbling: partnerns svar är inbjudan
// (ej krav) — öppnaren accepterar med 15+, annars pass. Partnerns utgångsbud står.
describe('supportDoublerRebid (stöddubblarens fortsättning)', () => {
  it('partnerns invithöjning 3♦, 16 hp obalanserad med 6 ruter → 5♦ (frö 20260884)', () => {
    const r = supportDoublerRebid(parseHand('S:KQ3 H:AK D:QJ9742 C:J5'), 'diamonds', 'spades', 'hearts', '3D')
    expect(r?.call).toBe('5D')
    expect(r?.rule).toBe('stöddubblarens fortsättning')
  })
  it('partnerns invithöjning 3♦, jämn hand 15 hp med stopp i deras färg → 3NT', () => {
    expect(supportDoublerRebid(parseHand('S:KQ3 H:AK2 D:QJ97 C:J52'), 'diamonds', 'spades', 'hearts', '3D')?.call).toBe('3NT')
  })
  it('partnerns invithöjning 3♦, minimum → pass', () => {
    expect(supportDoublerRebid(parseHand('S:Q73 H:K4 D:AQ8742 C:J5'), 'diamonds', 'spades', 'hearts', '3D')?.call).toBe('P')
  })
  it('partnerns 3♣ (naturligt 6+), 4-korts stöd och 15 hp → 5♣ (frö 20261658)', () => {
    expect(supportDoublerRebid(parseHand('S:KJ2 H:4 D:AQ932 C:AJ43'), 'diamonds', 'spades', 'hearts', '3C')?.call).toBe('5C')
  })
  it('partnerns 3♣ (naturligt 6+) är RONDKRAV: minimum med 3-korts stöd → enkel höjning 4♣', () => {
    expect(supportDoublerRebid(parseHand('S:Q52 H:84 D:AKJ32 C:Q43'), 'diamonds', 'spades', 'hearts', '3C')?.call).toBe('4C')
  })
  it('partnerns 3♣ utan stöd men med stopp i deras färg → 3NT (rondkravet passas aldrig)', () => {
    expect(supportDoublerRebid(parseHand('S:Q752 H:A4 D:AKJ32 C:43'), 'diamonds', 'spades', 'hearts', '3C')?.call).toBe('3NT')
  })
  it('partnerns 3♣ utan stöd, stopp eller egen 6+ färg → preferens till partnerns högfärg', () => {
    expect(supportDoublerRebid(parseHand('S:Q752 H:84 D:AKJ32 C:43'), 'diamonds', 'spades', 'hearts', '3C')?.call).toBe('3S')
  })
  it('även ett 2-läges nytt färgsvar (2♦) är rondkrav: minimum med stöd → höjning 3♦, aldrig pass', () => {
    // 1♣–(P)–1♥–(1♠)–X–(P)–2♦: öppnaren har 12 hp och 3-korts ruter.
    expect(supportDoublerRebid(parseHand('S:432 H:A32 D:Q54 C:AQ432'), 'clubs', 'hearts', 'spades', '2D')?.call).toBe('3D')
  })
  it('partnerns 2♥ (minimum i egen högfärg) får däremot passas', () => {
    expect(supportDoublerRebid(parseHand('S:432 H:A32 D:Q54 C:AQ432'), 'clubs', 'hearts', 'spades', '2H')?.call).toBe('P')
  })
  it('partnerns 2NT-inbjudan, 16 hp → 3NT', () => {
    expect(supportDoublerRebid(parseHand('S:KQ3 H:A5 D:AQJ42 C:432'), 'diamonds', 'spades', 'hearts', '2NT')?.call).toBe('3NT')
  })
  it('partnerns 3M-inbjudan (5-3-fit), 16 hp → 4M', () => {
    expect(supportDoublerRebid(parseHand('S:A4 H:KQ2 D:65 C:AQJ752'), 'clubs', 'hearts', 'diamonds', '3H')?.call).toBe('4H')
  })
  it('partnerns utgångsbud (3NT) står → pass', () => {
    expect(supportDoublerRebid(parseHand('S:KQ3 H:A5 D:AQJ42 C:432'), 'diamonds', 'spades', 'hearts', '3NT')?.call).toBe('P')
  })
})

// Etapp 6 hål 2 (billig offring): ADVANCERNS svar när motståndarna bjuder ÖVER
// partnerns upplysningsdubbling — (1♣)–X–(2♣)–? Svarstvånget är borta (fritt
// läge), men med värden/form ska advancern ändå tala.
describe('advancerFreeBidAfterDouble (fritt svar på upplysningsdubbling, etapp 6 hål 2)', () => {
  it('deras XX → tvångsflykt som över pass (frö 20260934: 3♥ billigast)', () => {
    // (2♠)–X–(XX): 8 hp, hjärter och klöver 4-4 → högfärgen billigast.
    expect(advancerFreeBidAfterDouble(parseHand('S:73 H:JT53 D:764 C:AK82'), 'spades', 2, ['spades'], 'XX')?.call).toBe('3H')
  })
  it('6–8 hp med 5-korts färg → billigaste färgbud (frö 20261521: 2♥ över 2♣)', () => {
    expect(advancerFreeBidAfterDouble(parseHand('S:52 H:A9753 D:QJ62 C:J6'), 'clubs', 1, ['clubs'], '2C')?.call).toBe('2H')
  })
  it('9 hp med 5-korts spader → hoppbud 3♠ (frö 20260759)', () => {
    expect(advancerFreeBidAfterDouble(parseHand('S:J9743 H:K76 D:T3 C:AJ9'), 'clubs', 1, ['clubs'], '2C')?.call).toBe('3S')
  })
  it('6–8 hp med 5-korts spader → 2♠ (billigast, ej hopp)', () => {
    expect(advancerFreeBidAfterDouble(parseHand('S:J9743 H:Q76 D:T3 C:QJ9'), 'clubs', 1, ['clubs'], '2C')?.call).toBe('2S')
  })
  it('9–11 hp med 5-korts färg → hoppbud (inbjudan)', () => {
    expect(advancerFreeBidAfterDouble(parseHand('S:KQJ85 H:A4 D:962 C:743'), 'clubs', 1, ['clubs'], '2C')?.call).toBe('3S')
  })
  it('12+ utan stopp i deras färg → cue (krav) (frö 20261519: 3♣)', () => {
    const r = advancerFreeBidAfterDouble(parseHand('S:K52 H:A65 D:AQJ74 C:J8'), 'clubs', 1, ['clubs'], '2C')
    expect(r?.call).toBe('3C')
    expect(r?.rule).toBe('cue (krav)')
  })
  it('12+ med stopp i deras färg → 3NT', () => {
    expect(advancerFreeBidAfterDouble(parseHand('S:K5 H:A65 D:AQJ74 C:KJ8'), 'clubs', 1, ['clubs'], '2C')?.call).toBe('3NT')
  })
  it('extrem form (6+ färg) får bjuda även utan poäng (frö 20260811: 3♠ på 1 hp)', () => {
    expect(advancerFreeBidAfterDouble(parseHand('S:T98762 H:KT854 D:8 C:3'), 'diamonds', 2, ['diamonds'], '3D')?.call).toBe('3S')
  })
  it('svag jämn hand utan femkortsfärg → null (fritt läge, pass är rätt)', () => {
    expect(advancerFreeBidAfterDouble(parseHand('S:9843 H:J53 D:764 C:Q82'), 'clubs', 1, ['clubs'], '2C')).toBeNull()
  })
})

// Dubblarens svar på advancerns cue (utgångskrav — får aldrig passas).
// Högfärgen FÖRST (cuet jagar 4-4-fiten, felrapport #11), sang med stopp sedan.
describe('doublerAnswersCue (dubblarens svar på advancerns cue)', () => {
  it('4-korts högfärg visas före sang (frö 20261519: hjärter billigast)', () => {
    const r = doublerAnswersCue(parseHand('S:AJ93 H:J932 D:T83 C:A7'), ['clubs'], '3C')
    expect(r.call).toBe('3H')
    expect(r.rule).toBe('dubblarens svar på cue')
  })
  it('utan stopp → också billigaste 4-korts högfärg', () => {
    expect(doublerAnswersCue(parseHand('S:AJ93 H:J932 D:QT83 C:7'), ['clubs'], '3C').call).toBe('3H')
  })
  it('ingen 4-korts högfärg men stopp i deras färg → 3NT', () => {
    expect(doublerAnswersCue(parseHand('S:AJ9 H:K93 D:QT83 C:A73'), ['clubs'], '3C').call).toBe('3NT')
  })
})
