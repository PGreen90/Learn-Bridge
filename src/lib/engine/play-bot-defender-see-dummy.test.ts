// FACIT FÖRE FIX (fältfynd 2026-09-13, Bricka 7): en försvarare ser TRÄKARLEN
// och kryper inte ett stick partnern bara "låtsas" vinna.
//
// Nord försvarar 5♦ av Väst med ♥AKJT972. Efter att ♥A tagits leder Syd
// (partnern) en hjärter, Väst (dold spelförare) följer lågt, och TRÄKARLEN (Öst)
// sitter EFTER Nord med ♥Q. Partnerns kort "vinner" just nu — men träkarlens ♥Q
// slår det. Nord ska SE träkarlen och gå upp med ♥K (billigaste vinnaren över
// träkarlens hot) i stället för att krypa och skänka bort sticket. Grundläggande
// spelförening: ta för ess OCH kung medan chansen finns (nästa rond ruffas).
//
// Buggen: `winOverBeatablePartner` gällde bara SPELFÖRARSIDAN; en försvarare som
// ser träkarlen bakom sig hade ingen regel → tumregeln "partnern vinner → kryp".

import { describe, expect, it } from 'vitest'
import type { Card, Deal, Rank, Seat, Suit } from '../../types/bridge'
import { parseHand } from '../bidding'
import { botCardReasoned, botCardSmartReasoned } from './play-bot'
import { doubleDummyDeclarerRemaining } from './dds'
import { playCard, startPlay, type Contract, type PlayState } from './play'

const H = (r: Rank): Card => ({ suit: 'hearts', rank: r })
const D = (r: Rank): Card => ({ suit: 'diamonds', rank: r })
const C = (r: Rank): Card => ({ suit: 'clubs', rank: r })

describe('Försvararen ser träkarlen — kryper inte partnerns slagbara stick (Bricka 7)', () => {
  // 5♦ av Väst (trumf ruter). N/S försvarar. Hjärterslutspel: Nord håller
  // mästaren ♥K + ♥J, träkarlen (Öst) ♥Q ligger EFTER Nord.
  const base: PlayState = {
    contract: { declarer: 'W', strain: 'diamonds', level: 5 },
    trump: 'diamonds',
    hands: {
      S: [H('8'), D('6'), C('3')], // partnern leder hjärter
      W: [H('5'), D('A'), D('K')], // dold spelförare, följer lågt
      N: [H('K'), H('J'), D('4')], // jag: mästaren ♥K + ♥J bakom
      E: [H('Q'), D('Q'), D('2')], // TRÄKARLEN: ♥Q spelar efter mig
    } as Record<Seat, Card[]>,
    leader: 'S',
    toAct: 'S',
    currentTrick: [],
    completedTricks: [],
    tricksNS: 1,
    tricksEW: 1,
  }

  /** Läget vid Nords tur: Syd ledde ♥8, Väst följde ♥5 (3:e hand = Nord). */
  function atNord(): PlayState {
    let s = playCard(base, H('8'))
    s = playCard(s, H('5'))
    return s
  }

  it('DDS-mekanism: ♥K vinner sticket åt försvaret, ♥J skänker det till träkarlens ♥Q', () => {
    const s = atNord()
    // Spelförarens (Väst, EW) återstående stick efter Nords val — lägre = bättre för försvaret.
    const declEfter = (c: Card) => {
      const t = playCard(s, c)
      return doubleDummyDeclarerRemaining(t.hands, 'diamonds', 'W', t.currentTrick, t.toAct, Infinity) ?? Infinity
    }
    expect(declEfter(H('K'))).toBeLessThan(declEfter(H('J'))) // att ta med kungen tjänar ett stick
  })

  it('Nord går upp med ♥K (ser träkarlen), inte ♥J (krypa)', () => {
    expect(botCardReasoned(atNord(), 'N').card).toEqual(H('K'))
  })
})

