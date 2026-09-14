// FACIT för claimens DD-dom (bordens SENARE-lista etapp 3, 2026-09-14): den
// riktiga lösaren ska säga JA när spelförarsidan tar alla återstående stick
// mot bästa motspel, NEJ när försvaret har ett säkert stick, och aldrig mitt i
// ett stick. Facit FÖRE kod.

import { describe, expect, it } from 'vitest'
import type { Deal } from '../../src/types/bridge'
import { parseHand } from '../../src/lib/bidding'
import { getDds } from '../../src/lib/engine/revisor-dds'
import { playCard, startPlay, type Contract } from '../../src/lib/engine/play'
import { claimKontrollen, spelforarenTarResten } from './claim-dd'

function deal(hands: Record<'N' | 'E' | 'S' | 'W', string>): Deal {
  return {
    id: 'claim-test', dealer: 'N', vulnerability: 'none', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}
const NT3_N: Contract = { declarer: 'N', strain: 'NT', level: 3 }

// Nord har 13 toppkort: allt är säkert från utspelet.
const ALLT_SAKERT = deal({
  N: 'S:AKQJ H:AKQJ D:AKQJ C:A',
  E: 'S:T98 H:T98 D:T98 C:KQJT',
  S: 'S:765 H:765 D:765 C:9876',
  W: 'S:432 H:432 D:432 C:5432',
})
// Samma, men Öst har klöveress: försvaret har ett säkert stick.
const ETT_STICK_BORTA = deal({
  N: 'S:AKQJ H:AKQJ D:AKQJ C:K',
  E: 'S:T98 H:T98 D:T98 C:AQJT',
  S: 'S:765 H:765 D:765 C:9876',
  W: 'S:432 H:432 D:432 C:5432',
})

describe('spelforarenTarResten — DD-domen', () => {
  it('ja när spelföraren har alla toppkort (försvaret leder, 13 stick kvar)', async () => {
    const dds = await getDds()
    expect(spelforarenTarResten(dds, startPlay(ALLT_SAKERT, NT3_N))).toBe(true)
  })
  it('nej när försvaret har ett säkert stick', async () => {
    const dds = await getDds()
    expect(spelforarenTarResten(dds, startPlay(ETT_STICK_BORTA, NT3_N))).toBe(false)
  })
  it('aldrig mitt i ett stick', async () => {
    const dds = await getDds()
    const st = playCard(startPlay(ALLT_SAKERT, NT3_N), { suit: 'clubs', rank: 'K' })
    expect(st.currentTrick.length).toBe(1)
    expect(spelforarenTarResten(dds, st)).toBe(false)
  })
  it('ja när spelföraren själv är på tur och tar resten', async () => {
    const dds = await getDds()
    // Öst leder ♣K, Nord vinner med ♣A → Nord leder nästa stick med 12 toppkort.
    let st = startPlay(ALLT_SAKERT, NT3_N)
    st = playCard(st, { suit: 'clubs', rank: 'K' })
    st = playCard(st, { suit: 'clubs', rank: '6' })
    st = playCard(st, { suit: 'clubs', rank: '2' })
    st = playCard(st, { suit: 'clubs', rank: 'A' })
    expect(st.toAct).toBe('N')
    expect(spelforarenTarResten(dds, st)).toBe(true)
  })
})

describe('claimKontrollen — den injicerbara kontrollen', () => {
  it('ger en synkron funktion som dömer som lösaren', async () => {
    const kontroll = await claimKontrollen()
    expect(kontroll).not.toBeNull()
    expect(kontroll!(startPlay(ALLT_SAKERT, NT3_N))).toBe(true)
    expect(kontroll!(startPlay(ETT_STICK_BORTA, NT3_N))).toBe(false)
  })
})
