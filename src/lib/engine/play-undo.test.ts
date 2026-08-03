// Facit för ångra (Etapp C): backa till läget före ditt senaste kort — ditt
// kort OCH bottarnas svar efteråt ospelas, och det är din tur igen. Seedat.

import { describe, expect, it } from 'vitest'
import { dealRandom, mulberry32 } from './deal'
import { legalCards, playCard, startPlay, type Contract, type PlayState } from './play'
import { canUndo, undoLastHumanCard } from './play-undo'

const deal = dealRandom(mulberry32(20260803))
// Syd är spelförare → människan styr N + S (som controls i spel-vyn).
const contract: Contract = { declarer: 'S', strain: 'hearts', level: 4 }
const HUMAN = ['N', 'S'] as const

function playN(n: number): PlayState {
  let s = startPlay(deal, contract)
  for (let i = 0; i < n; i++) s = playCard(s, legalCards(s, s.toAct)[0])
  return s
}

describe('ångra senaste egna kortet', () => {
  it('inget eget kort lagt → inget att ångra', () => {
    // Väst spelar ut (S är spelförare) — efter 0 kort finns inget mänskligt.
    const fresh = playN(0)
    expect(canUndo(fresh, [...HUMAN])).toBe(false)
    expect(undoLastHumanCard(deal, contract, fresh, [...HUMAN])).toBeNull()
  })

  it('backar till läget före det senaste egna kortet — din tur igen', () => {
    // Utspel (V) + träkarln (N) = 2 kort → Nords kort är människans senaste.
    const after = playN(3) // V, N, Ö har lagt
    const undone = undoLastHumanCard(deal, contract, after, [...HUMAN])
    expect(undone).not.toBeNull()
    // Exakt läget efter bara utspelet: Nords kort och Östs svar är ospelade.
    expect(undone).toEqual(playN(1))
    // Och det är människans (träkarlens) tur igen.
    expect(undone!.toAct).toBe('N')
  })

  it('mitt i ett senare stick: hela kedjan sedan ditt kort spelas bort', () => {
    const after = playN(10) // bit in i tredje sticket
    const undone = undoLastHumanCard(deal, contract, after, [...HUMAN])
    expect(undone).not.toBeNull()
    // Det återuppbyggda läget slutar precis före ett mänskligt kort.
    const seq = [...after.completedTricks.flatMap((t) => t.cards), ...after.currentTrick]
    let lastHuman = -1
    for (let i = seq.length - 1; i >= 0; i--) {
      if (HUMAN.includes(seq[i].seat as (typeof HUMAN)[number])) {
        lastHuman = i
        break
      }
    }
    expect(undone).toEqual(playN(lastHuman))
    expect(HUMAN).toContain(undone!.toAct)
  })

  it('som motspelare (bara Syd) backas till före Syds senaste kort', () => {
    const defContract: Contract = { declarer: 'E', strain: 'spades', level: 2 }
    let s = startPlay(deal, defContract) // Syd spelar ut
    s = playCard(s, legalCards(s, s.toAct)[0]) // S
    s = playCard(s, legalCards(s, s.toAct)[0]) // W (träkarl, botens)
    s = playCard(s, legalCards(s, s.toAct)[0]) // N (bot)
    const undone = undoLastHumanCard(deal, defContract, s, ['S'])
    expect(undone).toEqual(startPlay(deal, defContract))
    expect(undone!.toAct).toBe('S')
  })
})
