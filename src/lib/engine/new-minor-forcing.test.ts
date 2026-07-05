import { describe, expect, it } from 'vitest'
import type { Deal, Seat, Suit } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import type { ResponseResult } from './responses'
import { parseHand } from '../bidding'
import { responderRebidColorAuction, responderPlaceAfterNMF } from './responder-rebids'
import { openerAnswerNMF } from './rebids'
import { decideCall } from './auction-live'

// =============================================================================
// FACIT: New Minor Forcing (NMF) — steg 1: SVARARENS NMF-bud  (2026-07-05)
// -----------------------------------------------------------------------------
// Efter 1m–1M(1-läget)–1NT (öppnarens 1NT-rebud = 12–14 bal) hoppade svararen förr
// rakt till sang-stegen och tappade en dold 5-3-högfärgsfit. NMF: med 5-korts
// högfärg + inbjudande+ värden (11+) bjuder svararen den OANVÄNDA lågfärgen (2♣/2♦)
// konstgjort & tvingande. Efter 1♥–1♠–1NT är båda lågfärgerna lediga → bjud den
// STARKARE (antyder stopp). Ägarbeslut 2026-07-05.
// =============================================================================

const REBID_1NT = '1NT (12–14)' // öppnarens 1NT-rebud (exakt regelsträng)

function nmf(notation: string, opened: Suit, responderSuit: Suit): string {
  const rebid: ResponseResult = { call: '1NT', rule: REBID_1NT, explanation: '' }
  return responderRebidColorAuction(parseHand(notation), opened, responderSuit, rebid)?.call ?? 'null'
}

describe('NMF steg 1 – svararens New Minor Forcing-bud', () => {
  // 1♣–1♥–1NT: oanvänd lågfärg = ruter → 2♦.
  it('1♣–1♥–1NT, 5-korts hjärter + 12 hp → 2♦ (NMF)', () => {
    expect(nmf('S:842 H:AQ976 D:K5 C:K84', 'clubs', 'hearts')).toBe('2D')
  })

  // 1♦–1♥–1NT: oanvänd lågfärg = klöver → 2♣.
  it('1♦–1♥–1NT, 5-korts hjärter + 12 hp → 2♣ (NMF)', () => {
    expect(nmf('S:842 H:AQ976 D:K5 C:K84', 'diamonds', 'hearts')).toBe('2C')
  })

  // 1♥–1♠–1NT: båda lågfärger lediga → bjud den starkare. Här starkast ruter.
  it('1♥–1♠–1NT, 5-korts spader, starkare ruter → 2♦ (NMF)', () => {
    expect(nmf('S:AQ976 H:54 D:KJ4 C:Q83', 'hearts', 'spades')).toBe('2D')
  })

  // 1♥–1♠–1NT: starkare klöver → 2♣.
  it('1♥–1♠–1NT, 5-korts spader, starkare klöver → 2♣ (NMF)', () => {
    expect(nmf('S:AQ976 H:54 D:Q83 C:KJ4', 'hearts', 'spades')).toBe('2C')
  })

  // För svag (9 hp) → inte NMF, gamla sang-stegen gäller (pass med minimum).
  it('för svag (9 hp) → ingen NMF, passar (sang-stegen)', () => {
    expect(nmf('S:842 H:AQ976 D:952 C:K84', 'clubs', 'hearts')).toBe('P')
  })

  // Bara 4-korts högfärg (ingen 5-3-fit att jaga) → ingen NMF → 3NT med 13 hp.
  it('4-korts högfärg + 13 hp → ingen NMF → 3NT', () => {
    expect(nmf('S:82 H:AQ97 D:KQ84 C:Q84', 'clubs', 'hearts')).toBe('3NT')
  })
})

// =============================================================================
// FACIT: NMF — steg 2: ÖPPNARENS svar (de fem prioriteringarna)
// -----------------------------------------------------------------------------
// Öppnaren rebjöd 1NT (12–14) och hör NMF. Prioritet: 4-korts ANDRA högfärg →
// 3-korts stöd i svararens högfärg (min enkel / max hopp) → NT m. stopp i objuden
// färg → höj NMF-lågfärgen (4 kort) → rebjud egen färg (nödutväg). max = 14 hp.
// =============================================================================

