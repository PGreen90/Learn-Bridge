// R1 Fynd #2: öppnarens ROND-2 i en STÖRD auktion när partnern svarat med en
// FRI NY FÄRG eller 1NT (INTE en höjning) och motståndarna KONKURRERAT över
// svaret. FACIT FÖRE FIX.
//
// Roten (bevisad i utforskning 2026-07-05): så snart motståndarna bjöd om över
// partnerns fria svar passade öppnaren bort ÄVEN starka händer (rondkravet är
// tekniskt av då). Ägarbeslut: visa extra med CUE i deras färg + naturliga hopp;
// trösklar speglar delbit 6 (15+ = extra, 18+ = utgång, 6:e kortet = tävla).
//
// Testar via decideCall (integration) → bevisar också att verktyget NÅS live.
import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { decideCall, legalCalls } from './auction-live'

function call(seat: Seat, bid: string): ResolvedCall {
  return { seat, bid }
}
function dealOf(dealer: Seat, hands: Record<Seat, string>): Deal {
  return {
    id: 'test', dealer, vulnerability: 'none', board: 1,
    hands: { N: parseHand(hands.N), E: parseHand(hands.E), S: parseHand(hands.S), W: parseHand(hands.W) },
  }
}

// ---- A) 1♣–(1♦)–1♥–(2♦): ny färg på 1-läget + konkurrens → Syd (öppnaren) -----
const A_HISTORY = [call('S', '1C'), call('W', '1D'), call('N', '1H'), call('E', '2D')]
const A_CTX = {
  N: 'S:842 H:KJ85 D:73 C:Q976', // 6 hp, 4-korts hjärter (1♥-svaret)
  W: 'S:K5 H:T4 D:AQ9762 C:J53', // 10 hp, 6-korts ruter (1♦-inkliv)
  E: 'S:QJ97 H:63 D:KT8 C:AT84', // ruterstöd (2♦)
}

describe('Öppnarens rond-2 i konkurrens efter partnerns 1-lägessvar (1♣–(1♦)–1♥–(2♦))', () => {
  it('18+ med hjärterfit → utgång 4♥', () => {
    // 18 hp, 4-korts hjärter (fit), 6-korts klöver
    const deal = dealOf('S', { ...A_CTX, S: 'S:A3 H:AQ96 D:8 C:AKJ752' })
    expect(decideCall(deal, A_HISTORY, 'S').bid).toBe('4H')
  })

  it('15–17 med hjärterfit → inbjudande hopphöjning 3♥', () => {
    // 15 hp, 4-korts hjärter (fit), jämn 3-4-3-3 → landar i extra-bandet (ej game)
    const deal = dealOf('S', { ...A_CTX, S: 'S:AJ3 H:KQ96 D:K43 C:Q52' })
    expect(decideCall(deal, A_HISTORY, 'S').bid).toBe('3H')
    expect(legalCalls(A_HISTORY, 'S')).toContain('3H')
  })

  it('minimum, ingen fit men egen 6+ färg → tävlar 3♣', () => {
    // 12 hp, 2-korts hjärter (ingen fit), 7-korts klöver
    const deal = dealOf('S', { ...A_CTX, S: 'S:A3 H:94 D:82 C:AKJT752' })
    expect(decideCall(deal, A_HISTORY, 'S').bid).toBe('3C')
  })

  it('minimum, ingen fit, ingen lång färg → passar (faller igenom)', () => {
    // 13 hp, 3-korts hjärter (ingen 4-fit), inga 6+ färger
    const deal = dealOf('S', { ...A_CTX, S: 'S:AJ3 H:Q94 D:842 C:AQ54' })
    expect(decideCall(deal, A_HISTORY, 'S').bid).toBe('P')
  })
})

// ---- B) 1♥–(1♠)–2♣–(2♠): 2/1 ny färg + konkurrens → Syd (öppnaren) ------------
const B_HISTORY = [call('S', '1H'), call('W', '1S'), call('N', '2C'), call('E', '2S')]
const B_CTX = {
  N: 'S:52 H:K6 D:A83 C:KJ9762', // 11 hp, 6-korts klöver (2/1-svaret)
  W: 'S:AQ976 H:T4 D:K84 C:Q53', // 11 hp, 5-korts spader (1♠-inkliv)
  E: 'S:KJ3 H:J952 D:QT76 C:84', // spaderstöd (2♠)
}

describe('Öppnarens rond-2 i konkurrens efter partnerns 2/1 (1♥–(1♠)–2♣–(2♠))', () => {
  it('extra (~16) utan klar utgång → cue i deras färg 3♠ (den lagade buggen)', () => {
    // 15 hp, 3-korts klöver (fit), ingen klar naturlig utgång
    const deal = dealOf('S', { ...B_CTX, S: 'S:K3 H:AKJ95 D:A65 C:832' })
    expect(decideCall(deal, B_HISTORY, 'S').bid).toBe('3S')
    expect(legalCalls(B_HISTORY, 'S')).toContain('3S')
  })

  it('18+ jämn hand med spaderstopp → 3NT', () => {
    // 18 hp, jämn 3-5-3-2, spaderstopp KQ3, ingen klöverfit (2)
    const deal = dealOf('S', { ...B_CTX, S: 'S:KQ3 H:AQ952 D:AK5 C:82' })
    expect(decideCall(deal, B_HISTORY, 'S').bid).toBe('3NT')
  })

  it('minimum med klöverfit → tävlar 3♣', () => {
    // 13 hp, 3-korts klöver (fit), 5-korts hjärter (ej 6)
    const deal = dealOf('S', { ...B_CTX, S: 'S:83 H:AQ975 D:K85 C:A83' })
    expect(decideCall(deal, B_HISTORY, 'S').bid).toBe('3C')
  })
})

// ---- C) 1♣–(1♦)–1NT–(2♦): 1NT-svar (ej krav) + konkurrens → Syd (öppnaren) ----
const C_HISTORY = [call('S', '1C'), call('W', '1D'), call('N', '1NT'), call('E', '2D')]
const C_CTX = {
  N: 'S:K85 H:Q94 D:JT3 C:Q962', // 7 hp, 1NT-svaret (ingen 4-korts högfärg)
  W: 'S:A5 H:T4 D:AQ9762 C:J53', // 11 hp, 6-korts ruter (1♦-inkliv)
  E: 'S:Q972 H:KJ63 D:K8 C:AT4', // (2♦)
}

describe('Öppnarens rond-2 i konkurrens efter partnerns 1NT-svar (1♣–(1♦)–1NT–(2♦))', () => {
  it('extra (~17) utan ruterstopp → cue 3♦ (letar 3NT/rätt utgång)', () => {
    // 17 hp, 6-korts klöver, INGET ruterstopp (D:82)
    const deal = dealOf('S', { ...C_CTX, S: 'S:KQ H:A85 D:82 C:AKJ752' })
    expect(decideCall(deal, C_HISTORY, 'S').bid).toBe('3D')
    expect(legalCalls(C_HISTORY, 'S')).toContain('3D')
  })

  it('minimum, egen 6+ färg → tävlar 3♣', () => {
    // 12 hp, 6-korts klöver
    const deal = dealOf('S', { ...C_CTX, S: 'S:53 H:A85 D:82 C:AKJ752' })
    expect(decideCall(deal, C_HISTORY, 'S').bid).toBe('3C')
  })
})
