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

  it('Bergen spärr (3 i färgen) med 4 stöd och svag', () => {
    expect(resp('S:8432 H:K974 D:K72 C:63', 'hearts')).toBe('3H') // 6 hp, 4 stöd
  })

  it('ny färg 1♠ med 4 spader över 1♥', () => {
    expect(resp('S:KQ85 H:73 D:Q842 C:K53', 'hearts')).toBe('1S') // 10 hp, ingen fit
  })

  it('svagt hoppskift 2♠ med 6 spader, svag', () => {
    expect(resp('S:KQ9742 H:3 D:Q842 C:53', 'hearts')).toBe('2S') // 7 hp, 6 spader
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

  it('svagt hoppskift 2♥ med 6 hjärter över 1♣', () => {
    expect(respM('S:73 H:KQ9742 D:K63 C:95', 'clubs')).toBe('2H') // 8 hp, 6 hjärter
  })

  it('svagt hoppskift 2♠ med 6 spader över 1♦', () => {
    expect(respM('S:KQ9742 H:3 D:863 C:K95', 'diamonds')).toBe('2S') // 8 hp, 6 spader
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

  it('gap-handen → 1NT med 7–9 och stöd men utan högfärg', () => {
    expect(respM('S:K3 H:972 D:KJ42 C:9532', 'diamonds')).toBe('1NT') // 7 hp, 4 stöd
  })
})
