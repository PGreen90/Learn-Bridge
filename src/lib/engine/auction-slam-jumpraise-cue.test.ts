import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { dealFromSeed } from './revisor'

// =============================================================================
// FACIT (ägarens rondgenomgång 2026-09-24): efter öppnarens HOPPHÖJNING av
// svararens högfärg (1♣–1♥–3♥, 16–18 med 4 stöd) är svararens NYA färg under
// utgång (4♣/4♦) ett KONTROLLBUD — hjärter är trumf, budet har passerat 3♥ och
// tvingar till utgång. Det får ALDRIG passas (kontrollbud ska alltid finnas,
// [[cue-bids-reinstated]]). Öppnaren visar billigaste egna kontroll under
// utgång (§6.2 cue-ronden) eller stannar i 4♥.
// Förr: 60 av 60 öppnarhänder passade 4♣ ("pass (ingen regel)"), och 4♦
// besvarades med 5♣/5♦/4♠ ur kravbudsreserven — cue-ronden var avstängd
// eftersom hopphöjningen bara är en inbjudan (ctx.gameForcing saknades).
// =============================================================================

const A = (s: string) => s.split(' ').map((c) => ({ seat: c[0], bid: c.slice(2) })) as ResolvedCall[]
const PRE = A('N:1C E:P S:1H W:P N:3H E:P')

/** Öppnarhänder (Nord ger) där motorn själv bjuder 1♣ … 3♥ som i auktionen. */
function oppnarhander(antal: number): Deal[] {
  const ut: Deal[] = []
  for (let seed = 20290001; ut.length < antal && seed < 20340001; seed++) {
    const d: Deal = { ...dealFromSeed(seed), dealer: 'N' as Seat }
    if (PRE.every((c, i) => c.seat === 'S' || decideCall(d, PRE.slice(0, i), c.seat).bid === c.bid)) ut.push(d)
  }
  return ut
}

describe('FACIT: kontrollbud efter 1♣–1♥–3♥ passas aldrig', () => {
  const hander = oppnarhander(20)

  it('hittar provhänder', () => {
    expect(hander.length).toBe(20)
  })

  it('1♣–1♥–3♥–4♣: öppnaren svarar 4♦ (kontroll) eller 4♥ — aldrig pass', () => {
    for (const d of hander) {
      const svar = decideCall(d, [...PRE, { seat: 'S', bid: '4C' }, { seat: 'W', bid: 'P' }] as ResolvedCall[], 'N').bid
      expect(['4D', '4H']).toContain(svar)
    }
  })

  it('1♣–1♥–3♥–4♦: öppnaren stannar i 4♥ (ingen kontroll under utgång kvar) — aldrig pass eller 5-läget', () => {
    for (const d of hander) {
      const svar = decideCall(d, [...PRE, { seat: 'S', bid: '4D' }, { seat: 'W', bid: 'P' }] as ResolvedCall[], 'N').bid
      expect(svar).toBe('4H')
    }
  })

  it('1♣–1♥–3♥–4♠ (kontrollbud ÖVER utgången): öppnaren stannar i 5♥ — aldrig pass, aldrig över 5-läget', () => {
    // Ägarbeslut 2026-09-24: "4 spader är ett kontrollbud, men det finns inte mycket
    // logisk relevans här" — ska man ändå till 5-läget frågar man hellre ess (4NT).
    for (const d of hander) {
      const svar = decideCall(d, [...PRE, { seat: 'S', bid: '4S' }, { seat: 'W', bid: 'P' }] as ResolvedCall[], 'N').bid
      expect(svar).toBe('5H')
    }
  })

  it('1♣–1♥–3♥–3♠: 3♠ är ett kontrollbud (enda på 3-läget, ägarbeslut 2026-09-24) → 4♣/4♦/4♥, aldrig pass eller 3NT', () => {
    for (const d of hander) {
      const svar = decideCall(d, [...PRE, { seat: 'S', bid: '3S' }, { seat: 'W', bid: 'P' }] as ResolvedCall[], 'N').bid
      expect(['4C', '4D', '4H']).toContain(svar)
    }
  })

  it('kontrollbud ÖVER utgången efter kaptenens avslut passas inte (2♣–2NT–3♥–4♣–4♦–4♥–4♠, kontrollbudssvepet)', () => {
    const d = dealFromSeed(20290674)
    const h = A('N:P E:2C S:P W:2NT N:P E:3H S:P W:4C N:P E:4D S:P W:4H N:P E:4S S:P')
    expect(['5H', '4NT']).toContain(decideCall(d, h, 'W').bid)
  })

  it('3♠ som kontrollbud gäller i varje budföljd med hjärter satt på 3-läget (1♣–1♥–2♥–3♥–3♠)', () => {
    let provade = 0
    for (let seed = 20290001; seed < 20340001 && provade < 10; seed++) {
      const d: Deal = { ...dealFromSeed(seed), dealer: 'N' as Seat }
      const pre = A('N:1C E:P S:1H W:P N:2H E:P S:3H W:P')
      if (!pre.every((c, i) => decideCall(d, pre.slice(0, i), c.seat).bid === c.bid)) continue
      provade++
      const svar = decideCall(d, [...pre, { seat: 'N', bid: '3S' }, { seat: 'E', bid: 'P' }] as ResolvedCall[], 'S').bid
      expect(['4C', '4D', '4H']).toContain(svar)
    }
    expect(provade).toBe(10)
  })

  it('kontroll i ruter → 4♦; utan → 4♥', () => {
    for (const d of hander) {
      const svar = decideCall(d, [...PRE, { seat: 'S', bid: '4C' }, { seat: 'W', bid: 'P' }] as ResolvedCall[], 'N').bid
      const ruter = d.hands.N.filter((c) => c.suit === 'diamonds')
      const kontroll = ruter.length === 0 || ruter.some((c) => c.rank === 'A')
      expect(svar).toBe(kontroll ? '4D' : '4H')
    }
  })
})
