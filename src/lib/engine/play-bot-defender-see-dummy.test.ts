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
import type { Card, Rank, Seat } from '../../types/bridge'
import { botCardReasoned } from './play-bot'
import { doubleDummyDeclarerRemaining } from './dds'
import { playCard, type PlayState } from './play'

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
