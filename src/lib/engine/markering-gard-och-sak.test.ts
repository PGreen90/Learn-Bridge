// FACIT FÖRE FIX — markeringsinventeringen 2026-11-22 (ägarbeslut samma dag).
//
// GARDEN: "Man offrar inte en oskyddad gard. Har jag 10-8-6-5-4 väljer jag 8."
// Honnörer och tian är gardar och offras aldrig för en markering. Men i en färg
// på fem kort eller fler är hackorna därunder fria ("har jag en femkortsfärg kan
// en trea bli ett stick — det kostar inget att offra en nia eller åtta"). Förr
// sparades alltid de två högsta korten, så ur 9-8-4-3-2 blev det "höga" kortet
// en fyra. Kortare färger (tre–fyra kort) behåller den gamla regeln.
//
// LAVINTHAL-SAKEN, tre fel som sonden visade i samma kort (3NT av Syd, ♠K ut,
// Öst renons med ♥K-D-kn-8 ♦9-8-4-2 ♣7-6-5-3-2 sakade ♦4):
//   1. "högt" lades som en fyra men lästes som lågt,
//   2. en färg begärdes även helt utan honnörer (och läsaren räknade med en dam),
//   3. utspelsfärgen, där saken per definition är renons, räknades som en av
//      färgerna att välja mellan — så styrkefärgen hjärter gick aldrig att be om.

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Suit } from '../../types/bridge'
import { parseHand } from '../bidding'
import { buildHandModel } from './hand-model'
import { botCardReasoned } from './play-bot'
import { playCard, startPlay, type PlayState } from './play'
import { applySignalReads, partnerLavinthalRequest } from './signal-decode'
import { friaHackor } from './signals'

const SUIT: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
const card = (t: string): Card => ({ suit: SUIT[t[0]], rank: (t.slice(1) === 'T' ? '10' : t.slice(1)) as Rank })
const farg = (ranker: string): Card[] => ranker.split(' ').map((r) => ({ suit: 'hearts' as Suit, rank: r as Rank }))
const ORDNING: Rank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A']
const hogsta = (kort: Card[]) => [...kort].sort((a, b) => ORDNING.indexOf(b.rank) - ORDNING.indexOf(a.rank))[0]?.rank

describe('garden: vilka hackor får bära en markering', () => {
  // Ägarens tio femkortsfärger: alla kan visa högt, med sjua eller högre.
  const TIO: Array<[string, Rank]> = [
    ['K 9 7 4 2', '9'],
    ['10 8 6 3 2', '8'],
    ['Q J 9 5 3', '9'],
    ['9 8 4 3 2', '9'],
    ['A 10 7 6 5', '7'],
    ['8 7 5 4 2', '8'],
    ['J 10 9 8 6', '9'],
    ['7 6 5 3 2', '7'],
    ['K Q 8 7 2', '8'],
    ['10 9 7 5 4', '9'],
  ]
  it.each(TIO)('femkortsfärgen %s markerar högt med %s', (ranker, vantat) => {
    expect(hogsta(friaHackor(farg(ranker)))).toBe(vantat)
  })

  it('ägarens exempel: 10-8-6-5-4 → åttan (tian är gard)', () => {
    expect(hogsta(friaHackor(farg('10 8 6 5 4')))).toBe('8')
  })

  it('honnörer och tian är aldrig fria, oavsett längd', () => {
    const fria = friaHackor(farg('A K Q J 10 9 2')).map((c) => c.rank)
    expect(fria).toEqual(['9', '2'])
  })

  it('tre–fyra kort: gamla gardregeln står kvar (de två högsta sparas)', () => {
    expect(friaHackor(farg('9 8 4 2')).map((c) => c.rank)).toEqual(['4', '2'])
    expect(friaHackor(farg('10 8 2')).map((c) => c.rank)).toEqual(['2'])
  })

  it('en dubbelton lämnas orörd', () => {
    expect(friaHackor(farg('9 3'))).toHaveLength(2)
  })
})

const deal = (N: string, E: string, S: string, W: string): Deal =>
  ({ id: 't', board: 1, dealer: 'S', vulnerability: 'none', hands: { N: parseHand(N), E: parseHand(E), S: parseHand(S), W: parseHand(W) } }) as Deal
const spela = (d: Deal, kort: string): PlayState =>
  kort.split(' ').reduce((s, k) => playCard(s, card(k)), startPlay(d, { level: 3, strain: 'NT', declarer: 'S' }))
const kod = (c: Card) => `${c.suit[0].toUpperCase()}${c.rank === '10' ? 'T' : c.rank}`

