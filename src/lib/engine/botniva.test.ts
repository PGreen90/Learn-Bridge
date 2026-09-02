// FACIT för trebottarna i nivåer (skrivet FÖRE nattjobbets ombyggnad).
//
// Löftena som nivåbygget vilar på (utöver botspelare.test.ts, som redan låser
// expertens determinism och paritet):
//   1. Namnen och nivårattarna är LÅSTA — ägarbeslut 2026-09-01. Expert = tomma
//      opts (exakt dagens bot, samma kodväg), nybörjare = ingen MC alls.
//   2. Även en SVAGARE nivås inskick godkänns av samma validera() som
//      människors — nivån gör aldrig något olagligt, bara sämre val.
//   3. Nattgranskningsparitet på ALLA nivåer: nivån rör bara de säten Syd styr,
//      så N/Ö/V-korten (och dummy när Ö/V är spelförande) är exakt
//      standardmotorns val — annars flyttas bottens rader till 'granskning'
//      varje natt.
//
// En bricka per svagare nivå (spelet kostar ~30–40 s/giv — motståndarsätena
// kör alltid standardmotorns MC oavsett nivå), egna tidsgränser som i
// botspelare.test.ts.

import { describe, expect, it } from 'vitest'
import type { Card, Seat } from '../../types/bridge'
import { playSeedForBoard, seedForBoard } from '../../../api-src/_lib/seed'
import { validera } from '../../../api-src/_lib/validera'
import { spelaBotGiv, type BotInskick } from './botspelare'
import { nivaSmartOpts, TAVLINGSBOTTAR, type BotNiva } from './botniva'
import { dealFromSeed, mulberry32 } from './deal'
import { contractFromCalls } from './auction-live'
import { playCard, side, startPlay } from './play'
import { botCardSmart } from './play-bot'
import { botDecisionSeed, playIndexOf } from './play-seed'

const SECRET = 'facit-testhemlighet'
const DATUM = '2026-09-02'
const TUNG = 300_000

// Samma teckenregel som profiles-tabellen (migration 0001) — ett namn som
// databasen skulle vägra får aldrig läggas i listan.
const NAMN_REGEX = /^[A-Za-zÅÄÖåäö0-9_-]{4,10}$/

describe('trebottarnas lista och rattar (låsta ägarbeslut)', () => {
  it('tre bottar med giltiga, unika människonamn', () => {
    expect(TAVLINGSBOTTAR.map((b) => b.namn)).toEqual(['Gunnar52', 'Lasse68', 'Emma03'])
    expect(TAVLINGSBOTTAR.map((b) => b.niva)).toEqual(['expert', 'medel', 'nyborjare'])
    for (const bot of TAVLINGSBOTTAR) {
      expect(bot.namn, `${bot.namn} klarar inte profiles-constrainten`).toMatch(NAMN_REGEX)
    }
    expect(new Set(TAVLINGSBOTTAR.map((b) => b.namn.toLowerCase())).size).toBe(3)
    expect(new Set(TAVLINGSBOTTAR.map((b) => b.epost)).size).toBe(3)
  })

  it('Gunnar52 ärver rebidz-bots konto (döps om via gammaltNamn)', () => {
    expect(TAVLINGSBOTTAR[0]).toMatchObject({ namn: 'Gunnar52', gammaltNamn: 'rebidz-bot' })
    // Bara experten har ett gammalt konto att ärva.
    expect(TAVLINGSBOTTAR.filter((b) => b.gammaltNamn)).toHaveLength(1)
  })

  it('expert = tomma opts (dagens bot, orörd kodväg) och nivårattarna är låsta', () => {
    expect(nivaSmartOpts('expert')).toEqual({})
    // Medel-fönstret 4 är MÄTT fram (botniva.probe.test.ts) — ändra det aldrig
    // utan en ny netto-mätning.
    expect(nivaSmartOpts('medel')).toEqual({ maxCardsForMC: 4, samples: 8, decodeSignals: false })
    expect(nivaSmartOpts('nyborjare')).toEqual({ maxCardsForMC: 0 })
  })
})

// --- Spelade facit-brickor per svagare nivå (memo — spelet är dyrt) ---------

const memo = new Map<string, BotInskick | null>()
const spela = (niva: BotNiva, board: number): BotInskick | null => {
  const nyckel = `${niva}:${board}`
  if (!memo.has(nyckel)) {
    memo.set(
      nyckel,
      spelaBotGiv(
        seedForBoard(SECRET, DATUM, board),
        playSeedForBoard(SECRET, DATUM, board),
        board,
        nivaSmartOpts(niva),
      ),
    )
  }
  return memo.get(nyckel)!
}

const PROV: Array<{ niva: BotNiva; board: number }> = [
  { niva: 'medel', board: 1 },
  { niva: 'nyborjare', board: 2 },
]

describe('svagare nivåers inskick', () => {
  it('godkänns av samma validera() som människors inskick', { timeout: TUNG }, () => {
    for (const { niva, board } of PROV) {
      const inskick = spela(niva, board)
      expect(inskick, `${niva} bricka ${board}: auktionen skenade`).not.toBeNull()
      const v = validera(SECRET, DATUM, inskick!)
      expect(v.giltig, `${niva} bricka ${board}: ${v.giltig ? '' : v.skäl}`).toBe(true)
    }
  })

  it('klarar nattgranskningens replay — N/Ö/V-säten förblir standardmotorns', { timeout: TUNG }, () => {
    for (const { niva, board } of PROV) {
      const inskick = spela(niva, board)!
      const contract = contractFromCalls(inskick.history)
      if (!contract || !inskick.plays.length) continue
      const deal = dealFromSeed(seedForBoard(SECRET, DATUM, board), board)
      const playSeed = playSeedForBoard(SECRET, DATUM, board)
      // Exakt granskningens urval (tavlingsgranskning.probe): Syd styr S, och
      // hela N/S-sidan när N/S är spelförande — övriga säten granskas.
      const granskas = (seat: Seat) =>
        side(contract.declarer) === 'NS' ? side(seat) !== 'NS' : seat !== 'S'
      let state = startPlay(deal, contract)
      for (const spelat of inskick.plays) {
        const seat = state.toAct
        if (granskas(seat)) {
          const index = playIndexOf(state.completedTricks.length, state.currentTrick.length)
          const rng = mulberry32(botDecisionSeed(playSeed, index))
          const motorns: Card = botCardSmart(state, seat, inskick.history, { rng })
          expect(motorns, `${niva} bricka ${board}, kort ${index + 1} (${seat})`).toEqual(spelat)
        }
        state = playCard(state, spelat)
      }
    }
  })
})
