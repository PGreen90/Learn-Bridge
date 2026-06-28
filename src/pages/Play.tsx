import { useEffect, useState } from 'react'
import type { Card, Deal, Hand, Rank, Seat, Suit } from '../types/bridge'
import { SEAT_LABEL } from '../lib/bidding'
import { dealRandom } from '../lib/engine/deal'
import {
  contractResult,
  dummyOf,
  isComplete,
  legalCards,
  playCard,
  side,
  startPlay,
  type Contract,
  type PlayedCard,
  type PlayState,
} from '../lib/engine/play'
import { pickContract } from '../lib/engine/play-contract'
import { botCard } from '../lib/engine/play-bot'
import { SuitSymbol } from '../components/SuitSymbol'
import { Panel } from '../components/Panel'
import { Button } from '../components/Button'

const SUIT_ORDER: Suit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANK_HIGH_TO_LOW: Rank[] = ['A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2']

interface Game {
  deal: Deal
  contract: Contract
  play: PlayState
}

function newGame(): Game {
  const deal = dealRandom()
  const contract = pickContract(deal)
  return { deal, contract, play: startPlay(deal, contract) }
}

/** Spelar ägaren (Syd) den här platsen? Vi spelar = både N och S; vi försvarar = bara S. */
function controls(contract: Contract, seat: Seat): boolean {
  return side(contract.declarer) === 'NS' ? side(seat) === 'NS' : seat === 'S'
}

function sameCard(a: Card, b: Card) {
  return a.suit === b.suit && a.rank === b.rank
}

function strainSymbol(contract: Contract) {
  return contract.strain === 'NT' ? <>NT</> : <SuitSymbol suit={contract.strain} />
}

export function Play() {
  const [game, setGame] = useState<Game>(newGame)
  const { contract, play } = game

  // Bottarna spelar automatiskt när det är deras tur (liten fördröjning).
  useEffect(() => {
    if (isComplete(play) || controls(contract, play.toAct)) return
    const id = setTimeout(() => {
      setGame((g) => {
        if (isComplete(g.play) || controls(g.contract, g.play.toAct)) return g
        return { ...g, play: playCard(g.play, botCard(g.play, g.play.toAct)) }
      })
    }, 750)
    return () => clearTimeout(id)
  }, [game, contract, play])

  function onPlay(card: Card) {
    setGame((g) => {
      if (isComplete(g.play) || !controls(g.contract, g.play.toAct)) return g
      if (!legalCards(g.play, g.play.toAct).some((c) => sameCard(c, card))) return g
      return { ...g, play: playCard(g.play, card) }
    })
  }

  const done = isComplete(play)
  const result = contractResult(play)
  const declSide = side(contract.declarer)
  const dummy = dummyOf(contract)
  const openingLeadMade = play.completedTricks.length > 0 || play.currentTrick.length > 0

  function isFaceUp(seat: Seat): boolean {
    if (seat === 'S') return true
    if (declSide === 'NS') return seat === 'N' // vi spelar → se även träkarlen Nord
    return seat === dummy && openingLeadMade // vi försvarar → träkarlen visas efter utspel
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold mb-1">Spela kort</h1>
        <p className="text-slate-600">
          Du sitter <strong>Syd</strong> och spelar mot datorn. Spelar din sida ut
          kontraktet styr du både Syd och träkarlen Nord; försvarar du spelar du
          bara Syd. Klicka ett kort när det är din tur.
        </p>
      </header>

      <Panel className="!p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-lg">
            <span className="text-slate-500 text-sm mr-2">Kontrakt</span>
            <span className="font-bold text-emerald-700">
              {contract.level} {strainSymbol(contract)}
            </span>{' '}
            <span className="text-slate-600">av {SEAT_LABEL[contract.declarer]}</span>
          </div>
          <div className="text-sm text-slate-600">
            N/S: <strong>{play.tricksNS}</strong> · Ö/V: <strong>{play.tricksEW}</strong> stick
            <span className="ml-2 text-slate-400">(behöver {result.needed})</span>
          </div>
          <Button onClick={() => setGame(newGame())}>Ny giv →</Button>
        </div>
        <p className="mt-2 text-sm">
          {done ? (
            <span className={result.made ? 'text-emerald-700 font-semibold' : 'text-red-600 font-semibold'}>
              {result.made
                ? `Hemma! ${result.declarerTricks} stick${result.diff > 0 ? ` (+${result.diff})` : ''}.`
                : `${-result.diff} bet (${result.declarerTricks} stick).`}
            </span>
          ) : controls(contract, play.toAct) ? (
            <span className="text-emerald-700 font-medium">Din tur – {SEAT_LABEL[play.toAct]} spelar.</span>
          ) : (
            <span className="text-slate-400">Datorn spelar … ({SEAT_LABEL[play.toAct]})</span>
          )}
        </p>
      </Panel>

      {/* Bord: Nord uppe, Väst/stick/Öst i mitten, Syd nere. */}
      <div className="space-y-4">
        <div className="flex justify-center">
          <SeatView seat="N" {...{ game, isFaceUp, onPlay }} />
        </div>
        <div className="flex flex-wrap items-stretch justify-center gap-4">
          <SeatView seat="W" {...{ game, isFaceUp, onPlay }} />
          <TrickView play={play} />
          <SeatView seat="E" {...{ game, isFaceUp, onPlay }} />
        </div>
        <div className="flex justify-center">
          <SeatView seat="S" {...{ game, isFaceUp, onPlay }} />
        </div>
      </div>
    </div>
  )
}