function oa(notation: string, opened: Suit, responderMajor: Suit, nmfMinor: Suit, unbid: Suit): string {
  return openerAnswerNMF(parseHand(notation), opened, responderMajor, nmfMinor, unbid).call
}

describe('NMF steg 2 – öppnarens svar på New Minor Forcing', () => {
  // 1) 4-korts ANDRA högfärg. 1♦–1♠–1NT–2♣ → öppnaren visar 4 hjärter → 2♥.
  it('4-korts andra högfärg → 2♥', () => {
    expect(oa('S:K3 H:AJ85 D:A9763 C:Q4', 'diamonds', 'spades', 'clubs', 'hearts')).toBe('2H')
  })

  // 2) 3-korts stöd i svararens högfärg. 1♣–1♥–1NT–2♦.
  it('3-korts stöd, minimum (13) → 2♥', () => {
    expect(oa('S:K73 H:K85 D:Q4 C:AJ932', 'clubs', 'hearts', 'diamonds', 'spades')).toBe('2H')
  })
  it('3-korts stöd, maximum (14) → hopp 3♥', () => {
    expect(oa('S:Q73 H:K85 D:A4 C:AJ932', 'clubs', 'hearts', 'diamonds', 'spades')).toBe('3H')
  })

  // 3) NT med stopp i den objudna färgen (spader). 1♣–1♥–1NT–2♦.
  it('stopp i objuden färg, minimum → 2NT', () => {
    expect(oa('S:KJ3 H:J5 D:Q84 C:KQ932', 'clubs', 'hearts', 'diamonds', 'spades')).toBe('2NT')
  })
  it('stopp i objuden färg, maximum → 3NT', () => {
    expect(oa('S:KJ3 H:J5 D:A84 C:KQ932', 'clubs', 'hearts', 'diamonds', 'spades')).toBe('3NT')
  })

  // 4) Höj NMF-lågfärgen med 4 kort (inget major/stopp). 1♣–1♥–1NT–2♦.
  it('4 kort i NMF-lågfärgen → 3♦', () => {
    expect(oa('S:832 H:J5 D:AQ84 C:KQ93', 'clubs', 'hearts', 'diamonds', 'spades')).toBe('3D')
  })

  // 5) Nödutväg: rebjud öppningsfärgen (NMF är krav, pass förbjudet). 1♣–1♥–1NT–2♦.
  it('inget av ovan → rebjud öppningsfärgen 3♣', () => {
    expect(oa('S:832 H:J5 D:K54 C:AKJ93', 'clubs', 'hearts', 'diamonds', 'spades')).toBe('3C')
  })

  // Integration: i en LEVANDE auktion svarar öppnaren NMF (passar aldrig bort det).
  it('decideCall: öppnaren (Nord) svarar 2♥ på partnerns NMF, passar inte', () => {
    const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
    const deal: Deal = {
      id: 't', dealer: 'N', vulnerability: 'none', board: 1,
      hands: {
        N: parseHand('S:K73 H:K85 D:Q4 C:AJ932'), // öppnaren: 3-korts stöd, min
        S: parseHand('S:A82 H:AQ976 D:K5 C:84'), // svararen: 5-korts hjärter, NMF
        E: parseHand('S:QJ96 H:JT D:JT9762 C:7'),
        W: parseHand('S:T54 H:432 D:A83 C:KQT6'),
      },
    }
    const history = [
      call('N', '1C'), call('E', 'P'), call('S', '1H'), call('W', 'P'),
      call('N', '1NT'), call('E', 'P'), call('S', '2D'), call('W', 'P'),
    ]
    expect(decideCall(deal, history, 'N').bid).toBe('2H')
  })
})