// 3NT av Syd, Väst spelar ut ♠K, bordet ♠3, Öst är renons.
const STYRKA_I_HJARTER = deal('S:A43 H:765 D:AKQ C:AKQJ', 'S:- H:KQJ8 D:9842 C:76532', 'S:T8762 H:AT9 D:JT3 C:T4', 'S:KQJ95 H:432 D:765 C:98')
const INGA_HONNORER = deal('S:A43 H:KQ5 D:AKQ C:AKQJ', 'S:- H:8764 D:9842 C:76532', 'S:T8762 H:AJ9 D:JT3 C:T4', 'S:KQJ95 H:T32 D:765 C:98')

describe('Lavinthal-saken: lägga och läsa säger samma sak', () => {
  it('Öst med ♥K-D-kn-8 ber om HJÄRTER, med ett kort som går att läsa', () => {
    const fore = spela(STYRKA_I_HJARTER, 'SK S3')
    const sak = botCardReasoned(fore, 'E').card
    const efter = spela(STYRKA_I_HJARTER, `SK S3 ${kod(sak)} S2`)
    expect(partnerLavinthalRequest(efter, 'W')).toBe('hearts')
  })

  it('…och saken tas inte ur hjärtern själv', () => {
    expect(botCardReasoned(spela(STYRKA_I_HJARTER, 'SK S3'), 'E').card.suit).not.toBe('hearts')
  })

  it('utspelsfärgen räknas inte: en hög ruter väljer mellan hjärter och klöver, aldrig spader', () => {
    const efter = spela(STYRKA_I_HJARTER, 'SK S3 D9 S2')
    expect(partnerLavinthalRequest(efter, 'W')).toBe('hearts')
    expect(partnerLavinthalRequest(spela(STYRKA_I_HJARTER, 'SK S3 D2 S2'), 'W')).toBe('clubs')
  })

  it('en hög sak lovar dam eller högre i den begärda färgen', () => {
    const efter = spela(STYRKA_I_HJARTER, 'SK S3 C7 S2')
    expect(applySignalReads(buildHandModel([]), efter, 'W').E.suitHcp.hearts.min).toBeGreaterThanOrEqual(2)
  })

  it('utan honnörer läggs ett LÅGT kort — aldrig en hög begäran', () => {
    const sak = botCardReasoned(spela(INGA_HONNORER, 'SK S3'), 'E').card
    expect(ORDNING.indexOf(sak.rank)).toBeLessThanOrEqual(ORDNING.indexOf('6'))
  })

  it('en låg sak lovar ingenting: läsaren antar ingen dam', () => {
    const sak = botCardReasoned(spela(INGA_HONNORER, 'SK S3'), 'E').card
    const efter = spela(INGA_HONNORER, `SK S3 ${kod(sak)} S2`)
    const modell = applySignalReads(buildHandModel([]), efter, 'W')
    for (const s of ['hearts', 'diamonds', 'clubs'] as Suit[]) expect(modell.E.suitHcp[s].min).toBe(0)
  })
})

// MÄTNINGEN 2026-11-23 (120 givar före/efter): en LÅG sak betyder "den lägre
// färgen, eller ingenting att be om". Två givar (frö 20260779 och 20260752)
// visade att läsaren ändå lydde den som en order och övergav sin egen långa
// utspelsfärg. Bara en HÖG sak (som lovar dam eller högre) går före
// fortsättningen av utspelsfärgen; en låg sak lyds först när utspelsfärgen
// inte har något att ge.
describe('en låg sak är ett tips, inte en order', () => {
  // Frö 20260779: 4♠ av Öst. Syd leder ♥D (partnerns färg), Nord tar över och
  // fortsätter hjärter; Syd är renons och sakar ♣2 utan något att be om.
  const GIV = deal('S:43 H:AKJT742 D:AJ8 C:5', 'S:AQ762 H:96 D:94 C:AQT3', 'S:J9 H:Q D:T7653 C:98762', 'S:KT85 H:853 D:KQ2 C:KJ4')
  const lage = (kort: string): PlayState =>
    kort.split(' ').reduce((s, k) => playCard(s, card(k)), startPlay(GIV, { level: 4, strain: 'spades', declarer: 'E' }))

  it('Nord fortsätter sin hjärter (Syd kan stjäla över) i stället för att byta till ruter', () => {
    const st = lage('HQ H3 HK H6 HJ H9 C2 H5')
    expect(partnerLavinthalRequest(st, 'N')).toBe('diamonds')
    expect(botCardReasoned(st, 'N').card.suit).toBe('hearts')
  })
})