/** En plats: namn, ev. roll, och handen (öppen och klickbar, eller dold). */
function SeatView({
  seat,
  game,
  isFaceUp,
  onPlay,
}: {
  seat: Seat
  game: Game
  isFaceUp: (s: Seat) => boolean
  onPlay: (c: Card) => void
}) {
  const { contract, play } = game
  const hand = play.hands[seat]
  const faceUp = isFaceUp(seat)
  const isDeclarer = contract.declarer === seat
  const isDummy = dummyOf(contract) === seat
  const myTurn = play.toAct === seat && controls(contract, seat) && !isComplete(play)
  const legal = myTurn ? legalCards(play, seat) : []

  return (
    <Panel className={`!p-3 w-full sm:w-72 ${myTurn ? 'ring-2 ring-emerald-500' : ''}`}>
      <div className="flex items-baseline justify-between mb-2">
        <span className="font-semibold">
          {SEAT_LABEL[seat]}
          {seat === 'S' && <span className="ml-1 text-xs text-emerald-600">(du)</span>}
        </span>
        <span className="text-xs text-slate-500">
          {isDeclarer ? 'spelförare' : isDummy ? 'träkarl' : ''}
        </span>
      </div>
      {faceUp ? (
        <HandRows hand={hand} legal={legal} onPlay={myTurn ? onPlay : undefined} />
      ) : (
        <div className="bg-emerald-50 rounded-xl p-3 text-slate-400 text-sm">
          {hand.length} dolda kort
        </div>
      )}
    </Panel>
  )
}

/** Handen radvis per färg. Lagliga kort klickbara när det är din tur. */
function HandRows({
  hand,
  legal,
  onPlay,
}: {
  hand: Hand
  legal: Hand
  onPlay?: (c: Card) => void
}) {
  const legalSet = new Set(legal.map((c) => `${c.suit}${c.rank}`))
  return (
    <div className="bg-emerald-50 rounded-xl p-3 space-y-1">
      {SUIT_ORDER.map((suit) => {
        const cards = hand
          .filter((c) => c.suit === suit)
          .sort((a, b) => RANK_HIGH_TO_LOW.indexOf(a.rank) - RANK_HIGH_TO_LOW.indexOf(b.rank))
        return (
          <div key={suit} className="flex items-center gap-2 min-h-7">
            <SuitSymbol suit={suit} className="w-5 shrink-0 text-center" />
            <div className="flex flex-wrap gap-1">
              {cards.length === 0 ? (
                <span className="text-slate-400">—</span>
              ) : (
                cards.map((c) => {
                  const playable = onPlay && legalSet.has(`${c.suit}${c.rank}`)
                  return (
                    <button
                      key={c.rank}
                      disabled={!playable}
                      onClick={() => playable && onPlay!(c)}
                      className={`font-mono text-lg leading-none px-1.5 py-1 rounded border transition-colors ${
                        playable
                          ? 'border-emerald-400 bg-white hover:bg-emerald-100 cursor-pointer text-slate-900'
                          : onPlay
                            ? 'border-transparent text-slate-300 cursor-not-allowed'
                            : 'border-transparent text-slate-800'
                      }`}
                    >
                      {c.rank}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** Mitten: korten i pågående stick, annars förra (avslutade) sticket. */
function TrickView({ play }: { play: PlayState }) {
  const last =
    play.completedTricks.length > 0 ? play.completedTricks[play.completedTricks.length - 1] : undefined
  const trick: PlayedCard[] = play.currentTrick.length > 0 ? play.currentTrick : last?.cards ?? []
  const winner = play.currentTrick.length === 0 ? last?.winner : undefined
  return (
    <div className="hidden sm:flex items-center justify-center self-stretch">
      <div className="relative h-40 w-40 rounded-md border border-slate-300 bg-slate-50 p-2">
        {trick.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-slate-400">Sticket</div>
        ) : (
          <ul className="space-y-1 text-sm">
            {trick.map((pc) => (
              <li
                key={pc.seat}
                className={`flex items-center gap-2 ${pc.seat === winner ? 'font-bold text-emerald-700' : 'text-slate-600'}`}
              >
                <span className="w-8 shrink-0">{SEAT_LABEL[pc.seat].slice(0, 1)}</span>
                <span className="font-mono">{pc.card.rank}</span>
                <SuitSymbol suit={pc.card.suit} />
                {pc.seat === winner && <span className="text-xs">✓</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