// Felrapport #64 (bricka 8, 3NT av Väst): samma regel i sang. Syd (partnern)
// leder ♠10 i stick 3; träkarlen (Öst) har bara ♠J kvar och ligger EFTER Nord;
// Nord håller ♠K5. Nord ska gå upp med ♠K och slå träkarlens ♠J, inte krypa med
// ♠5 (ägaren: "Måste gå över med kungen"). Rapporten skrevs före regeln nådde
// den här sitsen; låst här för både heuristiken och Monte-Carlo-lagret.
describe('felrapport #64 – försvararen går över träkarlens ♠J med kungen (3NT)', () => {
  const SU: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
  const card = (code: string): Card => ({ suit: SU[code[0]], rank: (code.slice(1) === 'T' ? '10' : code.slice(1)) as Rank })
  const deal: Deal = {
    id: 't', dealer: 'W', vulnerability: 'none', board: 8,
    hands: {
      N: parseHand('S:K532 H:J982 D:J C:J876'),
      E: parseHand('S:J76 H:A75 D:KT64 C:K43'),
      S: parseHand('S:AQT4 H:64 D:9852 C:AQ9'),
      W: parseHand('S:98 H:KQT3 D:AQ73 C:T52'),
    },
  }
  const contract: Contract = { declarer: 'W', strain: 'NT', level: 3 }
  const calls = [
    { seat: 'W' as Seat, bid: '1D' }, { seat: 'N' as Seat, bid: 'P' }, { seat: 'E' as Seat, bid: '2D' }, { seat: 'S' as Seat, bid: 'P' },
    { seat: 'W' as Seat, bid: '2NT' }, { seat: 'N' as Seat, bid: 'P' }, { seat: 'E' as Seat, bid: '3NT' },
    { seat: 'S' as Seat, bid: 'P' }, { seat: 'W' as Seat, bid: 'P' }, { seat: 'N' as Seat, bid: 'P' },
  ]
  /** Spelar de tre första stickens kända kort fram till Nords tur i stick 3. */
  function atNord(): PlayState {
    let s = startPlay(deal, contract)
    for (const c of ['S3', 'S6', 'SQ', 'S8', 'SA', 'S9', 'S2', 'S7', 'ST', 'C2']) s = playCard(s, card(c))
    return s
  }

  it('Nord spelar ♠K (heuristiken)', () => {
    expect(botCardReasoned(atNord(), 'N').card).toEqual(card('SK'))
  })
  it('Nord spelar ♠K (Monte-Carlo-lagret, som vid bordet)', () => {
    expect(botCardSmartReasoned(atNord(), 'N', calls, {}).card).toEqual(card('SK'))
  })
})

// Felrapport #65 (bricka 2, 4♣ av Väst, trumf klöver): samma regel som en RUFF.
// Syd (partnern) leder ♠3 i stick 4; Nord är renons i spader och har trumfen ♣6
// kvar; träkarlen (Öst) ligger efter Nord med ♠AJ98. Nords ♠-lösa hand ska stjäla
// med ♣6 (billigaste vinnaren) i stället för att kasta av (ägaren: "Jag ger nord
// en chans till ruff. Den måste ta den."). Redan rätt i motorn — låst här.
describe('felrapport #65 – försvararen tar ruffen med ♣6 (4♣)', () => {
  const SU: Record<string, Suit> = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' }
  const card = (code: string): Card => ({ suit: SU[code[0]], rank: (code.slice(1) === 'T' ? '10' : code.slice(1)) as Rank })
  const deal: Deal = {
    id: 't', dealer: 'E', vulnerability: 'ns', board: 2,
    hands: {
      N: parseHand('S:K7 H:QJ98 D:KQT32 C:62'),
      E: parseHand('S:AJ98 H:K754 D:J9 C:QT4'),
      S: parseHand('S:T5432 H:A32 D:A765 C:A'),
      W: parseHand('S:Q6 H:T6 D:84 C:KJ98753'),
    },
  }
  const contract: Contract = { declarer: 'W', strain: 'clubs', level: 4 }
  const calls = [
    { seat: 'E' as Seat, bid: 'P' }, { seat: 'S' as Seat, bid: '1S' }, { seat: 'W' as Seat, bid: '3C' }, { seat: 'N' as Seat, bid: 'X' },
    { seat: 'E' as Seat, bid: '4C' }, { seat: 'S' as Seat, bid: 'P' }, { seat: 'W' as Seat, bid: 'P' }, { seat: 'N' as Seat, bid: 'P' },
  ]
  /** Spelar de kända korten fram till Nords tur i stick 4 (Syd har lett ♠3, Väst kastat ♦4). */
  function atNord(): PlayState {
    let s = startPlay(deal, contract)
    for (const c of ['SK', 'S8', 'S2', 'S6', 'S7', 'S9', 'ST', 'SQ', 'C3', 'C2', 'C4', 'CA', 'S3', 'D4']) s = playCard(s, card(c))
    return s
  }

  it('Nord stjäl med ♣6 (heuristiken)', () => {
    expect(botCardReasoned(atNord(), 'N').card).toEqual(card('C6'))
  })
  it('Nord stjäl med ♣6 (Monte-Carlo-lagret, som vid bordet)', () => {
    expect(botCardSmartReasoned(atNord(), 'N', calls, {}).card).toEqual(card('C6'))
  })
})
