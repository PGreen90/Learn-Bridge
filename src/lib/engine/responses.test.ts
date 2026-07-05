import { describe, expect, it } from 'vitest'
import { parseHand } from '../bidding'
import { respondToMajor, respondToMinor, type Major, type Minor } from './responses'

function resp(notation: string, opened: Major): string {
  return respondToMajor(parseHand(notation), opened).call
}

function respM(notation: string, opened: Minor): string {
  return respondToMinor(parseHand(notation), opened).call
}

describe('respondToMajor', () => {
  it('pass med för svag hand', () => {
    expect(resp('S:9532 H:863 D:9742 C:Q3', 'hearts')).toBe('P') // 2 hp
  })

  it('enkel höjning med 3 stöd och 6–9', () => {
    expect(resp('S:K83 H:Q74 D:8642 C:K53', 'hearts')).toBe('2H') // 8 hp, 3 stöd
  })

  it('Jacoby 2NT med 4 stöd, 13+, ingen kortfärg', () => {
    expect(resp('S:K94 H:KQ74 D:A83 C:Q53', 'hearts')).toBe('2NT') // 14 hp, 4 stöd
  })

  it('tvetydig splinter med 4 stöd + kortfärg, 12+', () => {
    expect(resp('S:KQ95 H:KQ73 D:8 C:K842', 'hearts')).toBe('3S') // 13 hp, singel ruter
  })

  it('Bergen limit (3♦) med 4 stöd och 10–12', () => {
    expect(resp('S:KJ3 H:K974 D:Q82 C:Q53', 'hearts')).toBe('3D') // 11 hp, 4 stöd
  })

  it('Bergen konstruktiv (3♣) med 4 stöd och 7–9', () => {
    expect(resp('S:843 H:K974 D:KJ2 C:763', 'hearts')).toBe('3C') // 7 hp, 4 stöd
  })

  it('Bergen spärr (3 i färgen) med 4 stöd och svag (platt, inga stödp.)', () => {
    expect(resp('S:843 H:K974 D:K72 C:632', 'hearts')).toBe('3H') // 6 hp, 4 stöd, platt
  })

  // ---- TP-steg B: stödpoäng (max(hp, dummyPoints)) lyfter höjningar ----
  it('splinter-uppgradering: 11 hp + singel + 4 trumf → utgångskrav (ägarens hand)', () => {
    // Rå hp = 11 (under splintergränsen 12), men singel hjärter + 4 trumf ger 14
    // stödpoäng → tvetydig splinter (GF). Ägarens beslut 2026-06-30.
    expect(resp('S:KQ75 H:3 D:Q9842 C:KJ4', 'spades')).toBe('3H')
  })

  it('dubbelton lyfter en svag 4-stödshand till konstruktiv 3♣', () => {
    // 6 hp men dubbelton klöver → 7 stödpoäng → Bergen konstruktiv (ej ren spärr).
    expect(resp('S:8432 H:K974 D:K72 C:63', 'hearts')).toBe('3C')
  })

  it('platt övervärderad 11:a nedgraderas ALDRIG under hp (stannar limithöjning 3♦)', () => {
    // 11 hp, 4-3-3-3, D/kn-tung → bara 9 stödpoäng, men hp-golvet håller den på
    // limithöjning (3♦), inte konstruktiv. "Nedgradera aldrig" gäller även här.
    expect(resp('S:KJ3 H:K974 D:Q82 C:Q53', 'hearts')).toBe('3D')
  })

  it('ny färg 1♠ med 4 spader över 1♥', () => {
    expect(resp('S:KQ85 H:73 D:Q842 C:K53', 'hearts')).toBe('1S') // 10 hp, ingen fit
  })

  // Ägarbeslut 2026-07-06 (felrapport #31): INGET svagt hoppskift. När partnern
  // öppnat håller svararen budgivningen låg → 6-korts spader svarar 1♠, inte 2♠.
  it('svag 6-korts spader över 1♥ → 1♠ (INTE 2♠ hoppskift)', () => {
    expect(resp('S:KQ9742 H:3 D:Q842 C:53', 'hearts')).toBe('1S') // 7 hp, 6 spader
  })

  it('2-över-1 (2♦) med 12+ och 5-korts färg över 1♠', () => {
    expect(resp('S:73 H:A4 D:KQ962 C:KJ85', 'spades')).toBe('2D') // 13 hp, 5 ruter
  })

  it('semi-forcing 1NT med 6–11 utan fit', () => {
    expect(resp('S:KJ5 H:8 D:Q8642 C:J853', 'hearts')).toBe('1NT') // 7 hp
  })

  it('3NT med 13–15 balanserad, exakt 2 i öppningsfärgen', () => {
    expect(resp('S:KQ5 H:Q4 D:KJ83 C:Q985', 'hearts')).toBe('3NT') // 13 hp balanserad
  })

  // ---- FAS 3 punkt 12: Bergen ALDRIG med 3 stöd (strukturell grind hasFourPlus) ----
  describe('Bergen aldrig med 3-korts stöd', () => {
    // Rena 3-stödshänder över hela styrkeregistret (svag → limit → GF). Ingen av
    // dem får bli ett Bergen-bud (3♣/3♦ eller 3M som spärrhöjning).
    const threeSupport: [string, string][] = [
      ['S:K83 H:Q74 D:8642 C:K53', 'svag ~8'],
      ['S:KQ3 H:K74 D:Q642 C:J53', 'konstruktiv ~11'],
      ['S:AQ3 H:K74 D:KJ42 C:Q53', 'limit ~14'],
      ['S:842 H:K74 D:96532 C:73', 'svag med singel-ish'],
    ]
    for (const [h, label] of threeSupport) {
      it(`${label}: ${h} → inget Bergen-bud`, () => {
        const r = respondToMajor(parseHand(h), 'hearts')
        expect(r.rule.startsWith('Bergen')).toBe(false)
        expect(['3C', '3D']).not.toContain(r.call)
        expect(r.call).not.toBe('3H') // 3M vore Bergen spärr
      })
    }
  })

  // ---- FAS 3 punkt 13: Jacoby 2NT – rätt stöd (4+), ingen kortfärg ----
  describe('Jacoby 2NT', () => {
    it('4 stöd, GF-styrka, balanserat (ingen kortfärg) → 2NT Jacoby', () => {
      const r = respondToMajor(parseHand('S:K94 H:KQ74 D:A83 C:Q53'), 'hearts')
      expect(r.call).toBe('2NT')
      expect(r.rule).toBe('Jacoby 2NT')
    })

    it('samma styrka men MED kortfärg → splinter, aldrig Jacoby', () => {
      // 4 hjärter, singel ruter, GF → tvetydig splinter (3♠), inte 2NT.
      const r = respondToMajor(parseHand('S:KQ95 H:KQ73 D:8 C:K842'), 'hearts')
      expect(r.call).not.toBe('2NT')
      expect(r.rule).not.toBe('Jacoby 2NT')
      expect(r.rule).toContain('splinter')
    })

    it('3-korts stöd med GF-styrka bjuder ALDRIG Jacoby 2NT', () => {
      // 15 hp men bara 3 hjärter → faller till 2/1, inte Jacoby (kräver 4+).
      const r = respondToMajor(parseHand('S:AQ3 H:K74 D:AKJ2 C:Q53'), 'hearts')
      expect(r.rule).not.toBe('Jacoby 2NT')
    })
  })
})

