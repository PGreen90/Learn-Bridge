import { describe, expect, it } from 'vitest'
import type { ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { dealFromSeed } from './revisor'
import { kontrollbudslage, sattFarg } from './kontrollbud'

// =============================================================================
// FACIT: den allmänna kontrollbudsregeln (ägarbeslut 2026-09-24) — "när färgen
// är satt (oavsett hög- eller lågfärg) är en ny bjuden färg alltid ett
// kontrollbud", tillsvidare på 4-läget + 3♠ när hjärter är satt. Kontrollbud
// passas aldrig. Lägena kommer ur kontrollbudssvepet (KONTROLL=1): förr passades
// 546 av 851 kontrollbud och 145 fick konstiga svar (5♣/5♦ i fel färg).
// =============================================================================

const A = (s: string) => s.split(' ').map((c) => ({ seat: c[0], bid: c.slice(2) })) as ResolvedCall[]

describe('sattFarg / kontrollbudslage — läses bara ur auktionen', () => {
  it('färgen är satt när båda bjudit den naturligt', () => {
    expect(sattFarg(A('S:1S W:P N:2S E:P'), 'S')?.trump).toBe('spades')
    expect(sattFarg(A('S:1S W:P N:2C E:P'), 'S')).toBeNull()
  })

  it('Stayman räknas inte som att bjuda klöver', () => {
    expect(sattFarg(A('N:1NT E:P S:2C W:P N:2H E:P S:4H W:P'), 'N')?.trump).toBe('hearts')
  })

  it('ny färg på 4-läget = kontrollbud; på 3-läget inte (utom 3♠ i hjärter)', () => {
    expect(kontrollbudslage(A('S:1S W:P N:2S E:P S:4C W:P'), 'N')?.trump).toBe('spades')
    expect(kontrollbudslage(A('S:1S W:P N:2S E:P S:3C W:P'), 'N')).toBeNull() // hjälpfärgsinvit
    expect(kontrollbudslage(A('N:1C E:P S:1H W:P N:3H E:P S:3S W:P'), 'N')?.trump).toBe('hearts')
  })

  it('lågfärg: 4-läget är kontrollbud, stoppvisningen under 3NT orörd', () => {
    expect(kontrollbudslage(A('N:1D E:P S:2D W:P N:3D E:P S:4C W:P'), 'N')?.trump).toBe('diamonds')
    expect(kontrollbudslage(A('N:1D E:P S:2D W:P N:2H E:P'), 'S')).toBeNull()
  })
})

describe('kontrollbudet passas aldrig — lägen ur svepet', () => {
  const svar = (seed: number, auk: string, seat: 'N' | 'E' | 'S' | 'W') => decideCall(dealFromSeed(seed), A(auk), seat).bid

  it('1♠–2♠–4♣: partnern svarar kontroll eller 4♠ (förr pass)', () => {
    expect(['4D', '4H', '4S']).toContain(svar(20290073, 'S:1S W:P N:2S E:P S:4C W:P', 'N'))
  })

  it('1♦–1♥–1♠–3♠–4♣: partnern svarar kontroll eller 4♠ (förr 5♣ i fel färg)', () => {
    expect(['4D', '4H', '4S']).toContain(svar(20290034, 'N:P E:1D S:P W:1H N:P E:1S S:P W:3S N:P E:4C S:P', 'W'))
  })

  it('inverterad minor 1♣–2♣–2♦–3♣–4♦: kontroll på 4-läget eller trumf (förr pass)', () => {
    const b = svar(20290461, 'S:1C W:P N:2C E:P S:2D W:P N:3C E:P S:4D W:P', 'N')
    expect(b).not.toBe('P')
    expect(['4H', '4S', '5C']).toContain(b)
  })

  it('1♦–2♦–2♥–3♦–4♣: kontroll på 4-läget eller trumf (förr pass)', () => {
    const b = svar(20290551, 'N:1D E:P S:2D W:P N:2H E:P S:3D W:P N:4C E:P', 'S')
    expect(b).not.toBe('P')
    expect(['4H', '4S', '5D']).toContain(b)
  })
})
