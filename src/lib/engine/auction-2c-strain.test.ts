// F5/E2 (2♣-strain-valet): FACIT FÖRE FIX.
//
// Probe 2026-08-08 (4 000 seedade givar): 2♣-auktioner slutade i 5♣/6♣ trots
// 8+ högfärgsfit. Tre rotorsaker, alla låsta här med riktiga frön:
//
//  (1) frö 20261040 — svararen efter 2♣–2♦–3♦ bjöd sin egna 5-korts klöver
//      FÖRBI 3NT (4♣) fast en 4-korts hjärter fick plats under 3NT (3♥).
//      Fix 2 (2026-07-21) byggde högfärgssteget men la det EFTER egen-färg-
//      steget: "finaste färg" kräver att högfärgen under 3NT går före en
//      minor som spränger 3NT. (4-4-hjärterfiten fanns: 4♥ i stället för 5♣.)
//
//  (2) frö 20261885/20262070 — den forcerade minimistegen (`forcedMinimumBid`)
//      läste det KONSTGJORDA 2♣-öppningsbudet som "egen bjuden klöverfärg" och
//      valde dessutom billigast-först: klöverrebud (4♣) i stället för att
//      rebjuda den ÄKTA, redan visade 6-korts spadern (8-korts fit). Nu:
//      2♣-öppningen räknas aldrig som klöverfärg, och högfärger går före
//      minorer i rebjuds-steget.
//
//  (3) frö 20261885 (kaskaden) — `fitLengthNeeded` räknade också 2♣-öppningen
//      som ett klöverbud ("partnern har bjudit klöver två gånger → 6+, stöd
//      med dubbelton"): N höjde 4♣→5♣ på ♣xx. 2♣ räknas inte där heller.
import { describe, expect, it } from 'vitest'
import type { Seat } from '../../types/bridge'
import type { ResolvedCall } from '../bidding'
import { parseHand } from '../bidding'
import { responderSecondBidAfter2C } from './responses-2c'
import { decideCall } from './auction-live'
import { dealFromSeed } from './revisor'

const call = (seat: Seat, bid: string): ResolvedCall => ({ seat, bid })

describe('F5/E2 (1) — högfärg under 3NT före egen minor förbi 3NT', () => {
  // Frö 20261040, Syd: ♠953 ♥10987 ♦7 ♣KQJ106 (6 hp) efter 2♣–2♦–3♦.
  const south = parseHand('S:953 H:T987 D:7 C:KQJT6')
  const resp = { call: '2D', rule: '2♦ väntebud', explanation: '' }
  const rebid = { call: '3D', rule: 'rebid: krav-färg', explanation: '' }

  it('frö 20261040: 3♥ (4-korts högfärg under 3NT), inte 4♣ förbi 3NT', () => {
    expect(responderSecondBidAfter2C(south, resp, rebid)?.call).toBe('3H')
  })

  it('vakt: egen 5-korts HÖGfärg visas fortfarande naturligt', () => {
    const major5 = parseHand('S:KJT96 H:987 D:7 C:QT63')
    expect(responderSecondBidAfter2C(major5, resp, rebid)?.call).toBe('3S')
  })

  it('vakt: egen minor UNDER 3NT (2♣–2♦–3♣ med 5 ruter) bjuds som förr', () => {
    const dia5 = parseHand('S:953 H:987 D:KJT63 C:76')
    const rebidC = { call: '3C', rule: 'rebid: krav-färg', explanation: '' }
    expect(responderSecondBidAfter2C(dia5, resp, rebidC)?.call).toBe('3D')
  })
})

describe('F5/E2 (2) — forcerade stegen: äkta högfärg före konstgjord klöver', () => {
  // Frö 20262070, Öst (2♣-öppnaren, 6♠+5♣): efter W:s 3♥-rebud ska Öst
  // rebjuda sin ÄKTA spader (3♠, under 3NT), inte "rebjuda" klöver på 4-läget.
  it('frö 20262070: öppnaren rebjuder 3♠, inte 4♣', () => {
    const deal = dealFromSeed(20262070)
    const history = [
      call('E', '2C'), call('S', 'P'), call('W', '2H'), call('N', 'P'),
      call('E', '2S'), call('S', 'P'), call('W', '3H'), call('N', 'P'),
    ]
    expect(decideCall(deal, history, 'E').bid).toBe('3S')
  })

  // Frö 20261885, Syd (2♣-öppnaren, 6♠+6♣): efter N:s 3♦ ska Syd rebjuda
  // spadern (6+ kort, 8-korts fit hos partnern) — inte klövern förbi 3NT.
  it('frö 20261885: öppnaren rebjuder 3♠, inte 4♣', () => {
    const deal = dealFromSeed(20261885)
    const history = [
      call('N', 'P'), call('E', 'P'), call('S', '2C'), call('W', 'P'),
      call('N', '2D'), call('E', 'P'), call('S', '2S'), call('W', 'P'),
      call('N', '3D'), call('E', 'P'),
    ]
    expect(decideCall(deal, history, 'S').bid).toBe('3S')
  })
})

describe('F5/E2 (3) — 2♣-öppningen är ingen klöverfärg för fit-räkningen', () => {
  // Frö 20261885, Nord med ♣47: höjde förr 4♣→5♣ ("partnern bjöd klöver två
  // gånger" = 2♣ + 4♣ → dubbelton räckte). 2♣ är konstgjort — med bara ETT
  // äkta klöverbud kräver fiten 4+ kort, så Nord ska inte höja på ♣47.
  it('frö 20261885: Nord höjer inte 4♣ till 5♣ på dubbelton', () => {
    const deal = dealFromSeed(20261885)
    const history = [
      call('N', 'P'), call('E', 'P'), call('S', '2C'), call('W', 'P'),
      call('N', '2D'), call('E', 'P'), call('S', '2S'), call('W', 'P'),
      call('N', '3D'), call('E', 'P'), call('S', '4C'), call('W', 'P'),
    ]
    expect(decideCall(deal, history, 'N').bid).not.toBe('5C')
  })
})