describe('respondToMinor', () => {
  it('pass med för svag hand', () => {
    expect(respM('S:9532 H:863 D:9742 C:Q3', 'clubs')).toBe('P') // 2 hp, 2 stöd
  })

  it('svag spärrhöjning (3♣) med 5+ stöd och 0–6', () => {
    expect(respM('S:863 H:952 D:73 C:KJ842', 'clubs')).toBe('3C') // 4 hp, 5 klöver
  })

  it('svag spärrhöjning (3♦) över 1♦', () => {
    expect(respM('S:863 H:952 D:KJ842 C:73', 'diamonds')).toBe('3D') // 4 hp, 5 ruter
  })

  it('4-korts högfärg upp – billigast först (1♥ med 4-4 i högfärgerna)', () => {
    expect(respM('S:KQ85 H:KJ73 D:Q4 C:952', 'clubs')).toBe('1H') // 11 hp, up the line
  })

  it('4-korts högfärg upp – 1♠ med bara spader', () => {
    expect(respM('S:KJ85 H:73 D:Q842 C:953', 'clubs')).toBe('1S') // 6 hp, 4 spader
  })

  // ---- Ägarbeslut 2026-07-06 (felrapport #31): svagt hoppskift avskaffat. ----
  // När partnern har öppnat håller svararen budgivningen LÅG och bjuder den nya
  // högfärgen billigast på 1-läget (rondkrav) – ett hopp berövar partnern utrymme
  // (t.ex. 1NT). En svag 6-korts högfärg svarar därför 1♥/1♠, inte 2♥/2♠.
  it('svag 6-korts hjärter över 1♣ → 1♥ (INTE 2♥ hoppskift)', () => {
    expect(respM('S:73 H:KQ9742 D:K63 C:95', 'clubs')).toBe('1H') // 8 hp, 6 hjärter
  })

  it('svag 6-korts spader över 1♦ → 1♠ (INTE 2♠ hoppskift)', () => {
    expect(respM('S:KQ9742 H:3 D:863 C:K95', 'diamonds')).toBe('1S') // 8 hp, 6 spader
  })

  // Felrapport #31 (facit): ♠7 ♥KT6432 ♦Q4 ♣A986, 9 hp + 6-korts hjärter över
  // 1♦. Motorn hoppade förr till 2♥ (för starkt/tvåfärgat för spärr och berövar
  // partnern utrymme). Rätt: 1♥ (ny färg, rondkrav) – håll budgivningen låg.
  it('felrapport #31: 6-korts hjärter + ess utanför över 1♦ → 1♥ (INTE 2♥)', () => {
    expect(respM('S:7 H:KT6432 D:Q4 C:A986', 'diamonds')).toBe('1H') // 9 hp, 6 hjärter
  })

  it('stark inverterad höjning (2♣) med 4+ stöd och 10+', () => {
    expect(respM('S:A53 H:Q72 D:4 C:KQ8642', 'clubs')).toBe('2C') // 11 hp, 6 stöd
  })

  it('stark inverterad höjning (2♦) över 1♦', () => {
    expect(respM('S:A53 H:Q72 D:KQ8642 C:4', 'diamonds')).toBe('2D') // 11 hp, 6 stöd
  })

  it('2-över-1 GF (2♣) över 1♦ med 5+ klöver, 12+', () => {
    expect(respM('S:K3 H:A4 D:543 C:KQJ862', 'diamonds')).toBe('2C') // 13 hp
  })

  it('2-över-1 GF (2♦) över 1♣ med 5+ ruter, 12+', () => {
    expect(respM('S:K3 H:A4 D:KQJ862 C:543', 'clubs')).toBe('2D') // 13 hp
  })

  it('1NT naturlig med 6–10 utan högfärg', () => {
    expect(respM('S:K83 H:Q72 D:Q642 C:953', 'clubs')).toBe('1NT') // 7 hp
  })

  it('2NT inbjudan med 11–12 balanserad utan högfärg', () => {
    expect(respM('S:KJ3 H:Q72 D:KQ42 C:953', 'clubs')).toBe('2NT') // 11 hp, 3 stöd
  })

  it('3NT med 13–15 balanserad utan högfärg', () => {
    expect(respM('S:KJ3 H:KQ2 D:KQ42 C:953', 'clubs')).toBe('3NT') // 14 hp
  })

  // ---- Ägarregel 2026-07-05: balanserad utgångshand med lågfärgsfit chansar
  // inte 3NT med en riktigt svag färg – utforskar via inverterad 2m (→ 5m). ----
  it('balanserad 13–15 med 4+ fit och ALLA färger hållna → 3NT direkt', () => {
    expect(respM('S:K5 H:KJ7 D:A982 C:KJ32', 'diamonds')).toBe('3NT') // 15 hp, allt täckt
  })

  it('balanserad 13–15 med 4+ fit men en osparrad högfärg → inverterad 2♦ (utforska)', () => {
    // Spader 83 + hjärter 952 = två öppna färger → 3NT vore en gissning; gå via
    // 2♦ i stället så paret kan landa i 5♦ när färgerna inte kan hållas.
    expect(respM('S:83 H:952 D:AQ92 C:AK32', 'diamonds')).toBe('2D') // 13 hp
  })

  it('gap-handen → 1NT med 7–9 och stöd men utan högfärg', () => {
    expect(respM('S:K3 H:972 D:KJ42 C:9532', 'diamonds')).toBe('1NT') // 7 hp, 4 stöd
  })

  // ---- FAS 4 steg C-2: minorhöjningar på TP (längd/sidofärg lyfter, korthet ej) ----
  describe('C-2 – minorhöjning lyfts på längd/sidofärg, inte korthet', () => {
    it('formstark 9-poängare (5 stöd + 4-korts sidofärg) lyfts till inverterad minor', () => {
      // 9 hp, men 5 ruter + 4 klöver → bergen-notrump 11 TP → stark inverterad 2♦.
      // (Rå HP 9 hade blivit gap-hand 1NT; formen lyfter, inte kortheten.)
      expect(respM('S:K3 H:82 D:K8642 C:K432', 'diamonds')).toBe('2D')
    })

    it('platt 9-poängare (ingen extra längd) lyfts INTE – stannar gap-hand 1NT', () => {
      // 9 hp, 3-3-4-3, ingen sidofärg → bergen-notrump ≈ HP → för svag för inverterad.
      expect(respM('S:Q54 H:Q54 D:K642 C:Q54', 'diamonds')).toBe('1NT')
    })
  })

  // ---- FAS 6 punkt 28 (ägarbeslut 2026-07-01): INGET svagt hoppskift i den ----
  // andra minorn. En svag 6-korts klöverhand över 1♦ bjuder 1NT, inte 3♣ (följer
  // detaljtabellen; systembokens prosa-exempel "1♦–3♣" gäller alltså inte).
  it('svag 6-korts klöver över 1♦ → 1NT (INTE 3♣ hoppskift)', () => {
    expect(respM('S:32 H:J43 D:K3 C:KQ9764', 'diamonds')).toBe('1NT') // 9 hp, 6 klöver
  })
})