// =============================================================================
// FACIT: NMF — steg 3: SVARARENS placering efter öppnarens svar
// -----------------------------------------------------------------------------
// Svararen (13+ = utgångskrav, 11–12 = inbjudan) placerar kontraktet: stöd → 4M
// (utgång) eller pass (inbjudan mot minimum); sang → 3NT/pass. Terminala bud.
// =============================================================================

function place(
  notation: string,
  responderMajor: Suit,
  otherMajor: Suit,
  nmfMinor: Suit,
  opened: Suit,
  unbid: Suit,
  answer: string,
): string {
  const m = /^([1-7])(NT|C|D|H|S)$/.exec(answer)!
  return responderPlaceAfterNMF(
    parseHand(notation), responderMajor, otherMajor, nmfMinor, opened, unbid,
    { level: Number(m[1]), strain: m[2] },
  ).call
}

describe('NMF steg 3 – svararens placering', () => {
  // Stöd (2♥ min): utgångsvärden → 4♥.
  it('stöd, öppnaren minimum (2♥) + utgångsvärden (14) → 4♥', () => {
    expect(place('S:K2 H:AQ976 D:Q85 C:K84', 'hearts', 'spades', 'diamonds', 'clubs', 'spades', '2H')).toBe('4H')
  })
  // Stöd (2♥ min): bara inbjudan → pass (delkontrakt).
  it('stöd, öppnaren minimum (2♥) + bara inbjudan (11) → pass', () => {
    expect(place('S:82 H:AQ976 D:Q85 C:K84', 'hearts', 'spades', 'diamonds', 'clubs', 'spades', '2H')).toBe('P')
  })
  // Stöd (3♥ max hopp): inbjudan räcker mot maximum → 4♥.
  it('stöd, öppnaren maximum (3♥) + inbjudan (11) → 4♥', () => {
    expect(place('S:82 H:AQ976 D:Q85 C:K84', 'hearts', 'spades', 'diamonds', 'clubs', 'spades', '3H')).toBe('4H')
  })
  // Sang (2NT min): utgångsvärden → 3NT.
  it('sang 2NT (min) + utgångsvärden (14) → 3NT', () => {
    expect(place('S:K2 H:AQ976 D:Q85 C:K84', 'hearts', 'spades', 'diamonds', 'clubs', 'spades', '2NT')).toBe('3NT')
  })
  // Sang (2NT min): bara inbjudan → pass.
  it('sang 2NT (min) + bara inbjudan (11) → pass', () => {
    expect(place('S:82 H:AQ976 D:Q85 C:K84', 'hearts', 'spades', 'diamonds', 'clubs', 'spades', '2NT')).toBe('P')
  })
  // Sang 3NT (max): utgång redan nådd → pass.
  it('öppnaren bjöd 3NT → pass', () => {
    expect(place('S:82 H:AQ976 D:Q85 C:K84', 'hearts', 'spades', 'diamonds', 'clubs', 'spades', '3NT')).toBe('P')
  })

  // Integration: hela NMF-linjen ut i mål via decideCall (svararen sätter utgång).
  it('decideCall: svararen sätter 4♥ efter öppnarens 2♥ (passar aldrig)', () => {
    const c = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })
    const deal: Deal = {
      id: 't', dealer: 'N', vulnerability: 'none', board: 1,
      hands: {
        N: parseHand('S:K73 H:K85 D:Q4 C:AJ932'), // öppnaren: 3-korts stöd
        S: parseHand('S:K2 H:AQ976 D:Q85 C:K84'), // svararen: 5-korts hjärter, 14 hp
        E: parseHand('S:QJ96 H:JT D:JT9762 C:7'),
        W: parseHand('S:AT854 H:432 D:AK3 C:QT'),
      },
    }
    const history = [
      c('N', '1C'), c('E', 'P'), c('S', '1H'), c('W', 'P'),
      c('N', '1NT'), c('E', 'P'), c('S', '2D'), c('W', 'P'),
      c('N', '2H'), c('E', 'P'),
    ]
    expect(decideCall(deal, history, 'S').bid).toBe('4H')
  })
})
