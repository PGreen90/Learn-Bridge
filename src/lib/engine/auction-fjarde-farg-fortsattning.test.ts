// FACIT-TEST: SVARAREN PASSAR SIN EGEN FJÄRDE FÄRG (krav) → utgång missas.
//
// Systemrevisorns spanare hittade frö 20260743 (ostörd, 33 hp gemensamt): auktionen
// S:P W:1♣ N:P E:1♥ S:P W:1♠ N:P E:2♦[fjärde färg krav] S:P W:2NT[svar på fjärde
// färg] N:P — och sedan PASSAR E (14 hp) öppnarens svar. Fjärde färg är per
// definition krav (utgångsvärden); pass är regelvidrigt. `auctionForce` täcker
// medvetet inte fjärde färg, och det fanns ingen fortsättningsregel för svararen
// efter att fjärde färgen besvarats → reservpass. Med 33 hp och alla fyra färger
// stoppade är 3NT den systemriktiga utgången (ingen 8-korts fit).

import { describe, expect, it } from 'vitest'
import { dealFromSeed, botAuction } from './revisor'
import { contractFromCalls } from './auction-contract'

describe('fjärde färg (krav): svararen placerar utgång, passar aldrig', () => {
  it('frö 20260743: 1♣–1♥–1♠–2♦(fjärde färg)–2NT → svararen driver till 3NT (ej pass i 2NT)', () => {
    const calls = botAuction(dealFromSeed(20260743))!
    const contract = contractFromCalls(calls)
    expect(contract).not.toBeNull()
    // Utgång nådd – inte utpassad i 2NT.
    expect(contract!.level).toBeGreaterThanOrEqual(3)
    expect(contract).toMatchObject({ level: 3, strain: 'NT' })
    // Svararen (E) får inte ha passat sitt eget fjärde färg-krav.
    const eBids = calls.filter((c) => c.seat === 'E').map((c) => c.bid)
    expect(eBids).toContain('3NT')
  })
})
