import { describe, expect, it } from 'vitest'
import { parseHand, type ResolvedCall } from '../bidding'
import { buildAuction } from './auction'
import { decideCallTraced } from './auction-live'
import type { Deal, Seat } from '../../types/bridge'

// FAS 2 punkt 8: stöddubbling (systembok §7.4) i den levande auktionen.
//
// FACIT (arbetsregel A): giv → rätt bud.
//   Sekvens: öppning 1 i färg – (LHO pass) – svararen 1♥/1♠ – (RHO färginkliv).
//   Öppnaren med EXAKT 3 stöd i svararens högfärg upplyser med X (stöddubbling);
//   en direkt höjning skulle visa 4 stöd. Gäller bara så länge "2 i partnerns
//   högfärg" fortfarande kan bjudas (standard: t.o.m. 2M).
// Sedan motorbytets etapp 4 familj 3 (2026-09-08) är stöddubblingen tabell-
// raden *stöd-x*, bjuden på ett inkliv som faktiskt lagts. Manusets gamla
// stöddubblingsrond — som lade RHO:s inkliv bara när öppnaren hade exakt tre
// stöd (en kik i öppnarens hand) — är riven, så botauktionen är ostörd tills
// familj 4 ger öppnaren sitt konkurrensåterbud i tabellen.
// Obs: tian skrivs som T i parseHand (inte "10").

function deal(N: string, E: string, S: string, W: string): Deal {
  return {
    id: 'test',
    board: 1,
    dealer: 'N',
    vulnerability: 'none',
    hands: { N: parseHand(N), E: parseHand(E), S: parseHand(S), W: parseHand(W) },
  }
}
const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

describe('FAS 2 punkt 8 – stöddubbling i den levande auktionen', () => {
  const d = deal(
    'S:A32 H:K32 D:AKJ432 C:2', // N: 15 hp, 6 ruter, EXAKT 3 hjärter → 1♦, sedan stöd-X
    'S:76 H:JT98 D:T8 C:KJT98', // E: 5 hp, inget inkliv → pass
    'S:Q54 H:AQ54 D:65 C:Q543', // S: 10 hp, 4 hjärter → 1♥
    'S:KJT98 H:76 D:Q97 C:A76', // W: 10 hp, 5 spader → inkliv 1♠
  )
  it('1♦ – (P) – 1♥ – (1♠) – X (öppnaren visar exakt 3 hjärter) ur tabellen', () => {
    const t = decideCallTraced(d, [call('N', '1D'), call('E', 'P'), call('S', '1H'), call('W', '1S')], 'N')
    expect(t.källa).toBe('tabell:stöd-x')
    expect(t.call).toMatchObject({ bid: 'X', rule: 'stöddubbling' })
  })
  it('botauktionen är ostörd (RHO:s inkliv över svaret väntar på familj 4) — ingen kik i öppnarens hand', () => {
    const a = buildAuction(d)!
    expect(a.turns.slice(0, 2).map((t) => t.call)).toEqual(['1D', '1H'])
    expect(a.turns.every((t) => t.role !== 'motståndare')).toBe(true)
  })
})
