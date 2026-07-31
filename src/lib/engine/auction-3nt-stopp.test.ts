// FACIT-TEST för ETAPP 7 hål 2 ("3NT-stoppen", docs/systemrevisorn.md):
// MISSAD LILLSLAM där VÅR sida landade i ett naturligt 3NT under en görbar slam.
//
// Systerfallet till felrapport #42, fast från den sida som SJÄLV har extra: i #42
// HÖR kaptenen partnerns naturliga 3NT och höjer; här är det ÖPPNAREN som
// invit-hoppat i sin minor, fått svararen att acceptera med 3NT, och sedan saknat
// en väg vidare (nakna passet, Fynd 1). decideCall tog slut på maskineri.
//
// Ägarbeslut 2026-07-31 (den smala, ärliga porten – "bara äkta extra"): öppnaren
// gör EN kvantitativ slamtrevare (4NT) bara med genuint slamvärde hen SJÄLV vet
// om — 19+ hp med den 6-korts minoren. Svararen accepterar 6NT med ett maximum av
// sin acceptans (topp av intervallet eller en fittande topphonnör i minoren),
// annars passar hen 4NT. Ingen kontrollkoll (ägarbeslut), taket är 6NT.
//
// Huvudfallet är den RIKTIGA given frö 20261020 ur mätningen (Nord 20 hp, ♣AQT843
// mittemot ♠A/♣K92; 6NT ger 12 stick). Gränsvakterna låser att en 16–18-hand INTE
// trevar (då är slam bara distribution öppnaren inte kan se) och att svararen
// avböjer med ett minimum.

import { describe, expect, it } from 'vitest'
import type { Deal, Seat } from '../../types/bridge'
import { parseHand, type ResolvedCall } from '../bidding'
import { decideCall } from './auction-live'
import { dealFromSeed, botAuction } from './revisor'
import { contractFromCalls } from './auction-contract'

const call = (seat: Seat, bid: string): ResolvedCall =>
  ({ seat, bid, rule: '', explanation: '' }) as ResolvedCall

// ---- Huvudfall: riktiga given frö 20261020 --------------------------------
// N: ♠K ♥AK3 ♦AT5 ♣AQT843 (20 hp) · S: ♠A632 ♥J974 ♦Q2 ♣K92 (10 hp, ♣K fittar)
// Auktion: 1♣–1♥–3♣(19+ hopp)–3NT. Nord ska nu treva 4NT, Syd acceptera → 6NT.
const seed20261020 = dealFromSeed(20261020)

const upTo3NT_20261020: ResolvedCall[] = [
  call('N', '1C'), call('E', 'P'), call('S', '1H'), call('W', 'P'),
  call('N', '3C'), call('E', 'P'), call('S', '3NT'), call('W', 'P'),
]
const upTo4NT_20261020: ResolvedCall[] = [
  ...upTo3NT_20261020, call('N', '4NT'), call('E', 'P'),
]

describe('Etapp 7 hål 2 – 3NT-stoppen (öppnarens slamtrevare efter svararens 3NT)', () => {
  it('Nord (20 hp, löpande klöver) trevar 4NT i stället för att passa 3NT', () => {
    const n = decideCall(seed20261020, upTo3NT_20261020, 'N')
    expect(n.bid).toBe('4NT')
  })

  it('Syd (10 hp med fittande ♣K) accepterar trevaren → 6NT', () => {
    const s = decideCall(seed20261020, upTo4NT_20261020, 'S')
    expect(s.bid).toBe('6NT')
  })

  it('hela bot-auktionen landar i 6NT i stället för 3NT', () => {
    const history = botAuction(seed20261020)
    expect(history).not.toBeNull()
    expect(contractFromCalls(history!)).toMatchObject({ level: 6, strain: 'NT' })
  })

  // ---- Gränsvakt 1: 16–18-handen trevar INTE ------------------------------
  // Från öppnarens stol är en 16-hand + löpande minor + svararens 3NT
  // OSKILJBAR från en tunn 26-hp-slam som bara går på DD. Bara handen som SJÄLV
  // når slamintresse (19+) får treva – annars pass (hellre systemriktig miss).
  it('16–18-hand (utan äkta extra) passar 3NT – tröskeln 19 står', () => {
    const svagare: Deal = {
      ...seed20261020,
      id: '3nt-stopp-16-18',
      hands: { ...seed20261020.hands, N: parseHand('S:K H:A3 D:A5 C:AQT8432') }, // 16 hp
    }
    expect(decideCall(svagare, upTo3NT_20261020, 'N').bid).toBe('P')
  })

  // ---- Gränsvakt 2: svararen avböjer med ett minimum ----------------------
  // Trevaren ska kunna stanna. Ett rent minimum utan fit i minoren passar 4NT.
  it('svararen med minimum utan fit passar trevaren (4NT står, ingen 6NT)', () => {
    const svagSvar: Deal = {
      ...seed20261020,
      id: '3nt-stopp-svar-min',
      hands: { ...seed20261020.hands, S: parseHand('S:A6432 H:JT94 D:Q2 C:52') }, // 7 hp, ingen klöverfit
    }
    expect(decideCall(svagSvar, upTo4NT_20261020, 'S').bid).toBe('P')
  })

  // ---- Gränsvakt 3: vild fördelning hör inte hemma i en 6NT-trevare -------
  it('renons i öppnarens hand → ingen 4NT-trevare', () => {
    const vild: Deal = {
      ...seed20261020,
      id: '3nt-stopp-renons',
      hands: { ...seed20261020.hands, N: parseHand('S:- H:AK3 D:AT52 C:AQT843') },
    }
    expect(decideCall(vild, upTo3NT_20261020, 'N').bid).not.toBe('4NT')
  })
})
